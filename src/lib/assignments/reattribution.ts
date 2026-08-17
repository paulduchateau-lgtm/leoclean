import "server-only";

import { responseDeadline } from "@/lib/booking/create";
import { isConcurrentSlotWrite } from "@/lib/booking/errors";
import type { TenantClient } from "@/lib/db";
import { loadCleanerSchedules, pointsOf } from "@/lib/scheduling/repository";
import { type SlotCandidate, evaluateSlot } from "@/lib/scheduling/slots";
import type { TravelMatrix } from "@/lib/scheduling/travel";
import { resolveTravelMatrix } from "@/lib/scheduling/travel-cache";

/**
 * Réattribution d'une mission refusée.
 *
 * Un refus ne peut pas se contenter de marquer l'affectation : il laisserait
 * une réservation sans intervenant, c'est-à-dire un client qui attend
 * quelqu'un qui ne viendra pas. C'est précisément ce que `createBooking`
 * s'interdit déjà en essayant le candidat suivant quand la base refuse un
 * créneau ; le refus humain mérite le même traitement que le refus technique.
 *
 * Le moteur est rejoué à l'identique — plannings du jour, temps de trajet
 * réels, réévaluation du créneau, classement par score — à une exception près :
 * les intervenants qui ont déjà décliné sont écartés. Sans cela, on
 * reproposerait la mission à celui qui vient de la refuser.
 *
 * La fonction ne décide pas du sort de la réservation quand personne ne reste :
 * elle rend `null` et laisse l'appelant, qui seul connaît le contexte, écrire
 * le statut et l'événement correspondants.
 */

export interface ReattributionInput {
  bookingId: string;
  /** Profils à ne pas reproposer : ceux qui ont déjà répondu non. */
  exclureCleanerProfileIds: readonly string[];
  /**
   * Restreint la recherche à ces profils, quand l'intervenant est déjà connu.
   *
   * C'est le cas d'une contre-proposition validée par le client : la question
   * n'est plus « qui ? » mais « celui-là est-il encore libre ? ». On réutilise
   * malgré tout tout le chemin — temps de trajet réels, tampons, et surtout la
   * contrainte d'exclusion à l'écriture, seule autorité sur les conflits.
   */
  limiterAuxCleanerProfileIds?: readonly string[];
  now: Date;
  /** Injectable pour les tests, comme dans le reste du moteur. */
  travel?: TravelMatrix;
}

export interface ReattributionResult {
  assignmentId: string;
  cleanerProfileId: string;
  travelMinutesBefore: number;
  travelMinutesAfter: number;
}

/**
 * Candidats classés pour une mission, sans rien écrire.
 *
 * Extrait de `reattribuer` le jour où la diffusion par lots en a eu besoin :
 * élargir au secteur, c'est proposer à tous ceux qui restent, et c'est
 * exactement ce classement-là — mêmes plannings, mêmes temps de trajet réels,
 * même score. Deux chemins qui reconstitueraient chacun leur classement
 * finiraient par ne plus proposer les mêmes gens.
 */
export async function classerCandidats(
  db: TenantClient,
  input: {
    bookingId: string;
    exclureCleanerProfileIds: readonly string[];
    limiterAuxCleanerProfileIds?: readonly string[];
    now: Date;
    travel?: TravelMatrix;
  },
): Promise<{
  booking: {
    scheduledStart: Date;
    scheduledEnd: Date;
    durationMinutes: number;
  };
  candidats: SlotCandidate[];
}> {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: input.bookingId },
    select: {
      scheduledStart: true,
      scheduledEnd: true,
      durationMinutes: true,
      address: { select: { lat: true, lng: true } },
    },
  });

  const destination = {
    lat: booking.address.lat,
    lng: booking.address.lng,
  };

  /*
   * La fenêtre est celle de la journée de la mission, comme à la création :
   * c'est tout ce qu'il faut pour reconstituer la tournée, et interroger plus
   * large ferait remonter des missions sans influence sur cette insertion.
   */
  const window = {
    start: booking.scheduledStart.getTime() - 12 * 3_600_000,
    end: booking.scheduledEnd.getTime() + 12 * 3_600_000,
  };

  const schedules = (
    await loadCleanerSchedules(db, {
      window,
      minimumSlotMinutes: booking.durationMinutes,
    })
  ).filter(
    (schedule) =>
      !input.exclureCleanerProfileIds.includes(schedule.cleanerProfileId) &&
      (input.limiterAuxCleanerProfileIds === undefined ||
        input.limiterAuxCleanerProfileIds.includes(schedule.cleanerProfileId)),
  );

  if (schedules.length === 0) {
    return { booking, candidats: [] };
  }

  const travel =
    input.travel ??
    (await resolveTravelMatrix(pointsOf(schedules), destination));

  const candidats = schedules
    .map((schedule) =>
      evaluateSlot(
        schedule,
        {
          window,
          durationMinutes: booking.durationMinutes,
          destination,
          travel,
          now: input.now,
          // Le délai de prévenance a été appliqué au moment où le client a
          // choisi son créneau. Le réappliquer ici ferait échouer toute
          // réattribution proche de l'échéance, c'est-à-dire celles qui
          // pressent le plus.
          leadTimeMinutes: 0,
        },
        booking.scheduledStart.getTime(),
      ),
    )
    .filter((candidat) => candidat !== null)
    .sort((a, b) => b.score - a.score);

  return { booking, candidats };
}

export async function reattribuer(
  db: TenantClient,
  organization: { id: string },
  input: ReattributionInput,
): Promise<ReattributionResult | null> {
  const { booking, candidats } = await classerCandidats(db, input);

  /*
   * Même parcours qu'à la création : on descend le classement jusqu'à ce que
   * la base accepte. La lecture des disponibilités ne voit pas les
   * transactions en cours, seule l'écriture les rencontre.
   */
  for (const chosen of candidats) {
    try {
      const assignment = await db.assignment.create({
        data: {
          organizationId: organization.id,
          bookingId: input.bookingId,
          cleanerProfileId: chosen.cleanerProfileId,
          status: "PROPOSED",
          startAt: booking.scheduledStart,
          endAt: booking.scheduledEnd,
          blockStartAt: new Date(
            booking.scheduledStart.getTime() -
              chosen.travelMinutesBefore * 60_000,
          ),
          blockEndAt: new Date(
            booking.scheduledEnd.getTime() + chosen.travelMinutesAfter * 60_000,
          ),
          travelMinutesBefore: chosen.travelMinutesBefore,
          travelMinutesAfter: chosen.travelMinutesAfter,
          score: chosen.score,
          scoreBreakdown: chosen.breakdown,
          proposedAt: input.now,
          respondBy: responseDeadline(booking.scheduledStart, input.now),
        },
        select: { id: true },
      });

      return {
        assignmentId: assignment.id,
        cleanerProfileId: chosen.cleanerProfileId,
        travelMinutesBefore: chosen.travelMinutesBefore,
        travelMinutesAfter: chosen.travelMinutesAfter,
      };
    } catch (error) {
      if (isConcurrentSlotWrite(error)) {
        continue;
      }
      throw error;
    }
  }

  return null;
}
