import type { BookingStatus, SlotProposalStatus } from "@prisma/client";

import { SLOT_GRANULARITY_MINUTES } from "@/lib/pricing/duration";

/**
 * Contre-proposition de créneau : ce qu'un intervenant a le droit de proposer,
 * et ce qu'un client a le droit de valider.
 *
 * Le module est **pur** — ni base, ni horloge implicite. C'est ce qui permet de
 * tester la proposition à la minute près, la fenêtre de réponse et l'heure
 * dépassée, sans monter quoi que ce soit.
 *
 * **Elle n'existe que dans un cas.** Personne n'a accepté la mission à l'heure
 * demandée, la réservation est retombée en `PENDING_ASSIGNMENT`, et le client
 * attend. Hors de ce cas, il ne s'agit pas d'une contre-proposition mais d'une
 * replanification, qui se négocie et se traite au téléphone.
 *
 * **La durée ne se renégocie pas ici.** L'heure de fin se déduit de la durée
 * de la réservation : un intervenant qui voudrait aussi changer la durée
 * changerait le prix, et un prix qui bouge après la réservation n'est pas une
 * proposition, c'est une renégociation.
 */

/** Fenêtre par défaut laissée au client pour répondre, en heures. */
export const PROPOSAL_RESPONSE_WINDOW_HOURS = 24;

/**
 * Avance minimale d'un créneau proposé.
 *
 * Proposer dans l'heure ne laisse au client ni le temps de lire ni celui de
 * s'organiser, et l'intervenant se déplacerait pour une porte fermée.
 */
export const PROPOSAL_MIN_LEAD_HOURS = 12;

export type ProposalRefusal =
  /** La réservation n'attend pas d'intervenant : rien à proposer. */
  | "RESERVATION_NON_ORPHELINE"
  /** Le créneau proposé n'est pas sur le pas de trente minutes. */
  | "CRENEAU_HORS_GRILLE"
  /** Trop proche, ou déjà passé. */
  | "CRENEAU_TROP_PROCHE"
  /** Le créneau proposé est celui qui a déjà été refusé. */
  | "CRENEAU_INCHANGE";

export interface ProposalCheck {
  allowed: boolean;
  refusal: ProposalRefusal | null;
}

/**
 * Un intervenant peut-il proposer ce créneau ?
 *
 * On vérifie ici ce qui ne dépend que des données ; la disponibilité réelle de
 * l'intervenant, elle, est arbitrée à la validation par la contrainte
 * d'exclusion en base — c'est la seule autorité, et elle voit les écritures
 * concurrentes que cette fonction ne peut pas voir.
 */
export function canProposeSlot({
  bookingStatus,
  currentStart,
  proposedStart,
  now,
}: {
  bookingStatus: BookingStatus;
  currentStart: Date;
  proposedStart: Date;
  now: Date;
}): ProposalCheck {
  if (bookingStatus !== "PENDING_ASSIGNMENT") {
    return { allowed: false, refusal: "RESERVATION_NON_ORPHELINE" };
  }

  if (proposedStart.getTime() === currentStart.getTime()) {
    return { allowed: false, refusal: "CRENEAU_INCHANGE" };
  }

  // Le planning entier travaille au pas de trente minutes : un créneau à
  // 14 h 07 ne serait proposable à personne d'autre ensuite.
  const minutes =
    proposedStart.getUTCHours() * 60 + proposedStart.getUTCMinutes();
  if (
    minutes % SLOT_GRANULARITY_MINUTES !== 0 ||
    proposedStart.getUTCSeconds() !== 0 ||
    proposedStart.getUTCMilliseconds() !== 0
  ) {
    return { allowed: false, refusal: "CRENEAU_HORS_GRILLE" };
  }

  const leadHours = (proposedStart.getTime() - now.getTime()) / 3_600_000;
  if (leadHours < PROPOSAL_MIN_LEAD_HOURS) {
    return { allowed: false, refusal: "CRENEAU_TROP_PROCHE" };
  }

  return { allowed: true, refusal: null };
}

/** Fin déduite de la durée de la réservation, jamais saisie. */
export function proposedEndFor(
  proposedStart: Date,
  durationMinutes: number,
): Date {
  return new Date(proposedStart.getTime() + durationMinutes * 60_000);
}

/** Échéance de réponse laissée au client, bornée par le créneau lui-même. */
export function respondByFor(proposedStart: Date, now: Date): Date {
  const window = new Date(
    now.getTime() + PROPOSAL_RESPONSE_WINDOW_HOURS * 3_600_000,
  );
  // Répondre après le début n'aurait aucun sens : l'échéance ne dépasse jamais
  // le créneau proposé.
  return window.getTime() < proposedStart.getTime() ? window : proposedStart;
}

export type ProposalAnswerRefusal =
  /** Déjà répondue, retirée ou périmée. */
  | "PROPOSITION_CLOSE"
  /** L'échéance est passée, ou le créneau proposé a commencé. */
  | "PROPOSITION_PERIMEE";

export interface ProposalAnswerCheck {
  allowed: boolean;
  refusal: ProposalAnswerRefusal | null;
}

/**
 * Le client peut-il encore répondre à cette proposition ?
 *
 * On refuse plutôt que de laisser valider une proposition périmée : accepter
 * une heure passée écrirait un rendez-vous derrière soi, et l'intervenant
 * découvrirait une mission qu'il n'a plus le temps de faire.
 */
export function canAnswerProposal({
  status,
  proposedStart,
  respondBy,
  now,
}: {
  status: SlotProposalStatus;
  proposedStart: Date;
  respondBy: Date | null;
  now: Date;
}): ProposalAnswerCheck {
  if (status !== "PENDING") {
    return { allowed: false, refusal: "PROPOSITION_CLOSE" };
  }

  if (now.getTime() >= proposedStart.getTime()) {
    return { allowed: false, refusal: "PROPOSITION_PERIMEE" };
  }

  if (respondBy !== null && now.getTime() > respondBy.getTime()) {
    return { allowed: false, refusal: "PROPOSITION_PERIMEE" };
  }

  return { allowed: true, refusal: null };
}

/** Motifs affichables tels quels : un code montré à quelqu'un n'explique rien. */
export function proposalRefusalMessage(
  refusal: ProposalRefusal | ProposalAnswerRefusal,
): string {
  switch (refusal) {
    case "RESERVATION_NON_ORPHELINE":
      return "Cette intervention n'attend plus d'intervenant.";
    case "CRENEAU_HORS_GRILLE":
      return `Les créneaux se posent par tranches de ${SLOT_GRANULARITY_MINUTES} minutes.`;
    case "CRENEAU_TROP_PROCHE":
      return `Proposez un créneau au moins ${PROPOSAL_MIN_LEAD_HOURS} heures à l'avance : le client doit avoir le temps de s'organiser.`;
    case "CRENEAU_INCHANGE":
      return "C'est le créneau déjà demandé. Proposez-en un autre.";
    case "PROPOSITION_CLOSE":
      return "Cette proposition n'est plus en attente.";
    case "PROPOSITION_PERIMEE":
      return "Cette proposition a expiré. Appelez-nous, nous trouvons autre chose.";
  }
}
