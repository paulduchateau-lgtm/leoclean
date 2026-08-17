import "server-only";

import { reattribuer } from "@/lib/assignments/reattribution";
import { BusinessError } from "@/lib/booking/errors";
import {
  canAnswerProposal,
  canProposeSlot,
  proposalRefusalMessage,
  proposedEndFor,
  respondByFor,
} from "@/lib/booking/slot-proposal";
import type { TenantClient } from "@/lib/db";

/**
 * Écriture et réponse des contre-propositions de créneau.
 *
 * La décision — ce qui est proposable, ce qui est encore répondable — vit dans
 * `slot-proposal.ts`, qui est pur. Ce module-ci ne fait que la base et les
 * transactions.
 */

export class ProposalRefusedError extends BusinessError {
  override readonly name = "ProposalRefusedError";
}

export class ProposalNotFoundError extends BusinessError {
  override readonly name = "ProposalNotFoundError";

  constructor() {
    // Même message qu'une proposition appartenant à quelqu'un d'autre :
    // distinguer les deux dirait à un curieux que l'identifiant existe.
    super("Cette proposition est introuvable.");
  }
}

/**
 * Un intervenant propose un autre créneau sur une réservation orpheline.
 *
 * Aucune écriture n'engage qui que ce soit : tant que le client n'a pas
 * validé, la réservation ne bouge pas et l'intervenant n'est pas bloqué. C'est
 * la raison pour laquelle la table ne porte pas de contrainte d'exclusion —
 * une proposition n'occupe personne.
 */
export async function proposeSlot(
  db: TenantClient,
  cleanerProfileId: string,
  input: { bookingId: string; proposedStart: Date; message?: string | null },
  now: Date,
): Promise<{ proposalId: string; proposedEnd: Date }> {
  const booking = await db.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      scheduledStart: true,
      durationMinutes: true,
    },
  });
  if (!booking) throw new ProposalNotFoundError();

  const check = canProposeSlot({
    bookingStatus: booking.status,
    currentStart: booking.scheduledStart,
    proposedStart: input.proposedStart,
    now,
  });
  if (!check.allowed) {
    throw new ProposalRefusedError(proposalRefusalMessage(check.refusal!));
  }

  const proposedEnd = proposedEndFor(
    input.proposedStart,
    booking.durationMinutes,
  );

  const proposal = await db.slotProposal.create({
    data: {
      organizationId: booking.organizationId,
      bookingId: booking.id,
      cleanerProfileId,
      proposedStart: input.proposedStart,
      proposedEnd,
      message: input.message?.trim() || null,
      respondBy: respondByFor(input.proposedStart, now),
    },
    select: { id: true },
  });

  return { proposalId: proposal.id, proposedEnd };
}

export interface ClientProposalView {
  id: string;
  bookingId: string;
  proposedStart: string;
  proposedEnd: string;
  message: string | null;
  respondBy: string | null;
  cleanerFirstName: string;
}

/** Les propositions en attente sur les réservations du client de la session. */
export async function readClientProposals(
  db: TenantClient,
  user: { id: string },
  now: Date,
): Promise<ClientProposalView[]> {
  const profile = await db.clientProfile.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!profile) return [];

  const proposals = await db.slotProposal.findMany({
    where: {
      status: "PENDING",
      proposedStart: { gt: now },
      booking: { clientProfileId: profile.id },
    },
    orderBy: { proposedStart: "asc" },
    select: {
      id: true,
      bookingId: true,
      proposedStart: true,
      proposedEnd: true,
      message: true,
      respondBy: true,
      cleaner: { select: { displayName: true } },
    },
  });

  return proposals.map((proposal) => ({
    id: proposal.id,
    bookingId: proposal.bookingId,
    proposedStart: proposal.proposedStart.toISOString(),
    proposedEnd: proposal.proposedEnd.toISOString(),
    message: proposal.message,
    respondBy: proposal.respondBy?.toISOString() ?? null,
    cleanerFirstName: proposal.cleaner.displayName,
  }));
}

export interface ProposalAnswer {
  accepted: boolean;
  /** Renseigné quand l'intervenant n'était plus libre à l'heure proposée. */
  slotLost: boolean;
  startAt: string | null;
}

/**
 * Le client tranche.
 *
 * **Accepter est la seule opération qui déplace un rendez-vous**, et elle se
 * fait en deux temps assumés plutôt qu'en une transaction unique :
 *
 * 1. on déplace la réservation sur le créneau proposé ;
 * 2. on demande une affectation, restreinte à l'intervenant qui a proposé.
 *
 * Le second temps passe par `reattribuer`, donc par les temps de trajet réels,
 * les tampons, et surtout la contrainte d'exclusion en base — seule autorité
 * sur les conflits, parce qu'elle seule voit les écritures concurrentes. Si
 * l'intervenant s'est engagé ailleurs entre-temps, l'écriture échoue : on
 * remet la réservation à son heure d'origine et on le dit au client, plutôt
 * que de le laisser avec un rendez-vous déplacé et personne pour venir.
 */
export async function answerProposal(
  db: TenantClient,
  user: { id: string },
  input: { proposalId: string; accept: boolean },
  now: Date,
): Promise<ProposalAnswer> {
  const profile = await db.clientProfile.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!profile) throw new ProposalNotFoundError();

  const proposal = await db.slotProposal.findFirst({
    where: {
      id: input.proposalId,
      booking: { clientProfileId: profile.id },
    },
    select: {
      id: true,
      status: true,
      organizationId: true,
      bookingId: true,
      cleanerProfileId: true,
      proposedStart: true,
      proposedEnd: true,
      respondBy: true,
      booking: { select: { scheduledStart: true, scheduledEnd: true } },
    },
  });
  if (!proposal) throw new ProposalNotFoundError();

  const check = canAnswerProposal({
    status: proposal.status,
    proposedStart: proposal.proposedStart,
    respondBy: proposal.respondBy,
    now,
  });
  if (!check.allowed) {
    throw new ProposalRefusedError(proposalRefusalMessage(check.refusal!));
  }

  if (!input.accept) {
    await db.slotProposal.update({
      where: { id: proposal.id },
      data: { status: "DECLINED", respondedAt: now },
    });
    return { accepted: false, slotLost: false, startAt: null };
  }

  const original = proposal.booking;

  await db.booking.update({
    where: { id: proposal.bookingId },
    data: {
      scheduledStart: proposal.proposedStart,
      scheduledEnd: proposal.proposedEnd,
    },
  });

  const assigned = await reattribuer(
    db,
    { id: proposal.organizationId },
    {
      bookingId: proposal.bookingId,
      exclureCleanerProfileIds: [],
      limiterAuxCleanerProfileIds: [proposal.cleanerProfileId],
      now,
    },
  );

  if (!assigned) {
    // L'intervenant s'est engagé ailleurs entre sa proposition et cette
    // validation. On remet la réservation où elle était : un rendez-vous
    // déplacé sans personne pour venir serait pire que pas de proposition.
    await db.booking.update({
      where: { id: proposal.bookingId },
      data: {
        scheduledStart: original.scheduledStart,
        scheduledEnd: original.scheduledEnd,
      },
    });
    await db.slotProposal.update({
      where: { id: proposal.id },
      data: { status: "EXPIRED", respondedAt: now },
    });

    return { accepted: false, slotLost: true, startAt: null };
  }

  await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: proposal.bookingId },
      data: { status: "ASSIGNED" },
    });

    await tx.bookingStatusEvent.create({
      data: {
        organizationId: proposal.organizationId,
        bookingId: proposal.bookingId,
        fromStatus: "PENDING_ASSIGNMENT",
        toStatus: "ASSIGNED",
        reason:
          "Créneau de remplacement proposé par l'intervenant et accepté par le client",
        actorUserId: user.id,
      },
    });

    await tx.slotProposal.update({
      where: { id: proposal.id },
      data: { status: "ACCEPTED", respondedAt: now },
    });

    // Les autres propositions sur la même réservation n'ont plus d'objet :
    // les laisser en attente ferait valider deux créneaux pour un rendez-vous.
    await tx.slotProposal.updateMany({
      where: {
        bookingId: proposal.bookingId,
        status: "PENDING",
        id: { not: proposal.id },
      },
      data: { status: "DECLINED", respondedAt: now },
    });
  });

  return {
    accepted: true,
    slotLost: false,
    startAt: proposal.proposedStart.toISOString(),
  };
}
