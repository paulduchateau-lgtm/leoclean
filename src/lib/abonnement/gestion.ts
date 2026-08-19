import "server-only";

import { BusinessError } from "@/lib/booking/errors";
import type { TenantClient } from "@/lib/db";

import {
  MESSAGES_PAUSE,
  type MotifResiliation,
  propositionDeRetention,
  verifierPause,
} from "./recurrence";

/**
 * Ce qu'un client fait de son abonnement.
 *
 * `recurrence.ts` décide, ce module écrit. Trois gestes, et leur ordre à
 * l'écran n'est pas indifférent : **la pause vient avant la résiliation, et
 * elle est plus visible**. C'est le principal outil anti-résiliation, et le
 * rendre plus difficile à trouver que le bouton qui fait tout perdre serait un
 * choix contre le client autant que contre l'entreprise.
 */

export class GestionRefuseeError extends BusinessError {}

export interface AbonnementVue {
  id: string;
  frequence: string;
  jourSemaine: number;
  minuteDebut: number;
  dureeMinutes: number;
  statut: string;
  enPauseJusquA: string | null;
  intervenantAttitre: string | null;
  prochainesDates: string[];
}

/** Les abonnements du client de la session. */
export async function lireAbonnements(
  db: TenantClient,
  clientProfileId: string,
): Promise<AbonnementVue[]> {
  const abonnements = await db.subscription.findMany({
    where: { clientProfileId, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      frequency: true,
      weekday: true,
      startMinute: true,
      durationMinutes: true,
      status: true,
      pausedUntil: true,
      preferredCleaner: { select: { displayName: true } },
      bookings: {
        where: { scheduledStart: { gt: new Date() }, status: { not: "CANCELLED_BY_CLIENT" } },
        orderBy: { scheduledStart: "asc" },
        take: 3,
        select: { scheduledStart: true },
      },
    },
  });

  return abonnements.map((abonnement) => ({
    id: abonnement.id,
    frequence: abonnement.frequency,
    jourSemaine: abonnement.weekday,
    minuteDebut: abonnement.startMinute,
    dureeMinutes: abonnement.durationMinutes,
    statut: abonnement.status,
    enPauseJusquA: abonnement.pausedUntil?.toISOString() ?? null,
    intervenantAttitre: abonnement.preferredCleaner?.displayName ?? null,
    prochainesDates: abonnement.bookings.map((b) =>
      b.scheduledStart.toISOString(),
    ),
  }));
}

/**
 * Met un abonnement en pause.
 *
 * **Les réservations déjà créées dans la période sont annulées**, et c'est
 * indispensable : le générateur ne les recréera pas, mais il ne les efface pas
 * non plus. Les laisser ferait venir quelqu'un pendant les vacances du client.
 *
 * L'information donnée est honnête : l'intervenant peut être réaffecté pendant
 * la pause. Promettre de le retrouver serait une promesse qu'on ne tient pas.
 */
export async function mettreEnPause(
  db: TenantClient,
  subscriptionId: string,
  clientProfileId: string,
  periode: { debut: Date; fin: Date },
  maintenant: Date = new Date(),
): Promise<{ reservationsAnnulees: number }> {
  const refus = verifierPause(periode, maintenant);
  if (refus) throw new GestionRefuseeError(MESSAGES_PAUSE[refus]);

  const abonnement = await db.subscription.findFirst({
    where: { id: subscriptionId, clientProfileId },
    select: { id: true, organizationId: true },
  });
  if (!abonnement) {
    throw new GestionRefuseeError("Cet abonnement n'existe pas.");
  }

  return db.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: abonnement.id },
      data: { status: "PAUSED", pausedUntil: periode.fin },
    });

    const concernees = await tx.booking.findMany({
      where: {
        subscriptionId: abonnement.id,
        scheduledStart: { gte: periode.debut, lt: periode.fin },
        status: { in: ["PENDING_ASSIGNMENT", "ASSIGNED", "CONFIRMED"] },
      },
      select: { id: true, status: true },
    });

    for (const reservation of concernees) {
      await tx.booking.update({
        where: { id: reservation.id },
        data: {
          status: "CANCELLED_BY_CLIENT",
          cancelledAt: maintenant,
          cancellationReason: "Abonnement mis en pause",
        },
      });
      /*
       * Les affectations en cours sont closes avec la réservation : la
       * contrainte d'exclusion ignore les statuts terminaux, si bien qu'une
       * affectation restée `ACCEPTED` gèlerait une heure pour une intervention
       * qui n'a plus lieu. C'est la même leçon que l'annulation client.
       */
      await tx.assignment.updateMany({
        where: {
          bookingId: reservation.id,
          status: { in: ["PROPOSED", "ACCEPTED"] },
        },
        data: { status: "CANCELLED" },
      });
      await tx.bookingStatusEvent.create({
        data: {
          organizationId: abonnement.organizationId,
          bookingId: reservation.id,
          fromStatus: reservation.status,
          toStatus: "CANCELLED_BY_CLIENT",
          reason: "Abonnement mis en pause",
        },
      });
    }

    return { reservationsAnnulees: concernees.length };
  });
}

export async function reprendre(
  db: TenantClient,
  subscriptionId: string,
  clientProfileId: string,
): Promise<void> {
  const { count } = await db.subscription.updateMany({
    where: { id: subscriptionId, clientProfileId, status: "PAUSED" },
    data: { status: "ACTIVE", pausedUntil: null },
  });
  if (count === 0) {
    throw new GestionRefuseeError("Cet abonnement n'est pas en pause.");
  }
}

/**
 * Résilie un abonnement.
 *
 * **Aucun frein artificiel** : pas d'appel obligatoire, pas de délai caché, pas
 * d'étape non numérique. Le motif est recueilli parce qu'il décide de ce qu'on
 * propose — et la proposition est faite **avant** la confirmation, une fois,
 * sans insister. Proposer une remise à quelqu'un qui déménage transformerait un
 * départ neutre en mauvais souvenir.
 */
export async function resilier(
  db: TenantClient,
  subscriptionId: string,
  clientProfileId: string,
  motif: MotifResiliation,
  maintenant: Date = new Date(),
): Promise<{ proposition: string | null }> {
  const abonnement = await db.subscription.findFirst({
    where: { id: subscriptionId, clientProfileId },
    select: { id: true },
  });
  if (!abonnement) {
    throw new GestionRefuseeError("Cet abonnement n'existe pas.");
  }

  await db.subscription.update({
    where: { id: abonnement.id },
    data: {
      status: "CANCELLED",
      cancelledAt: maintenant,
      pausedUntil: null,
    },
  });

  /*
   * Les réservations à venir ne sont **pas** annulées d'office. Résilier un
   * abonnement, c'est cesser d'en générer ; le rendez-vous de la semaine
   * prochaine reste dû, et l'annuler d'office ferait perdre au client une date
   * qu'il comptait peut-être honorer. Il l'annule séparément s'il le souhaite,
   * avec le barème qui s'applique.
   */

  return { proposition: propositionDeRetention(motif) };
}
