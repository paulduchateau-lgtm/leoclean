import "server-only";

import { BusinessError } from "@/lib/booking/errors";
import type { TenantClient } from "@/lib/db";

import { stripe, stripeEstConfigure } from "./stripe";

/**
 * Le moyen de paiement du client.
 *
 * C'est la pièce qui manquait à `travaux.ts` : la préautorisation à H-24 exige
 * un `stripeCustomerId` et une carte enregistrée, et rien ne les écrivait.
 *
 * **On passe par une session Checkout en mode `setup`, pas par des champs de
 * carte dans nos pages.** La saisie a lieu chez Stripe, sur son domaine : le
 * numéro de carte ne traverse jamais notre application, ne figure dans aucun
 * journal, et la surface PCI reste chez celui dont c'est le métier. Le coût est
 * un aller-retour de navigation ; le bénéfice est de ne jamais avoir à
 * répondre de la fuite d'un champ qu'on n'a pas écrit.
 *
 * **La carte n'est pas exigée à la réservation.** Elle l'est avant la mission —
 * la préautorisation part vingt-quatre heures avant. Demander une carte pour
 * obtenir une date est le meilleur moyen de perdre quelqu'un qui n'a pas encore
 * essayé le service, et le tunnel a déjà atteint sa cible de gestes.
 */

export class PaiementIndisponibleError extends BusinessError {}

export interface MoyenDePaiement {
  id: string;
  marque: string;
  quatreDerniers: string;
  expireLe: string;
}

/**
 * Le client Stripe de cette personne, créé au besoin.
 *
 * L'identifiant est écrit en base dès la création : le recréer à chaque appel
 * produirait autant de clients Stripe que de visites, et la carte enregistrée
 * sur l'un serait invisible depuis l'autre.
 */
async function clientStripe(
  db: TenantClient,
  clientProfileId: string,
): Promise<string> {
  const profil = await db.clientProfile.findFirst({
    where: { id: clientProfileId },
    select: {
      id: true,
      stripeCustomerId: true,
      phone: true,
      user: { select: { email: true, name: true } },
    },
  });

  if (!profil) {
    throw new PaiementIndisponibleError("Espace client introuvable.");
  }
  if (profil.stripeCustomerId) return profil.stripeCustomerId;

  const cree = await stripe().customers.create({
    email: profil.user.email ?? undefined,
    name: profil.user.name ?? undefined,
    phone: profil.phone ?? undefined,
    metadata: { clientProfileId: profil.id },
  });

  await db.clientProfile.update({
    where: { id: profil.id },
    data: { stripeCustomerId: cree.id },
  });

  return cree.id;
}

/**
 * Ouvre une session d'enregistrement de carte et rend son URL.
 *
 * `mode: "setup"` n'encaisse rien : il enregistre un moyen de paiement pour
 * une utilisation ultérieure hors session, ce qui est exactement ce dont la
 * préautorisation a besoin.
 */
export async function ouvrirLenregistrement(
  db: TenantClient,
  clientProfileId: string,
  retourVers: string,
): Promise<{ url: string }> {
  if (!stripeEstConfigure()) {
    throw new PaiementIndisponibleError(
      "L'enregistrement de carte n'est pas encore ouvert. Nous vous appelons avant la première intervention.",
    );
  }

  const customer = await clientStripe(db, clientProfileId);

  const session = await stripe().checkout.sessions.create({
    mode: "setup",
    customer,
    currency: "eur",
    /*
     * `off_session` : la carte servira à une préautorisation déclenchée sans
     * le client devant l'écran. Le déclarer ici est ce qui fait demander à sa
     * banque l'authentification forte **maintenant**, pendant qu'il peut y
     * répondre, plutôt que la nuit d'avant la mission.
     */
    payment_method_options: { card: { setup_future_usage: "off_session" } },
    success_url: `${retourVers}?carte=enregistree`,
    cancel_url: `${retourVers}?carte=annulee`,
  });

  if (!session.url) {
    throw new PaiementIndisponibleError(
      "Stripe n'a pas rendu d'adresse de paiement.",
    );
  }

  return { url: session.url };
}

/**
 * Les cartes enregistrées.
 *
 * Lues chez Stripe et non en base : recopier une date d'expiration chez nous
 * la ferait diverger le jour où le client remplace sa carte depuis son
 * portefeuille bancaire, et on annoncerait valide une carte qui ne l'est plus.
 */
export async function lireLesMoyens(
  db: TenantClient,
  clientProfileId: string,
): Promise<MoyenDePaiement[]> {
  if (!stripeEstConfigure()) return [];

  const profil = await db.clientProfile.findFirst({
    where: { id: clientProfileId },
    select: { stripeCustomerId: true },
  });
  if (!profil?.stripeCustomerId) return [];

  const moyens = await stripe().paymentMethods.list({
    customer: profil.stripeCustomerId,
    type: "card",
    limit: 5,
  });

  return moyens.data.flatMap((moyen) =>
    moyen.card
      ? [
          {
            id: moyen.id,
            marque: moyen.card.brand,
            quatreDerniers: moyen.card.last4,
            expireLe: `${String(moyen.card.exp_month).padStart(2, "0")}/${String(
              moyen.card.exp_year,
            ).slice(-2)}`,
          },
        ]
      : [],
  );
}

/**
 * Retire une carte.
 *
 * **On refuse de retirer la dernière quand une intervention est à venir.** Une
 * carte détachée la veille ferait échouer la préautorisation, et le client
 * découvrirait le problème le matin où personne ne vient — ou bien on viendrait
 * sans pouvoir être payé. Le refus dit quoi faire : en ajouter une autre, ou
 * annuler l'intervention.
 */
export async function retirerLeMoyen(
  db: TenantClient,
  clientProfileId: string,
  moyenId: string,
  maintenant: Date = new Date(),
): Promise<void> {
  const restants = (await lireLesMoyens(db, clientProfileId)).filter(
    (moyen) => moyen.id !== moyenId,
  );

  if (restants.length === 0) {
    const aVenir = await db.booking.count({
      where: {
        clientProfileId,
        scheduledStart: { gt: maintenant },
        status: { in: ["PENDING_ASSIGNMENT", "ASSIGNED", "CONFIRMED"] },
      },
    });

    if (aVenir > 0) {
      throw new PaiementIndisponibleError(
        `Vous avez ${aVenir} intervention${aVenir > 1 ? "s" : ""} à venir. ` +
          "Ajoutez une autre carte avant de retirer celle-ci, ou annulez " +
          "l'intervention.",
      );
    }
  }

  await stripe().paymentMethods.detach(moyenId);
}
