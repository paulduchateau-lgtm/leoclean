import "server-only";

import type { Frequency } from "@prisma/client";

import { quoteFromCatalogue } from "@/lib/catalogue";
import type { TenantClient } from "@/lib/db";
import { quoteToBookingAmounts } from "@/lib/pricing";
import { loadCleanerSchedules } from "@/lib/scheduling/repository";
import { evaluateSlot, findSlots } from "@/lib/scheduling/slots";
import type { GeoPoint, TravelMatrix } from "@/lib/scheduling/travel";
import { resolveTravelMatrix } from "@/lib/scheduling/travel-cache";
import { pointsOf } from "@/lib/scheduling/repository";

import {
  NoCleanerAvailableError,
  SlotTakenError,
  isConcurrentSlotWrite,
} from "./errors";

/**
 * Création d'une réservation.
 *
 * Trois choses doivent se produire ensemble ou pas du tout : la réservation, sa
 * ventilation en lignes facturables, et l'affectation de l'intervenant. Une
 * réservation sans affectation est un client qui attend quelqu'un qui ne
 * viendra pas ; une affectation sans réservation est une heure bloquée pour
 * rien. D'où la transaction.
 *
 * **Le verrou anti-double-réservation n'est pas ici.** Il est en base, dans la
 * contrainte d'exclusion `Assignment_no_overlap`. Vérifier la disponibilité
 * avant d'écrire ne sert qu'à donner un bon message : entre la vérification et
 * l'écriture, une autre requête peut passer. Ce code sait donc qu'il peut
 * échouer, et traduit ce refus en `SlotTakenError` plutôt qu'en incident.
 */

export interface CreateBookingInput {
  organizationId: string;
  clientProfileId: string;
  addressId: string;
  serviceSlug: string;
  optionSlugs?: readonly string[];
  surfaceSqm: number;
  frequency: Frequency;
  /** Début de la mission, en UTC. */
  scheduledStart: Date;
  durationOverrideMinutes?: number;
  clientNotes?: string | null;
  subscriptionId?: string | null;
  source?: "LEOCLEAN" | "ORG_PAGE" | "BACK_OFFICE";
  /** Intervenant attitré du client, privilégié par le score. */
  preferredCleanerProfileId?: string | null;
  /** Injection pour les tests : évite tout appel réseau. */
  travel?: TravelMatrix;
  now?: Date;
}

export interface CreatedBooking {
  bookingId: string;
  assignmentId: string;
  cleanerProfileId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  grossAmountCents: number;
  netAmountCents: number;
}

/**
 * Réserve un créneau et attribue un intervenant.
 *
 * L'attribution est automatique et se fait ici, pas plus tard : le client doit
 * repartir avec un rendez-vous ferme, pas avec une demande en attente. Le
 * meilleur intervenant selon le score reçoit la mission au statut `PROPOSED` —
 * la place est bloquée immédiatement, la réponse peut attendre.
 */
export async function createBooking(
  db: TenantClient,
  organization: { id: string; commissionRateBp: number },
  input: CreateBookingInput,
): Promise<CreatedBooking> {
  const now = input.now ?? new Date();

  const address = await db.address.findUniqueOrThrow({
    where: { id: input.addressId },
    select: { id: true, lat: true, lng: true },
  });
  const destination: GeoPoint = { lat: address.lat, lng: address.lng };

  const quote = await quoteFromCatalogue(db, organization, {
    serviceSlug: input.serviceSlug,
    optionSlugs: input.optionSlugs ?? [],
    surfaceSqm: input.surfaceSqm,
    frequency: input.frequency,
    durationOverrideMinutes: input.durationOverrideMinutes,
    at: now,
  });

  const scheduledEnd = new Date(
    input.scheduledStart.getTime() + quote.durationMinutes * 60_000,
  );

  // La fenêtre est bornée à la journée de la mission : c'est tout ce qu'il faut
  // pour reconstituer la tournée du jour, et interroger plus large ferait
  // remonter des missions sans influence sur cette insertion.
  const window = {
    start: input.scheduledStart.getTime() - 12 * 3_600_000,
    end: scheduledEnd.getTime() + 12 * 3_600_000,
  };

  const schedules = await loadCleanerSchedules(db, {
    window,
    preferredCleanerProfileId: input.preferredCleanerProfileId,
    minimumSlotMinutes: quote.durationMinutes,
  });

  const travel =
    input.travel ??
    (await resolveTravelMatrix(pointsOf(schedules), destination));

  // On réévalue le créneau demandé plutôt que de faire confiance à celui que le
  // client renvoie : entre l'affichage et la validation, un agenda a pu se
  // remplir, et le prix comme la durée ont pu changer.
  const candidates = schedules
    .map((schedule) =>
      evaluateSlot(
        schedule,
        {
          window,
          durationMinutes: quote.durationMinutes,
          destination,
          travel,
          now,
          // Le délai de prévenance a déjà été appliqué à la sélection du
          // créneau ; le réappliquer ici ferait échouer une validation lente.
          leadTimeMinutes: 0,
        },
        input.scheduledStart.getTime(),
      ),
    )
    .filter((candidate) => candidate !== null)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    throw new NoCleanerAvailableError();
  }

  /**
   * Les candidats sont essayés dans l'ordre du score, jusqu'à ce que la base
   * en accepte un.
   *
   * Ce parcours n'est pas une précaution : sans lui, deux réservations
   * simultanées choisiraient toutes deux le mieux classé, la seconde
   * échouerait, et le client s'entendrait dire que le créneau est pris alors
   * qu'une autre intervenante était libre. La lecture des disponibilités ne
   * voit pas les transactions en cours ; seule l'écriture les rencontre.
   *
   * La boucle est bornée par le nombre d'intervenants réellement disponibles
   * sur ce créneau : elle se termine toujours.
   */
  for (const chosen of candidates) {
    try {
      return await attemptBooking(chosen);
    } catch (error) {
      // Contrainte d'exclusion ou interblocage : dans les deux cas, une autre
      // réservation écrivait ce créneau au même instant. On tente le suivant.
      if (isConcurrentSlotWrite(error)) {
        continue;
      }
      throw error;
    }
  }

  // Tous les candidats ont été pris de vitesse : là, le créneau est vraiment
  // parti.
  throw new SlotTakenError();

  async function attemptBooking(
    chosen: (typeof candidates)[number],
  ): Promise<CreatedBooking> {
    return db.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          organizationId: organization.id,
          clientProfileId: input.clientProfileId,
          addressId: address.id,
          serviceId: quote.serviceId,
          subscriptionId: input.subscriptionId ?? null,
          // La réservation naît attribuée : l'intervenant est déjà désigné et
          // sa place bloquée. Elle passera en CONFIRMED à son acceptation.
          status: "ASSIGNED",
          source: input.source ?? "LEOCLEAN",
          scheduledStart: input.scheduledStart,
          scheduledEnd,
          surfaceSqm: input.surfaceSqm,
          frequency: input.frequency,
          engagementMode: "PRESTATAIRE",
          clientNotes: input.clientNotes ?? null,
          ...quoteToBookingAmounts(quote),
        },
      });

      // Chaque ligne est un instantané du catalogue : libellé et montant sont
      // recopiés, `sourceId` ne sert qu'à retrouver l'origine. Les
      // identifiants d'options suivent l'ordre des lignes d'option, celui dans
      // lequel le devis les a produites — un compteur vaut mieux qu'une
      // recherche par libellé, qui confondrait deux options homonymes.
      let optionIndex = 0;
      await tx.bookingItem.createMany({
        data: quote.lines.map((line) => ({
          organizationId: organization.id,
          bookingId: booking.id,
          kind: line.kind,
          label: line.label,
          sourceId:
            line.kind === "OPTION"
              ? (quote.optionIds[optionIndex++] ?? null)
              : quote.serviceId,
          extraMinutes: line.extraMinutes,
          unitPriceCents: line.amountCents,
          totalCents: line.amountCents,
        })),
      });

      const assignment = await tx.assignment.create({
        data: {
          organizationId: organization.id,
          bookingId: booking.id,
          cleanerProfileId: chosen.cleanerProfileId,
          status: "PROPOSED",
          startAt: input.scheduledStart,
          endAt: scheduledEnd,
          blockStartAt: new Date(
            input.scheduledStart.getTime() -
              chosen.travelMinutesBefore * 60_000,
          ),
          blockEndAt: new Date(
            scheduledEnd.getTime() + chosen.travelMinutesAfter * 60_000,
          ),
          travelMinutesBefore: chosen.travelMinutesBefore,
          travelMinutesAfter: chosen.travelMinutesAfter,
          score: chosen.score,
          scoreBreakdown: chosen.breakdown,
          proposedAt: now,
          respondBy: responseDeadline(input.scheduledStart, now),
        },
      });

      await tx.bookingStatusEvent.create({
        data: {
          organizationId: organization.id,
          bookingId: booking.id,
          toStatus: "ASSIGNED",
          reason: "Attribution automatique à la réservation",
        },
      });

      return {
        bookingId: booking.id,
        assignmentId: assignment.id,
        cleanerProfileId: chosen.cleanerProfileId,
        scheduledStart: input.scheduledStart,
        scheduledEnd,
        grossAmountCents: quote.grossAmountCents,
        netAmountCents: quote.netAmountCents,
      };
    });
  }
}

/**
 * Délai laissé à l'intervenant pour répondre.
 *
 * La moitié du temps qui reste avant la mission, borné à deux heures au
 * minimum et vingt-quatre au maximum. Une mission dans trois jours n'a pas
 * besoin d'une réponse dans l'heure ; une mission demain matin, si.
 */
export function responseDeadline(scheduledStart: Date, now: Date): Date {
  const untilStart = scheduledStart.getTime() - now.getTime();
  const half = untilStart / 2;
  const bounded = Math.min(Math.max(half, 2 * 3_600_000), 24 * 3_600_000);
  return new Date(Math.min(now.getTime() + bounded, scheduledStart.getTime()));
}

export interface AvailableSlotsInput {
  organizationId: string;
  destination: GeoPoint;
  durationMinutes: number;
  window: { start: number; end: number };
  preferredCleanerProfileId?: string | null;
  now?: Date;
  limit?: number;
  travel?: TravelMatrix;
  /** Marge de trajet, quand la destination n'est qu'un centre de commune. */
  travelMarginMinutes?: number;
}

/** Créneaux proposables au client, sans révéler l'identité des intervenants. */
export async function listAvailableSlots(
  db: TenantClient,
  input: AvailableSlotsInput,
): Promise<{ start: Date; end: Date }[]> {
  const schedules = await loadCleanerSchedules(db, {
    window: input.window,
    preferredCleanerProfileId: input.preferredCleanerProfileId,
    minimumSlotMinutes: input.durationMinutes,
  });

  const travel =
    input.travel ??
    (await resolveTravelMatrix(pointsOf(schedules), input.destination));

  return findSlots(schedules, {
    window: input.window,
    durationMinutes: input.durationMinutes,
    destination: input.destination,
    travel,
    travelMarginMinutes: input.travelMarginMinutes,
    now: input.now,
    limit: input.limit,
  }).map((slot) => ({ start: slot.start, end: slot.end }));
}
