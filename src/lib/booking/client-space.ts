import "server-only";

import { decideCancellation, refusalMessage } from "@/lib/booking/cancel";
import type { TenantClient } from "@/lib/db";
import { BusinessError } from "@/lib/booking/errors";

/**
 * Ce qu'un client peut **faire** depuis son espace, par opposition à ce qu'il
 * y lit — la lecture vit dans `client-bookings.ts`.
 *
 * **L'autorisation n'est pas `requireOrganization`.** Un client de la
 * marketplace n'a pas de `Membership` : la réservation crée un `User` et un
 * `ClientProfile`, pas une appartenance. Exiger une appartenance ici ne
 * protégerait rien, elle rendrait toute action impossible. Ce qui en tient
 * lieu est plus étroit et se lit dans `assertOwnedBooking` : on résout le
 * profil **depuis la session**, jamais depuis l'entrée, puis on refuse toute
 * réservation qui ne lui est pas rattachée. Personne ne peut donc désigner la
 * réservation d'autrui, même en connaissant son identifiant.
 *
 * Le module reçoit un client déjà cloisonné et une identité : il ne connaît ni
 * Auth.js ni la résolution d'organisation, ce qui le rend testable contre une
 * vraie base sans monter de session.
 */

export class BookingNotFoundError extends BusinessError {
  override readonly name = "BookingNotFoundError";

  constructor() {
    // Le même message qu'une réservation appartenant à quelqu'un d'autre :
    // distinguer les deux dirait à un curieux que l'identifiant existe.
    super("Cette intervention est introuvable.");
  }
}

export class CancellationRefusedError extends BusinessError {
  override readonly name = "CancellationRefusedError";
}

/**
 * Réservation de la session, ou rien.
 *
 * Le profil client vient de `user.id`, jamais de l'entrée : c'est le seul
 * point où l'appartenance se décide, et il est franchi par toutes les
 * mutations de l'espace.
 */
async function assertOwnedBooking(
  db: TenantClient,
  user: { id: string },
  bookingId: string,
) {
  const profile = await db.clientProfile.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!profile) throw new BookingNotFoundError();

  const booking = await db.booking.findFirst({
    where: { id: bookingId, clientProfileId: profile.id },
    select: {
      id: true,
      status: true,
      grossAmountCents: true,
      scheduledStart: true,
      organizationId: true,
      assignments: {
        where: { status: { in: ["PROPOSED", "ACCEPTED"] } },
        select: { id: true, cleaner: { select: { userId: true } } },
      },
    },
  });
  if (!booking) throw new BookingNotFoundError();

  return { profile, booking };
}

export interface CancellationReceipt {
  bookingId: string;
  feeCents: number;
  refundCents: number;
  tierLabel: string;
}

/**
 * Annule une intervention à la demande du client.
 *
 * Trois écritures indissociables, donc une transaction : le statut de la
 * réservation, la trace de la transition, et la fin des affectations en cours.
 *
 * **C'est la dernière qui libère le créneau.** La contrainte d'exclusion en
 * base ignore les statuts terminaux : tant qu'une affectation reste
 * `ACCEPTED`, l'intervenant demeure occupé et le moteur ne reproposera jamais
 * cette heure à personne. Annuler sans y toucher gèlerait un créneau pour une
 * intervention qui n'a plus lieu.
 *
 * L'intervenant est prévenu par un message dans le fil de l'intervention. Ce
 * n'est pas un substitut à une notification poussée — il n'y en a pas encore —
 * mais c'est écrit là où il regardera, et c'est vérifiable.
 */
export async function cancelClientBooking(
  db: TenantClient,
  user: { id: string },
  input: { bookingId: string; reason?: string | null },
  now: Date,
): Promise<CancellationReceipt> {
  const { booking } = await assertOwnedBooking(db, user, input.bookingId);

  const decision = decideCancellation({
    status: booking.status,
    grossAmountCents: booking.grossAmountCents,
    scheduledStart: booking.scheduledStart,
    now,
  });

  if (!decision.allowed) {
    throw new CancellationRefusedError(refusalMessage(decision.refusal!));
  }

  const cleanerUserIds = booking.assignments
    .map((assignment) => assignment.cleaner.userId)
    .filter((id): id is string => typeof id === "string");

  await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED_BY_CLIENT" },
    });

    await tx.bookingStatusEvent.create({
      data: {
        organizationId: booking.organizationId,
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: "CANCELLED_BY_CLIENT",
        // Le motif est facultatif : l'exiger transformerait une annulation en
        // justification, et le client n'en doit aucune.
        reason: input.reason?.trim() || null,
        actorUserId: user.id,
      },
    });

    if (booking.assignments.length > 0) {
      await tx.assignment.updateMany({
        where: { id: { in: booking.assignments.map((entry) => entry.id) } },
        data: { status: "CANCELLED" },
      });
    }

    for (const recipientUserId of cleanerUserIds) {
      await tx.message.create({
        data: {
          organizationId: booking.organizationId,
          bookingId: booking.id,
          senderUserId: user.id,
          recipientUserId,
          body: input.reason?.trim()
            ? `Intervention annulée par le client. Motif indiqué : ${input.reason.trim()}`
            : "Intervention annulée par le client.",
        },
      });
    }
  });

  return {
    bookingId: booking.id,
    feeCents: decision.outcome.feeCents,
    refundCents: decision.outcome.refundCents,
    tierLabel: decision.outcome.tier.label,
  };
}

export interface BookingMessageView {
  id: string;
  body: string;
  createdAt: string;
  /** Écrit par le client lui-même, par opposition à l'intervenant. */
  fromMe: boolean;
}

/**
 * Le fil d'une intervention.
 *
 * Les messages sont rattachés à une réservation et pas à un couple de
 * personnes : un intervenant peut changer d'une semaine sur l'autre, et un fil
 * qui suivrait les personnes mélangerait deux interventions sans rapport.
 */
export async function readBookingMessages(
  db: TenantClient,
  user: { id: string },
  bookingId: string,
): Promise<BookingMessageView[]> {
  await assertOwnedBooking(db, user, bookingId);

  const messages = await db.message.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      body: true,
      createdAt: true,
      senderUserId: true,
    },
  });

  return messages.map((message) => ({
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    fromMe: message.senderUserId === user.id,
  }));
}

/**
 * Écrit un message à l'intervenant d'une intervention.
 *
 * Sans intervenant désigné, il n'y a personne à qui écrire : on refuse plutôt
 * que d'écrire un message que le destinataire ne recevra jamais. C'est le cas
 * d'une réservation encore en attente d'attribution, où le bon canal est le
 * téléphone.
 */
export async function sendBookingMessage(
  db: TenantClient,
  user: { id: string },
  input: { bookingId: string; body: string },
): Promise<BookingMessageView> {
  const { booking } = await assertOwnedBooking(db, user, input.bookingId);

  const recipientUserId = booking.assignments[0]?.cleaner.userId;
  if (!recipientUserId) {
    throw new CancellationRefusedError(
      "Aucun intervenant n'est encore désigné pour cette intervention. Appelez-nous, nous vous répondons tout de suite.",
    );
  }

  const created = await db.message.create({
    data: {
      organizationId: booking.organizationId,
      bookingId: booking.id,
      senderUserId: user.id,
      recipientUserId,
      body: input.body.trim(),
    },
    select: { id: true, body: true, createdAt: true },
  });

  return {
    id: created.id,
    body: created.body,
    createdAt: created.createdAt.toISOString(),
    fromMe: true,
  };
}
