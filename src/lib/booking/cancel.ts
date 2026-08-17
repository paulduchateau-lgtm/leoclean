import type { BookingStatus } from "@prisma/client";

import {
  type CancellationOutcome,
  cancellationFee,
} from "@/lib/pricing/cancellation";

/**
 * Ce qu'un client a le droit d'annuler, et ce que ça lui coûte.
 *
 * Le module est **pur** : ni base, ni horloge implicite, ni session. C'est ce
 * qui permet de tester la veille d'une intervention, une minute avant, et
 * l'heure passée, sans monter quoi que ce soit.
 *
 * L'espace client n'offrait pas l'annulation, et le dépôt disait pourquoi :
 * elle suppose des transitions de statut, la libération du créneau et
 * l'information de l'intervenant. Ces trois choses existent maintenant —
 * `BookingStatusEvent` pour la trace, le statut terminal de l'affectation pour
 * le créneau, un message pour l'intervenant — donc le bouton peut exister sans
 * mentir.
 */

/**
 * Statuts qu'un client peut encore annuler lui-même.
 *
 * En cours, terminée ou déjà annulée, l'annulation n'a plus de sens et ce qui
 * se joue relève du litige, pas du barème. On renvoie alors vers le téléphone
 * plutôt que de laisser un bouton produire un état incohérent.
 */
const CANCELLABLE_STATUSES: readonly BookingStatus[] = [
  "PENDING_ASSIGNMENT",
  "ASSIGNED",
  "CONFIRMED",
];

export type CancellationRefusal =
  /** Déjà annulée, terminée, en cours ou en litige. */
  | "STATUT_NON_ANNULABLE"
  /** L'heure de début est passée : c'est une absence, pas une annulation. */
  | "INTERVENTION_COMMENCEE";

export interface CancellationDecision {
  allowed: boolean;
  refusal: CancellationRefusal | null;
  /**
   * Ce que l'annulation coûterait, calculé même quand elle est refusée.
   *
   * L'écran affiche le montant **avant** que le client confirme : découvrir
   * des frais après avoir cliqué est exactement ce qu'on reproche aux
   * services qu'on remplace.
   */
  outcome: CancellationOutcome;
}

export function decideCancellation({
  status,
  grossAmountCents,
  scheduledStart,
  now,
}: {
  status: BookingStatus;
  grossAmountCents: number;
  scheduledStart: Date;
  now: Date;
}): CancellationDecision {
  const outcome = cancellationFee({
    grossAmountCents,
    scheduledStart,
    cancelledAt: now,
  });

  if (!CANCELLABLE_STATUSES.includes(status)) {
    return { allowed: false, refusal: "STATUT_NON_ANNULABLE", outcome };
  }

  // Strictement après le début : à l'heure pile, l'intervenant n'est pas
  // encore entré et le client peut encore se raviser. Le doute lui profite,
  // comme dans le barème lui-même.
  if (now.getTime() > scheduledStart.getTime()) {
    return { allowed: false, refusal: "INTERVENTION_COMMENCEE", outcome };
  }

  return { allowed: true, refusal: null, outcome };
}

/** Message affiché quand l'annulation en autonomie n'est pas possible. */
export function refusalMessage(refusal: CancellationRefusal): string {
  switch (refusal) {
    case "INTERVENTION_COMMENCEE":
      return "L'intervention a commencé. Appelez-nous : ce qui se passe maintenant ne relève plus du barème.";
    case "STATUT_NON_ANNULABLE":
      return "Cette intervention ne peut plus être annulée depuis votre espace. Appelez-nous, nous regardons ensemble.";
  }
}
