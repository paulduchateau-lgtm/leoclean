import "server-only";

import { prisma } from "@/lib/db";
import { lienEspace, notifier } from "@/lib/notifications/envoi";

/**
 * Le rappel de notation.
 *
 * Une note se donne dans les jours qui suivent, ou jamais : passé une semaine,
 * le souvenir est reconstruit et la note dit surtout l'humeur du moment. Le
 * rappel part donc tôt — et **une seule fois**.
 *
 * **Une relance qui revient chaque jour n'obtient pas une note, elle obtient un
 * désabonnement.** `Booking.reviewReminderAt` est écrite avant l'envoi et vaut
 * marque autant que journal, exactement comme `Payment.lastReminderAt` pour les
 * impayés : l'ordonnanceur repasse toutes les heures, et sans elle le même
 * message partirait vingt-quatre fois par jour.
 */

/**
 * Délai avant le rappel, en heures.
 *
 * Vingt-quatre heures : assez pour ne pas doubler le mail de fin
 * d'intervention, qui invite déjà à noter et part à la clôture ; assez peu pour
 * que le passage soit encore frais.
 */
export const RAPPEL_AVIS_HEURES_APRES = 24;

/** Au-delà, on ne demande plus : le souvenir ne vaut plus la sollicitation. */
export const RAPPEL_AVIS_LIMITE_JOURS = 7;

export interface RapportRappelAvis {
  examines: number;
  envoyes: number;
  echecs: { bookingId: string; motif: string }[];
}

const QUAND = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

function prenomDe(nom: string | null): string {
  return nom?.trim().split(/\s+/)[0] || "";
}

export async function rappelerLesAvis(
  maintenant: Date = new Date(),
): Promise<RapportRappelAvis> {
  const rapport: RapportRappelAvis = { examines: 0, envoyes: 0, echecs: [] };

  const depuis = new Date(
    maintenant.getTime() - RAPPEL_AVIS_HEURES_APRES * 3_600_000,
  );
  const jusqua = new Date(
    maintenant.getTime() - RAPPEL_AVIS_LIMITE_JOURS * 86_400_000,
  );

  const reservations = await prisma.booking.findMany({
    where: {
      status: "COMPLETED",
      // Pas encore notée, et pas encore relancée.
      review: null,
      reviewReminderAt: null,
      completedAt: { lte: depuis, gte: jusqua },
    },
    take: 200,
    select: {
      id: true,
      scheduledStart: true,
      durationMinutes: true,
      grossAmountCents: true,
      address: { select: { street: true, cityName: true } },
      clientProfile: {
        select: { user: { select: { email: true, name: true } } },
      },
      assignments: {
        where: { status: { in: ["ACCEPTED", "COMPLETED"] } },
        take: 1,
        select: { cleaner: { select: { displayName: true } } },
      },
    },
  });

  for (const reservation of reservations) {
    rapport.examines += 1;

    try {
      /*
       * La marque est posée **avant** l'envoi. Une notification qui échoue ne
       * doit pas faire réessayer indéfiniment : le dépôt tient déjà qu'un
       * message perdu se journalise sans être rejoué, et une relance rejouée
       * toutes les heures serait pire que pas de relance du tout.
       */
      await prisma.booking.update({
        where: { id: reservation.id },
        data: { reviewReminderAt: maintenant },
      });
      rapport.envoyes += 1;

      await notifier(reservation.clientProfile.user.email, {
        type: "avis-attendu",
        prenom: prenomDe(reservation.clientProfile.user.name),
        intervenant:
          reservation.assignments[0]?.cleaner.displayName.split(" ")[0] ?? null,
        intervention: {
          quand: QUAND.format(reservation.scheduledStart),
          durationMinutes: reservation.durationMinutes,
          adresse: `${reservation.address.street}, ${reservation.address.cityName}`,
          grossAmountCents: reservation.grossAmountCents,
        },
        lienNotation: lienEspace(`/mon-espace/noter?booking=${reservation.id}`),
      });
    } catch (erreur) {
      rapport.echecs.push({
        bookingId: reservation.id,
        motif: erreur instanceof Error ? erreur.message : "inconnu",
      });
    }
  }

  return rapport;
}
