import "server-only";

import type { TenantClient } from "@/lib/db";

/**
 * Droit à l'effacement, et ses limites.
 *
 * L'article 17 du RGPD ouvre un droit à l'effacement, mais son paragraphe 3
 * le écarte quand le traitement est nécessaire au respect d'une obligation
 * légale. Or le code de commerce impose de conserver dix ans les documents
 * comptables : **une facture émise ne s'efface pas.** Promettre le contraire
 * serait plus grave que de le refuser, parce que la promesse serait tenue à
 * l'écran et démentie en base.
 *
 * D'où une distinction assumée, et écrite noir sur blanc à l'intention de la
 * personne avant qu'elle ne confirme :
 *
 * - **Effacé** : ce qui n'a d'utilité que pour rendre le service — adresses,
 *   consignes d'accès, téléphone, notes, commentaires, demandes de rappel,
 *   sessions et connexions.
 * - **Conservé, détaché de l'identité** : les montants, les factures et les
 *   réservations qui les portent. Ils restent, mais plus rien ne les relie à un
 *   nom ni à une adresse email réelle.
 *
 * L'identité est neutralisée plutôt que supprimée : effacer la ligne `User`
 * emporterait en cascade les réservations, donc la comptabilité. On remplace
 * donc l'email par un jeton qui n'appartient à personne, sur un domaine
 * réservé — `.invalid` ne peut pas être enregistré, et aucun message ne partira
 * jamais vers cette adresse par erreur.
 */

export interface ResultatEffacement {
  sessionsRevoquees: number;
  adressesEffacees: number;
  demandesEffacees: number;
  avisAnonymises: number;
  messagesEffaces: number;
  reservationsConservees: number;
  facturesConservees: number;
}

/** Adresse de remplacement, sur un domaine que personne ne peut posséder. */
export function emailNeutralise(userId: string): string {
  return `supprime-${userId}@leoclean.invalid`;
}

export async function effacerDonnees(
  db: TenantClient,
  organizationId: string,
  user: { id: string; email: string },
  maintenant: Date = new Date(),
): Promise<ResultatEffacement> {
  const profil = await db.clientProfile.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });

  return db.$transaction(async (tx) => {
    /*
     * Les sessions d'abord.
     *
     * Elles vivent en base précisément pour pouvoir être révoquées sur-le-champ
     * plutôt qu'attendre l'expiration d'un jeton signé. Une suppression de
     * compte qui laisserait la personne connectée n'en serait pas une.
     */
    const sessions = await tx.session.deleteMany({
      where: { userId: user.id },
    });
    await tx.account.deleteMany({ where: { userId: user.id } });

    const messages = await tx.message.deleteMany({
      where: { senderUserId: user.id },
    });

    // Les demandes de rappel précèdent le compte : elles se rattachent par
    // l'adresse email, seul lien qui existe.
    const demandes = await tx.lead.deleteMany({
      where: { email: user.email.toLowerCase() },
    });

    let adresses = { count: 0 };
    let avis = { count: 0 };
    let reservations = 0;

    if (profil) {
      /*
       * Les adresses des réservations passées sont vidées de ce qui identifie
       * un foyer, mais la ligne subsiste : une facture renvoie à une
       * prestation, qui renvoie à un lieu. On garde la commune, qui suffit à
       * justifier une TVA territoriale et n'identifie personne.
       */
      adresses = await tx.address.updateMany({
        where: { clientProfileId: profil.id },
        data: {
          street: "Adresse effacée",
          complement: null,
          accessNotes: null,
          floor: null,
          banId: null,
        },
      });

      // La note chiffrée reste — elle alimente la moyenne d'un intervenant,
      // qui est sa donnée à lui. Le commentaire, lui, est du texte libre écrit
      // par la personne : il part.
      avis = await tx.review.updateMany({
        where: { clientProfileId: profil.id },
        data: { comment: null, isPublic: false },
      });

      reservations = await tx.booking.count({
        where: { clientProfileId: profil.id },
      });
      await tx.booking.updateMany({
        where: { clientProfileId: profil.id },
        data: { clientNotes: null },
      });

      await tx.clientProfile.update({
        where: { id: profil.id },
        data: { phone: null, accessNotes: null },
      });
    }

    const factures = profil
      ? await tx.invoice.count({
          where: { booking: { clientProfileId: profil.id } },
        })
      : 0;

    await tx.user.update({
      where: { id: user.id },
      data: {
        email: emailNeutralise(user.id),
        name: null,
        emailVerified: null,
        image: null,
      },
    });

    /*
     * L'effacement est lui-même journalisé, sans donnée personnelle : c'est ce
     * qui permet de prouver qu'il a eu lieu, ce que le règlement demande à
     * celui qui traite les données. Le journal ne porte que l'identifiant
     * technique, désormais orphelin.
     */
    await tx.auditLog.create({
      data: {
        organizationId,
        actorUserId: null,
        action: "rgpd.effacement",
        entityType: "User",
        entityId: user.id,
        metadata: {
          effectueLe: maintenant.toISOString(),
          reservationsConservees: reservations,
          facturesConservees: factures,
        },
      },
    });

    return {
      sessionsRevoquees: sessions.count,
      adressesEffacees: adresses.count,
      demandesEffacees: demandes.count,
      avisAnonymises: avis.count,
      messagesEffaces: messages.count,
      reservationsConservees: reservations,
      facturesConservees: factures,
    };
  });
}
