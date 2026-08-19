import type { SlotProposalStatus } from "@prisma/client";

import { CONTRE_PROPOSITION_JOURS } from "@/lib/assignments/diffusion";
import { SLOT_GRANULARITY_MINUTES } from "@/lib/pricing/duration";

/**
 * Contre-proposition de créneau : ce qu'un intervenant a le droit de proposer,
 * et ce qu'un client a le droit de valider.
 *
 * Le module est **pur** — ni base, ni horloge implicite. C'est ce qui permet de
 * tester la proposition à la minute près, la fenêtre de réponse et l'heure
 * dépassée, sans monter quoi que ce soit.
 *
 * **Deux situations, deux vitesses.**
 *
 * La première existait seule jusqu'au 19 août 2026 : personne n'a accepté la
 * mission, la réservation est retombée en `PENDING_ASSIGNMENT`, et le client
 * attend. L'intervenant propose alors une autre heure, et le client tranche.
 *
 * La seconde est neuve, et c'est elle qui rapporte : un intervenant qui tient
 * une proposition **vivante** peut répondre « je peux, mais à telle heure »
 * plutôt que de refuser. Personne d'autre que lui ne connaît sa journée en
 * entier, et refuser était jusqu'ici sa seule sortie quand l'heure demandée
 * tombait mal d'une demi-heure.
 *
 * Sous une heure d'écart, cette réponse vaut **pré-acceptation** : il s'engage,
 * et le client n'a qu'à dire oui. Au-delà, elle est conservée et n'atteint le
 * client que si le lot expire sans acceptation — c'est-à-dire le comportement
 * qui existait déjà. Un seul mécanisme, deux vitesses, et le seuil est le seul
 * paramètre neuf.
 *
 * **La durée ne se renégocie pas ici.** L'heure de fin se déduit de la durée
 * de la réservation : un intervenant qui voudrait aussi changer la durée
 * changerait le prix, et un prix qui bouge après la réservation n'est pas une
 * proposition, c'est une renégociation.
 */

/**
 * Fenêtre laissée au client pour répondre, en heures.
 *
 * Dérivée de la validité décidée pour la diffusion, et non écrite ici : le
 * client doit pouvoir demander qu'on continue à chercher son heure exacte sans
 * perdre les alternatives, puis y revenir plus tard. Une fenêtre de vingt-quatre
 * heures — celle des débuts — les aurait éteintes avant même la fin du premier
 * lot.
 */
export const PROPOSAL_RESPONSE_WINDOW_HOURS = CONTRE_PROPOSITION_JOURS * 24;

/**
 * Avance minimale d'un créneau proposé.
 *
 * Proposer dans l'heure ne laisse au client ni le temps de lire ni celui de
 * s'organiser, et l'intervenant se déplacerait pour une porte fermée.
 */
export const PROPOSAL_MIN_LEAD_HOURS = 12;

/**
 * Écart en deçà duquel une contre-proposition part au client tout de suite.
 *
 * Une heure. Au-delà, ce n'est plus « je décale un peu », c'est un autre
 * rendez-vous — et le client mérite alors qu'on cherche d'abord son heure à
 * lui, avant de lui proposer autre chose.
 */
export const ECART_PRE_ACCEPTATION_MINUTES = 60;

/**
 * Ce que devient une proposition selon son écart.
 *
 * `PRE_ACCEPTATION` part au client immédiatement ; `CONTRE_PROPOSITION` attend
 * l'échéance du lot, comme avant.
 */
export type VoieProposition = "PRE_ACCEPTATION" | "CONTRE_PROPOSITION";

/**
 * Situation de l'intervenant au moment où il propose.
 *
 * `PROPOSITION_VIVANTE` : il tient une offre à laquelle il n'a pas encore
 * répondu. `RESERVATION_ORPHELINE` : plus personne n'est sur la mission.
 * Les deux ouvrent le droit de proposer ; rien d'autre ne l'ouvre.
 */
export type SituationProposant =
  | "PROPOSITION_VIVANTE"
  | "RESERVATION_ORPHELINE"
  | "AUCUNE";

export type ProposalRefusal =
  /** Ni proposition vivante, ni réservation orpheline : rien à proposer. */
  | "RESERVATION_NON_ORPHELINE"
  /** Le créneau proposé n'est pas sur le pas de trente minutes. */
  | "CRENEAU_HORS_GRILLE"
  /** Trop proche, ou déjà passé. */
  | "CRENEAU_TROP_PROCHE"
  /** Le créneau proposé est celui qui a déjà été refusé. */
  | "CRENEAU_INCHANGE"
  /** Une pré-acceptation qui changerait de jour changerait aussi le prix. */
  | "JOUR_DIFFERENT";

export interface ProposalCheck {
  allowed: boolean;
  refusal: ProposalRefusal | null;
  /**
   * Renseignée seulement si la proposition est permise. Elle décide de la
   * vitesse : au client tout de suite, ou à l'échéance du lot.
   */
  voie: VoieProposition | null;
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
  situation,
  currentStart,
  proposedStart,
  now,
  memeJourCivil,
}: {
  situation: SituationProposant;
  currentStart: Date;
  proposedStart: Date;
  now: Date;
  /**
   * Les deux instants tombent-ils le même jour civil français ?
   *
   * Calculé par l'appelant avec `time.ts` : ce module est pur et ne connaît
   * aucun fuseau. Seule la pré-acceptation s'en sert.
   */
  memeJourCivil: boolean;
}): ProposalCheck {
  if (situation === "AUCUNE") {
    return {
      allowed: false,
      refusal: "RESERVATION_NON_ORPHELINE",
      voie: null,
    };
  }

  if (proposedStart.getTime() === currentStart.getTime()) {
    return { allowed: false, refusal: "CRENEAU_INCHANGE", voie: null };
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
    return { allowed: false, refusal: "CRENEAU_HORS_GRILLE", voie: null };
  }

  const leadHours = (proposedStart.getTime() - now.getTime()) / 3_600_000;
  if (leadHours < PROPOSAL_MIN_LEAD_HOURS) {
    return { allowed: false, refusal: "CRENEAU_TROP_PROCHE", voie: null };
  }

  const ecartMinutes =
    Math.abs(proposedStart.getTime() - currentStart.getTime()) / 60_000;

  /*
   * La voie rapide n'est ouverte qu'à celui qui tient une offre vivante. Sur
   * une réservation orpheline, il n'y a plus de lot à attendre : la
   * proposition part au client de toute façon, et l'appeler « pré-acceptation »
   * ne dirait rien de plus.
   */
  const rapide =
    situation === "PROPOSITION_VIVANTE" &&
    ecartMinutes <= ECART_PRE_ACCEPTATION_MINUTES;

  /*
   * Une pré-acceptation ne change jamais de jour, et ce n'est pas une
   * commodité : le prix dépend du jour — samedi, dimanche, férié — et un prix
   * qui bouge après la réservation n'est plus une proposition. Au-delà d'une
   * heure d'écart on ne passe de toute façon plus par la voie rapide.
   */
  if (rapide && !memeJourCivil) {
    return { allowed: false, refusal: "JOUR_DIFFERENT", voie: null };
  }

  return {
    allowed: true,
    refusal: null,
    voie: rapide ? "PRE_ACCEPTATION" : "CONTRE_PROPOSITION",
  };
}

/**
 * Quand cette proposition devient-elle visible du client ?
 *
 * Une pré-acceptation part tout de suite : l'intervenant s'est engagé, faire
 * attendre le client n'apporterait rien. Une contre-proposition attend
 * l'échéance du lot en cours — le client a demandé une heure, et on la cherche
 * avant de lui en proposer une autre.
 */
export function visibleAPartirDe(
  voie: VoieProposition,
  now: Date,
  echeanceDuLot: Date | null,
): Date {
  if (voie === "PRE_ACCEPTATION") return now;
  return echeanceDuLot && echeanceDuLot.getTime() > now.getTime()
    ? echeanceDuLot
    : now;
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
      return "Cette intervention n'attend plus de réponse de votre part.";
    case "JOUR_DIFFERENT":
      return "Proposez une heure le même jour : changer de jour change le tarif, donc le prix annoncé au client.";
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
