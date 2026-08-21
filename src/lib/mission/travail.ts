import "server-only";

import { BusinessError } from "@/lib/booking/errors";
import type { TenantClient } from "@/lib/db";
import { annoncerLaFinDIntervention } from "@/lib/notifications/evenements";

import {
  type SensPointage,
  MESSAGES_POINTAGE,
  type TypeAnomalie,
  dureeReelleMinutes,
  methodePointage,
  peutProposerUnAjustement,
  rapportComplet,
  verifierPointage,
} from "./cycle";

/**
 * L'écriture du travail de mission.
 *
 * `cycle.ts` décide, ce module écrit. La séparation n'est pas cosmétique : elle
 * permet de tester un pointage forcé ou une fin sans photo en quelques
 * millisecondes, et elle garde le passage en `COMPLETED` — la transition qui
 * déclenche facture, avis et reversement — dans une seule transaction.
 */

export class PointageRefuseError extends BusinessError {}

/** L'affectation acceptée de cette personne sur cette mission, ou rien. */
async function affectationAcceptee(
  db: TenantClient,
  bookingId: string,
  cleanerProfileId: string,
) {
  return db.assignment.findFirst({
    where: { bookingId, cleanerProfileId, status: "ACCEPTED" },
    select: { id: true },
  });
}

export interface Pointage {
  bookingId: string;
  cleanerProfileId: string;
  sens: SensPointage;
  position: { lat: number; lng: number } | null;
  codeClientFourni?: boolean;
  /** Instant relevé par l'appareil, quand le pointage a été fait hors ligne. */
  deviceAt?: Date | null;
}

/**
 * Pointe une arrivée ou un départ.
 *
 * Le départ fait basculer la réservation en `COMPLETED` **dans la même
 * transaction** que le pointage : une mission dont le pointage serait écrit
 * sans que le statut suive laisserait le client sans rapport et l'intervenant
 * sans reversement, et l'écart ne se verrait qu'à la lecture.
 */
export async function pointer(
  db: TenantClient,
  organizationId: string,
  input: Pointage,
  maintenant: Date,
): Promise<{ dureeReelleMinutes: number | null; rapportComplet: boolean }> {
  const affectation = await affectationAcceptee(
    db,
    input.bookingId,
    input.cleanerProfileId,
  );

  const booking = await db.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      scheduledStart: true,
      durationMinutes: true,
      address: { select: { lat: true, lng: true } },
    },
  });
  if (!booking) throw new PointageRefuseError("Cette mission n'existe pas.");

  const pointages = await db.missionCheck.findMany({
    where: { bookingId: input.bookingId },
    select: { kind: true, at: true, deviceAt: true },
  });
  const arrivee = pointages.find((p) => p.kind === "ARRIVEE");
  const depart = pointages.find((p) => p.kind === "DEPART");

  const refus = verifierPointage(
    input.sens,
    {
      affectee: Boolean(affectation),
      arriveeA: arrivee ? (arrivee.deviceAt ?? arrivee.at) : null,
      departA: depart ? (depart.deviceAt ?? depart.at) : null,
      debutPrevu: booking.scheduledStart,
    },
    /*
     * L'instant de l'appareil fait foi quand le pointage vient du mode hors
     * ligne : c'est celui où la personne était devant la porte. Le nôtre ne
     * dirait que l'heure de la reconnexion.
     */
    input.deviceAt ?? maintenant,
  );
  if (refus) throw new PointageRefuseError(MESSAGES_POINTAGE[refus]);

  const { methode, distanceMetres } = methodePointage({
    position: input.position,
    logement: { lat: booking.address.lat, lng: booking.address.lng },
    codeClientFourni: input.codeClientFourni ?? false,
    horsLigne: Boolean(input.deviceAt),
  });

  const instant = input.deviceAt ?? maintenant;

  if (input.sens === "ARRIVEE") {
    await db.$transaction(async (tx) => {
      await tx.missionCheck.create({
        data: {
          organizationId,
          bookingId: input.bookingId,
          cleanerProfileId: input.cleanerProfileId,
          kind: "ARRIVEE",
          at: instant,
          lat: input.position?.lat ?? null,
          lng: input.position?.lng ?? null,
          distanceMeters: distanceMetres,
          method: methode,
          deviceAt: input.deviceAt ?? null,
        },
      });
      await tx.booking.update({
        where: { id: input.bookingId },
        data: { status: "IN_PROGRESS" },
      });
      await tx.bookingStatusEvent.create({
        data: {
          organizationId,
          bookingId: input.bookingId,
          fromStatus: "CONFIRMED",
          toStatus: "IN_PROGRESS",
          reason: "Arrivée pointée par l'intervenant",
        },
      });
    });

    return { dureeReelleMinutes: null, rapportComplet: false };
  }

  const photos = await db.missionPhoto.groupBy({
    by: ["phase"],
    where: { bookingId: input.bookingId },
    _count: true,
  });
  const compte = {
    avant: photos.find((p) => p.phase === "AVANT")?._count ?? 0,
    apres: photos.find((p) => p.phase === "APRES")?._count ?? 0,
  };
  const complet = rapportComplet(compte);

  const debutReel = arrivee ? (arrivee.deviceAt ?? arrivee.at) : instant;
  const duree = dureeReelleMinutes(debutReel, instant);

  await db.$transaction(async (tx) => {
    await tx.missionCheck.create({
      data: {
        organizationId,
        bookingId: input.bookingId,
        cleanerProfileId: input.cleanerProfileId,
        kind: "DEPART",
        at: instant,
        lat: input.position?.lat ?? null,
        lng: input.position?.lng ?? null,
        distanceMeters: distanceMetres,
        method: methode,
        deviceAt: input.deviceAt ?? null,
      },
    });

    await tx.booking.update({
      where: { id: input.bookingId },
      data: {
        status: "COMPLETED",
        completedAt: instant,
        /*
         * La durée réelle est enregistrée, **jamais refacturée** : le montant
         * reste celui qui a été annoncé. Un ajustement passe par une anomalie
         * validée, et facturer autre chose que ce qui a été affiché serait un
         * changement de contrat.
         */
        actualMinutes: duree,
        reportComplete: complet,
      },
    });

    await tx.assignment.updateMany({
      where: { bookingId: input.bookingId, status: "ACCEPTED" },
      data: { status: "COMPLETED" },
    });

    await tx.bookingStatusEvent.create({
      data: {
        organizationId,
        bookingId: input.bookingId,
        fromStatus: "IN_PROGRESS",
        toStatus: "COMPLETED",
        reason: complet
          ? "Mission terminée"
          : "Mission terminée, rapport incomplet",
      },
    });
  });

  /*
   * Le client n'entendait plus rien entre la fin du ménage et le débit : ni le
   * rapport photo, ni l'invitation à noter, ni le montant à venir. L'annonce
   * part ici — après la transaction, hors d'elle, et sans être attendue, comme
   * toutes les autres : une messagerie en panne ne doit pas défaire une mission
   * close, ni empêcher l'intervenant de finir sa journée.
   *
   * Elle part **avant** le prélèvement, qui court à H+24. Le message écrit donc
   * « nous prélèverons », au futur.
   */
  void annoncerLaFinDIntervention(db, input.bookingId);

  return { dureeReelleMinutes: duree, rapportComplet: complet };
}

/** Coche ou décoche une tâche. Jamais bloquant, jamais reproché. */
export async function basculerTache(
  db: TenantClient,
  tacheId: string,
  bookingId: string,
  faite: boolean,
): Promise<void> {
  await db.missionChecklistItem.updateMany({
    where: { id: tacheId, bookingId },
    data: { doneAt: faite ? new Date() : null },
  });
}

export interface AnomalieSignalee {
  bookingId: string;
  type: TypeAnomalie;
  description?: string | null;
  storagePath?: string | null;
  proposedExtraMinutes?: number | null;
}

/**
 * Signale une anomalie.
 *
 * L'ajustement de durée n'est **proposé** que sur un logement inhabituellement
 * sale, et il reste en attente : un supplément appliqué unilatéralement par
 * celui qui en bénéficie n'est pas un ajustement, c'est une facture non
 * consentie.
 */
export async function signalerAnomalie(
  db: TenantClient,
  organizationId: string,
  input: AnomalieSignalee,
): Promise<{ anomalieId: string; ajustementProposé: boolean }> {
  const ajustement =
    peutProposerUnAjustement(input.type) &&
    (input.proposedExtraMinutes ?? 0) > 0;

  const creee = await db.missionAnomaly.create({
    data: {
      organizationId,
      bookingId: input.bookingId,
      type: input.type,
      description: input.description ?? null,
      storagePath: input.storagePath ?? null,
      proposedExtraMinutes: ajustement ? input.proposedExtraMinutes! : null,
      adjustmentStatus: ajustement ? "PENDING" : null,
    },
    select: { id: true },
  });

  return { anomalieId: creee.id, ajustementProposé: ajustement };
}
