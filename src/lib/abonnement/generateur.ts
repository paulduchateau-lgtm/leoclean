import "server-only";

import { forOrganization, prisma } from "@/lib/db";
import { createBooking } from "@/lib/booking/create";
import { surfaceForDuration } from "@/lib/pricing/duration";

import {
  HORIZON_JOURS,
  type Rythme,
  prochainesOccurrences,
} from "./recurrence";

/**
 * Le générateur de récurrence.
 *
 * Il transforme un abonnement en réservations réelles jusqu'à l'horizon, et
 * c'est ce qui fait la différence entre « un client qui reprend rendez-vous »
 * et « un client abonné ». Sans lui, `Subscription` n'était qu'une intention.
 *
 * **Idempotent par construction.** On ne compte pas les occurrences déjà
 * créées : on regarde, pour chaque instant calculé, s'il existe déjà une
 * réservation vivante de cet abonnement à cette heure-là. Un ordonnanceur qui
 * repasse toutes les heures ne doit pas produire vingt-quatre ménages par jour,
 * et compter serait faux dès la première annulation.
 */

export interface RapportGeneration {
  abonnementsExamines: number;
  reservationsCreees: number;
  echecs: { subscriptionId: string; motif: string }[];
}

/**
 * Statuts qui « occupent » une occurrence.
 *
 * Une réservation annulée ne compte pas : le client qui annule un passage doit
 * pouvoir en obtenir un autre à la même heure la fois suivante. Mais une
 * réservation en recherche compte, sans quoi on relancerait une diffusion
 * concurrente sur la même heure.
 */
const STATUTS_VIVANTS = [
  "PENDING_ASSIGNMENT",
  "ASSIGNED",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export async function genererLesRecurrences(
  maintenant: Date = new Date(),
): Promise<RapportGeneration> {
  const rapport: RapportGeneration = {
    abonnementsExamines: 0,
    reservationsCreees: 0,
    echecs: [],
  };

  /*
   * Lecture non cloisonnée, comme l'ordonnanceur des échéances : le travail
   * planifié traverse les organisations par nature, et l'écriture repasse
   * ensuite par un client cloisonné.
   */
  const abonnements = await prisma.subscription.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      organizationId: true,
      clientProfileId: true,
      addressId: true,
      serviceId: true,
      frequency: true,
      weekday: true,
      startMinute: true,
      durationMinutes: true,
      weekOfMonth: true,
      anchorDate: true,
      pausedUntil: true,
      preferredCleanerId: true,
      service: {
        select: { slug: true, sqmPerHour: true, minDurationMinutes: true },
      },
      address: { select: { id: true } },
    },
  });

  for (const abonnement of abonnements) {
    rapport.abonnementsExamines += 1;

    /*
     * `ONE_OFF` n'a rien à générer, et ne devrait pas exister ici : on le
     * traite quand même plutôt que de supposer, un abonnement ponctuel étant
     * exactement le genre de ligne qu'une migration produit par accident.
     */
    if (abonnement.frequency === "ONE_OFF") continue;

    const occurrences = prochainesOccurrences(
      {
        rythme: abonnement.frequency as Rythme,
        jourSemaine: abonnement.weekday,
        minuteDebut: abonnement.startMinute,
        semaineDuMois: abonnement.weekOfMonth,
        ancrage: abonnement.anchorDate,
      },
      maintenant,
      HORIZON_JOURS,
      /*
       * Une pause troue la série sans la décaler. Elle est décrite ici comme
       * une période allant de maintenant à `pausedUntil` : c'est la forme que
       * la base porte, et la traduire ailleurs ferait deux vérités.
       */
      abonnement.pausedUntil
        ? { debut: maintenant, fin: abonnement.pausedUntil }
        : null,
    );

    for (const debut of occurrences) {
      const existante = await prisma.booking.findFirst({
        where: {
          subscriptionId: abonnement.id,
          scheduledStart: debut,
          status: { in: [...STATUTS_VIVANTS] },
        },
        select: { id: true },
      });
      if (existante) continue;

      try {
        const db = forOrganization(abonnement.organizationId);
        await createBooking(
          db,
          { id: abonnement.organizationId },
          {
            organizationId: abonnement.organizationId,
            clientProfileId: abonnement.clientProfileId,
            addressId: abonnement.addressId,
            serviceSlug: abonnement.service.slug,
            optionSlugs: [],
            /*
             * La surface se déduit de la durée déjà retenue : c'est la durée
             * qui a été vendue, et la recalculer depuis une surface la ferait
             * dériver d'un passage à l'autre.
             */
            surfaceSqm: surfaceForDuration(abonnement.durationMinutes, {
              sqmPerHour: abonnement.service.sqmPerHour,
              minDurationMinutes: abonnement.service.minDurationMinutes,
            }),
            durationOverrideMinutes: abonnement.durationMinutes,
            frequency: abonnement.frequency,
            scheduledStart: debut,
            subscriptionId: abonnement.id,
            preferredCleanerProfileId: abonnement.preferredCleanerId,
            source: "LEOCLEAN",
            now: maintenant,
          },
        );
        rapport.reservationsCreees += 1;
      } catch (erreur) {
        /*
         * Un abonnement dont l'occurrence ne trouve personne ne doit pas
         * arrêter les autres : chaque échec est relevé et la boucle continue.
         * C'est la même règle que pour les échéances, et pour la même raison —
         * un travail planifié qui s'arrête à la première difficulté ne traite
         * jamais la suite de la liste.
         */
        rapport.echecs.push({
          subscriptionId: abonnement.id,
          motif: erreur instanceof Error ? erreur.message : "inconnu",
        });
      }
    }
  }

  return rapport;
}
