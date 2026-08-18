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

import { composerLots, echeanceDuLot } from "@/lib/assignments/diffusion";

import { annoncerLaDiffusion } from "@/lib/notifications/evenements";

import { NoCleanerAvailableError } from "./errors";

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
  /**
   * Intervenants sollicités, dans l'ordre du score.
   *
   * Aucun n'est encore titulaire de la mission : la liste dit à qui l'on a
   * proposé, pas qui viendra. C'est pour cette raison qu'aucun nom n'est
   * remonté à l'écran de confirmation — annoncer quelqu'un qui n'a pas accepté
   * serait une promesse que personne n'a faite.
   */
  proposedTo: string[];
  /** Échéance du premier lot, annoncée au client. */
  respondBy: Date;
  scheduledStart: Date;
  scheduledEnd: Date;
  grossAmountCents: number;
  netAmountCents: number;
}

/**
 * Enregistre une demande et la diffuse au premier lot d'intervenants.
 *
 * **Ce n'est plus une attribution.** Le modèle précédent désignait le mieux
 * classé et lui bloquait la place : le client repartait avec un rendez-vous
 * ferme, et quelqu'un se voyait assigner une mission qu'il n'avait pas
 * acceptée. Désormais la mission est proposée aux cinq mieux classés, et le
 * premier qui accepte l'emporte.
 *
 * Trois conséquences, toutes assumées.
 *
 * **Le créneau n'est plus tenu.** Aucune proposition ne réserve la place — la
 * contrainte d'exclusion ne couvre plus que l'accepté. Deux clients peuvent
 * donc demander le même créneau au même vivier ; celui dont un intervenant
 * accepte le premier l'obtient, l'autre continue de chercher. La garantie n'a
 * pas disparu, elle s'applique à l'acceptation.
 *
 * **La boucle « candidat suivant » a disparu avec sa raison d'être.** Elle
 * existait parce que deux réservations simultanées choisissaient le même
 * intervenant et que la seconde échouait. Cinq propositions concurrentes ne se
 * heurtent à rien : il n'y a plus d'écriture à réessayer.
 *
 * **On refuse toujours une demande que personne ne peut servir.** Si aucun
 * intervenant n'est disponible sur ce créneau, la demande n'est pas enregistrée
 * : accepter pour diffuser dans le vide reviendrait à faire attendre une
 * semaine quelqu'un à qui l'on peut dire tout de suite de choisir une autre
 * heure.
 */
export async function createBooking(
  db: TenantClient,
  organization: { id: string },
  input: CreateBookingInput,
): Promise<CreatedBooking> {
  const now = input.now ?? new Date();

  const address = await db.address.findUniqueOrThrow({
    where: { id: input.addressId },
    select: { id: true, lat: true, lng: true },
  });
  const destination: GeoPoint = { lat: address.lat, lng: address.lng };

  const quote = await quoteFromCatalogue(db, {
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

  const { premier } = composerLots(candidates);

  /*
   * L'échéance du lot, bornée par le début de la mission. Vingt-quatre heures
   * de réflexion sur une mission qui commence dans trois heures n'auraient
   * aucun sens : la réponse ne servirait plus à rien quand elle arriverait.
   */
  const respondBy = new Date(
    Math.min(
      echeanceDuLot(1, now, now).getTime(),
      input.scheduledStart.getTime(),
    ),
  );

  const cree = await diffuser(premier, respondBy);

  /*
   * Les notifications partent après la transaction, jamais dedans : un envoi
   * lent tiendrait la base ouverte, et un envoi qui échoue ne doit pas défaire
   * une demande enregistrée. On ne les attend pas non plus — le client a déjà
   * son écran de confirmation.
   */
  void annoncerLaDiffusion(db, cree.bookingId, cree.proposedTo);

  return cree;

  /**
   * La demande, ses lignes facturables et les propositions du lot : ensemble ou
   * pas du tout.
   *
   * La même raison qu'avant, transposée : une demande sans proposition est un
   * client qui attend un appel que personne n'a reçu, et des propositions sans
   * demande sont des sollicitations pour une mission qui n'existe pas.
   */
  async function diffuser(
    lot: readonly (typeof candidates)[number][],
    respondBy: Date,
  ): Promise<CreatedBooking> {
    return db.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          organizationId: organization.id,
          clientProfileId: input.clientProfileId,
          addressId: address.id,
          serviceId: quote.serviceId,
          subscriptionId: input.subscriptionId ?? null,
          /*
           * La demande naît en recherche, et non attribuée : personne n'a
           * encore accepté. Elle passera en CONFIRMED à la première
           * acceptation, et c'est le seul chemin qui l'y mène.
           */
          status: "PENDING_ASSIGNMENT",
          diffusionLot: 1,
          diffusionLotSentAt: now,
          diffusionDeadlineAt: respondBy,
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

      /*
       * Chaque proposition porte les tampons de trajet calculés pour *son*
       * intervenant : le créneau bloqué diffère d'une personne à l'autre, selon
       * la tournée dans laquelle la mission viendrait s'insérer. Les recopier
       * depuis le premier candidat ferait accepter à quelqu'un un enchaînement
       * que la base refuserait ensuite.
       */
      await tx.assignment.createMany({
        data: lot.map((candidat) => ({
          organizationId: organization.id,
          bookingId: booking.id,
          cleanerProfileId: candidat.cleanerProfileId,
          status: "PROPOSED" as const,
          lot: 1,
          startAt: input.scheduledStart,
          endAt: scheduledEnd,
          blockStartAt: new Date(
            input.scheduledStart.getTime() -
              candidat.travelMinutesBefore * 60_000,
          ),
          blockEndAt: new Date(
            scheduledEnd.getTime() + candidat.travelMinutesAfter * 60_000,
          ),
          travelMinutesBefore: candidat.travelMinutesBefore,
          travelMinutesAfter: candidat.travelMinutesAfter,
          score: candidat.score,
          scoreBreakdown: candidat.breakdown,
          proposedAt: now,
          respondBy,
        })),
      });

      await tx.bookingStatusEvent.create({
        data: {
          organizationId: organization.id,
          bookingId: booking.id,
          toStatus: "PENDING_ASSIGNMENT",
          reason: `Diffusion à ${lot.length} intervenant${lot.length > 1 ? "s" : ""} (lot 1)`,
        },
      });

      return {
        bookingId: booking.id,
        proposedTo: lot.map((candidat) => candidat.cleanerProfileId),
        respondBy,
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
