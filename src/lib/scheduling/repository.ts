import "server-only";

import type { TenantClient } from "@/lib/db";

import { computeAvailability } from "./availability";
import type { Interval } from "./intervals";
import type { CleanerSchedule, RoundStop } from "./slots";
import { type GeoPoint, type TravelMatrix } from "./travel";
import { resolveTravelMatrix } from "./travel-cache";

/**
 * Chargement de l'instantané de planning.
 *
 * Frontière entre la base et le moteur, qui reste pur. Tout ce qui est lu ici
 * l'est à travers un client déjà cloisonné : une société cliente du SaaS ne
 * doit jamais voir les disponibilités des intervenants d'une autre, alors même
 * qu'elles se disputent le même territoire.
 *
 * Le chargement est fait en une passe pour toute la fenêtre, pas commune par
 * commune : une recherche de créneaux sur quinze jours interrogerait sinon la
 * base des centaines de fois pour reconstituer ce qu'une requête suffit à
 * ramener.
 */

/**
 * Statuts d'affectation qui bloquent réellement le planning.
 *
 * **Seul l'accepté bloque**, et c'est la même règle que celle de la contrainte
 * d'exclusion — le dépôt exige que le moteur et la base soient d'accord, faute
 * de quoi l'un propose ce que l'autre refuse.
 *
 * Une proposition en attente ne bloque plus. C'était l'inverse tant qu'une
 * mission était attribuée à une seule personne : elle pouvait accepter d'une
 * seconde à l'autre, et proposer le même créneau ailleurs fabriquait le conflit.
 * Depuis la diffusion par lots, la même mission est proposée à cinq personnes
 * et personne ne détient rien : compter une proposition comme du temps occupé
 * retirerait de la circulation cinq plannings pour une seule mission, et
 * empêcherait un intervenant de recevoir deux offres concurrentes — c'est-à-dire
 * de choisir.
 *
 * Les statuts terminaux libèrent, comme avant : sans quoi l'historique gèlerait
 * le planning.
 */
const BLOCKING_ASSIGNMENT_STATUSES = ["ACCEPTED"] as const;

/** Statuts d'intervenant autorisés à recevoir une mission. */
const ASSIGNABLE_CLEANER_STATUSES = ["ACTIVE"] as const;

export interface ScheduleSnapshotOptions {
  window: Interval;
  /** Restreint aux intervenants donnés. Sinon, tous ceux qui sont actifs. */
  cleanerProfileIds?: readonly string[];
  /** Intervenant attitré du client, s'il en a un. */
  preferredCleanerProfileId?: string | null;
  /** Durée minimale d'une mission, pour écarter les fragments inutilisables. */
  minimumSlotMinutes?: number;
}

/**
 * Reconstitue, pour chaque intervenant, sa disponibilité et sa tournée.
 *
 * La disponibilité renvoyée est déjà nette de tout : règles hebdomadaires,
 * absences, ouvertures exceptionnelles, agenda externe et missions Léo Clean
 * avec leurs tampons de trajet. C'est `computeAvailability` qui l'établit — le
 * même code que celui testé sans base.
 */
export async function loadCleanerSchedules(
  db: TenantClient,
  options: ScheduleSnapshotOptions,
): Promise<CleanerSchedule[]> {
  const from = new Date(options.window.start);
  const to = new Date(options.window.end);

  const cleaners = await db.cleanerProfile.findMany({
    where: {
      status: { in: [...ASSIGNABLE_CLEANER_STATUSES] },
      ...(options.cleanerProfileIds
        ? { id: { in: [...options.cleanerProfileIds] } }
        : {}),
    },
    include: {
      homeAddress: { select: { lat: true, lng: true } },
      availabilityRules: {
        where: {
          validFrom: { lt: to },
          OR: [{ validUntil: null }, { validUntil: { gt: from } }],
        },
      },
      availabilityExceptions: {
        where: { startAt: { lt: to }, endAt: { gt: from } },
      },
      externalBusyBlocks: {
        where: { startAt: { lt: to }, endAt: { gt: from } },
        select: { startAt: true, endAt: true },
      },
      assignments: {
        where: {
          status: { in: [...BLOCKING_ASSIGNMENT_STATUSES] },
          blockStartAt: { lt: to },
          blockEndAt: { gt: from },
        },
        select: {
          startAt: true,
          endAt: true,
          travelMinutesBefore: true,
          travelMinutesAfter: true,
          booking: {
            select: { address: { select: { lat: true, lng: true } } },
          },
        },
        orderBy: { startAt: "asc" },
      },
    },
  });

  return cleaners.map((cleaner) => {
    const availability = computeAvailability({
      window: options.window,
      rules: cleaner.availabilityRules.map((rule) => ({
        weekday: rule.weekday,
        startMinute: rule.startMinute,
        endMinute: rule.endMinute,
        validFrom: rule.validFrom,
        validUntil: rule.validUntil,
      })),
      exceptions: cleaner.availabilityExceptions.map((exception) => ({
        type: exception.type,
        start: exception.startAt,
        end: exception.endAt,
      })),
      externalBusy: cleaner.externalBusyBlocks.map((block) => ({
        start: block.startAt.getTime(),
        end: block.endAt.getTime(),
      })),
      assignments: cleaner.assignments.map((assignment) => ({
        start: assignment.startAt,
        end: assignment.endAt,
        travelMinutesBefore: assignment.travelMinutesBefore,
        travelMinutesAfter: assignment.travelMinutesAfter,
      })),
      minimumSlotMinutes: options.minimumSlotMinutes,
    });

    const stops: RoundStop[] = cleaner.assignments.map((assignment) => ({
      start: assignment.startAt,
      end: assignment.endAt,
      point: {
        lat: assignment.booking.address.lat,
        lng: assignment.booking.address.lng,
      },
    }));

    return {
      cleanerProfileId: cleaner.id,
      homePoint: cleaner.homeAddress
        ? { lat: cleaner.homeAddress.lat, lng: cleaner.homeAddress.lng }
        : null,
      maxTravelMinutes: cleaner.maxTravelMinutes,
      availability,
      stops,
      ratingAverage: cleaner.ratingAverage,
      ratingCount: cleaner.ratingCount,
      acceptanceRate: cleaner.acceptanceRate,
      assignedMinutesInPeriod: stops.reduce(
        (total, entry) =>
          total + (entry.end.getTime() - entry.start.getTime()) / 60_000,
        0,
      ),
      isPreferred:
        options.preferredCleanerProfileId != null &&
        cleaner.id === options.preferredCleanerProfileId,
    };
  });
}

/**
 * Tous les points géographiques qu'une recherche de créneaux devra relier.
 *
 * Extraits des plannings plutôt que devinés : c'est cette liste qui détermine
 * ce que le cache de trajets doit résoudre, et en résoudre plus serait payer
 * des appels pour des itinéraires que personne ne parcourra.
 */
export function pointsOf(schedules: readonly CleanerSchedule[]): GeoPoint[] {
  return schedules.flatMap((schedule) => [
    ...(schedule.homePoint ? [schedule.homePoint] : []),
    ...schedule.stops.map((stop) => stop.point),
  ]);
}

/** Charge les plannings et la matrice de trajets nécessaires à une recherche. */
export async function loadSchedulingContext(
  db: TenantClient,
  options: ScheduleSnapshotOptions & { destination: GeoPoint },
): Promise<{ schedules: CleanerSchedule[]; travel: TravelMatrix }> {
  const schedules = await loadCleanerSchedules(db, options);
  const travel = await resolveTravelMatrix(
    pointsOf(schedules),
    options.destination,
  );
  return { schedules, travel };
}
