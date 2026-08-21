import "server-only";

import { forOrganization, prisma } from "@/lib/db";
import { leverLeRecouvrement } from "@/lib/paiement/impayes";

import {
  type EtapePaiement,
  autorisationTiendra,
  prochaineEtapePaiement,
} from "./calendrier";
import { cleDIdempotence, stripe, stripeEstConfigure } from "./stripe";

/**
 * Les deux travaux planifiés du paiement.
 *
 * `calendrier.ts` décide, ce module exécute — la même séparation que partout
 * ailleurs, et elle compte doublement ici : on peut rejouer un mois de
 * calendrier en quelques millisecondes plutôt que d'attendre un mois pour
 * découvrir qu'on prélève des missions qui n'ont pas eu lieu.
 *
 * **Chaque réservation est traitée séparément.** Une erreur sur l'une ne doit
 * pas arrêter les autres : c'est la règle des échéances, et elle vaut d'autant
 * plus quand un échec signifie qu'un intervenant ne sera pas payé.
 */

export interface RapportPaiements {
  examinees: number;
  preautorisees: number;
  prelevees: number;
  liberees: number;
  echecs: { bookingId: string; etape: EtapePaiement; motif: string }[];
  /** Stripe n'est pas configuré : rien n'a été tenté, et c'est dit. */
  ignore?: true;
}

/**
 * Réservations dont le paiement peut avoir quelque chose à faire.
 *
 * On borne à une fenêtre plutôt que de balayer toute la table : les
 * réservations d'il y a six mois n'ont plus d'étape possible, et les relire à
 * chaque passage de l'ordonnanceur coûterait pour rien.
 */
const FENETRE_JOURS = 30;

export async function traiterLesPaiements(
  maintenant: Date = new Date(),
): Promise<RapportPaiements> {
  const rapport: RapportPaiements = {
    examinees: 0,
    preautorisees: 0,
    prelevees: 0,
    liberees: 0,
    echecs: [],
  };

  if (!stripeEstConfigure()) {
    /*
     * Rien n'est tenté, et le rapport le dit. C'est différent d'un silence :
     * l'ordonnanceur qui rend « ignoré » se relit, celui qui rend zéro laisse
     * croire qu'il n'y avait rien à faire.
     */
    return { ...rapport, ignore: true };
  }

  const debutFenetre = new Date(
    maintenant.getTime() - FENETRE_JOURS * 86_400_000,
  );
  const finFenetre = new Date(maintenant.getTime() + 2 * 86_400_000);

  const reservations = await prisma.booking.findMany({
    where: {
      scheduledStart: { gte: debutFenetre, lte: finFenetre },
      status: {
        in: [
          "CONFIRMED",
          "IN_PROGRESS",
          "COMPLETED",
          "CANCELLED_BY_CLIENT",
          "CANCELLED_BY_CLEANER",
          "NO_SHOW",
        ],
      },
    },
    select: {
      id: true,
      organizationId: true,
      status: true,
      scheduledStart: true,
      scheduledEnd: true,
      completedAt: true,
      grossAmountCents: true,
      cancellationFeeCents: true,
      clientProfileId: true,
      clientProfile: { select: { stripeCustomerId: true } },
      payments: {
        select: {
          id: true,
          status: true,
          stripePaymentIntentId: true,
          amountCents: true,
        },
      },
    },
  });

  for (const reservation of reservations) {
    rapport.examinees += 1;

    const paiement = reservation.payments[0] ?? null;
    const etape = prochaineEtapePaiement(
      {
        statutReservation: reservation.status,
        autorisee: paiement?.status === "REQUIRES_CAPTURE",
        capturee: paiement?.status === "CAPTURED",
        debutMission: reservation.scheduledStart,
        finMission: reservation.scheduledEnd,
        termineeA: reservation.completedAt,
      },
      maintenant,
    );

    if (etape === "ATTENDRE") continue;

    try {
      if (etape === "PREAUTORISER") {
        await preautoriser(reservation);
        rapport.preautorisees += 1;
      } else if (etape === "PRELEVER") {
        await prelever(reservation, paiement!);
        rapport.prelevees += 1;
      } else if (etape === "LIBERER") {
        await liberer(reservation, paiement!);
        rapport.liberees += 1;
      }
    } catch (erreur) {
      rapport.echecs.push({
        bookingId: reservation.id,
        etape,
        motif: erreur instanceof Error ? erreur.message : "inconnu",
      });
    }
  }

  return rapport;
}

async function preautoriser(reservation: {
  id: string;
  organizationId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  grossAmountCents: number;
  clientProfile: { stripeCustomerId: string | null };
}): Promise<void> {
  /*
   * Le garde-fou de la fenêtre bancaire est vérifié ici, pas seulement en test :
   * une mission dont la durée sortirait de la fenêtre doit échouer maintenant,
   * pendant qu'on peut encore prévenir, plutôt qu'au moment du débit, quand la
   * prestation est déjà faite.
   */
  if (
    !autorisationTiendra({
      debut: reservation.scheduledStart,
      fin: reservation.scheduledEnd,
    })
  ) {
    throw new Error(
      "Le calendrier de cette mission sortirait de la fenêtre d'autorisation bancaire.",
    );
  }

  const client = reservation.clientProfile.stripeCustomerId;
  if (!client) {
    throw new Error("Aucun moyen de paiement enregistré pour ce client.");
  }

  const moyens = await stripe().paymentMethods.list({
    customer: client,
    type: "card",
    limit: 1,
  });
  const moyen = moyens.data[0];
  if (!moyen) {
    throw new Error("Aucune carte enregistrée pour ce client.");
  }

  const intention = await stripe().paymentIntents.create(
    {
      amount: reservation.grossAmountCents,
      currency: "eur",
      customer: client,
      payment_method: moyen.id,
      /*
       * Capture manuelle : on pose l'autorisation, on ne débite pas. Le débit
       * a lieu vingt-quatre heures après la clôture réelle, et seulement si
       * elle a eu lieu.
       */
      capture_method: "manual",
      confirm: true,
      off_session: true,
      metadata: { bookingId: reservation.id },
    },
    { idempotencyKey: cleDIdempotence(reservation.id, "preautorisation") },
  );

  const db = forOrganization(reservation.organizationId);
  await db.payment.create({
    data: {
      organizationId: reservation.organizationId,
      bookingId: reservation.id,
      status: "REQUIRES_CAPTURE",
      stripePaymentIntentId: intention.id,
      amountCents: reservation.grossAmountCents,
      authorizedAt: new Date(),
    },
  });
}

async function prelever(
  reservation: {
    id: string;
    organizationId: string;
    grossAmountCents: number;
    clientProfileId: string;
  },
  paiement: { id: string; stripePaymentIntentId: string | null },
): Promise<void> {
  if (!paiement.stripePaymentIntentId) {
    throw new Error("Autorisation introuvable côté Stripe.");
  }

  const capturee = await stripe().paymentIntents.capture(
    paiement.stripePaymentIntentId,
    {},
    { idempotencyKey: cleDIdempotence(reservation.id, "prelevement") },
  );

  const db = forOrganization(reservation.organizationId);
  await db.payment.update({
    where: { id: paiement.id },
    data: {
      status: "CAPTURED",
      capturedAt: new Date(),
      capturedAmountCents: capturee.amount_received,
    },
  });

  /*
   * Un prélèvement qui passe peut sortir le client du recouvrement — et lui
   * seul le peut, puisque c'est un échec de prélèvement qui l'y a mis. La
   * fonction relit l'état complet avant de lever : régler un impayé sur deux
   * ne dégèle rien.
   *
   * Hors du chemin d'erreur de la capture, et volontairement : la capture est
   * passée chez Stripe, l'argent a bougé. Faire échouer le travail parce qu'un
   * email n'est pas parti représenterait un prélèvement réussi comme un échec,
   * et le passage suivant le rejouerait.
   */
  try {
    await leverLeRecouvrement(reservation.clientProfileId);
  } catch (erreur) {
    console.error("Levée de recouvrement échouée", erreur);
  }
}

async function liberer(
  reservation: { id: string; organizationId: string },
  paiement: { id: string; stripePaymentIntentId: string | null },
): Promise<void> {
  if (!paiement.stripePaymentIntentId) return;

  await stripe().paymentIntents.cancel(
    paiement.stripePaymentIntentId,
    {},
    { idempotencyKey: cleDIdempotence(reservation.id, "liberation") },
  );

  const db = forOrganization(reservation.organizationId);
  await db.payment.update({
    where: { id: paiement.id },
    data: { status: "CANCELLED" },
  });
}
