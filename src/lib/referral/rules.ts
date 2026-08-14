/**
 * Parrainage et cooptation.
 *
 * Deux mécaniques distinctes, parce que les deux populations n'ont ni le même
 * rapport au service ni le même statut juridique.
 *
 * **Client → client : un avoir unique.** Le parrain reçoit l'équivalent d'une
 * heure de ménage en avoir sur ses propres prestations, une seule fois par
 * filleul. Un avoir est une remise commerciale : il ne constitue pas un revenu,
 * n'a pas à être déclaré, et n'expose pas le parrain à être regardé comme
 * apporteur d'affaires — ce qui l'obligerait à s'immatriculer.
 *
 * **Intervenant → intervenant : une commission dans la durée.** Le coopteur
 * perçoit un pourcentage du chiffre d'affaires réellement réalisé par la
 * personne qu'il a fait venir, pendant une durée bornée.
 *
 * ## Pourquoi ce n'est pas un système pyramidal
 *
 * L'article L.121-15 du Code de la consommation interdit de faire espérer des
 * gains « résultant d'une progression du nombre de personnes recrutées plutôt
 * que de la vente, de la fourniture ou de la consommation de biens ou de
 * services ». Trois choix maintiennent la mécanique hors de cette définition,
 * et aucun n'est négociable :
 *
 * 1. **Un seul niveau.** Personne ne perçoit quoi que ce soit sur les filleuls
 *    de ses filleuls. `MAX_REFERRAL_DEPTH` vaut 1 et un test le vérifie.
 * 2. **Aucun droit d'entrée.** Parrainer ne coûte rien et ne suppose aucun
 *    achat préalable.
 * 3. **Le gain suit l'activité, pas le recrutement.** Rien n'est dû tant que
 *    le filleul n'a pas réalisé de prestation effectivement payée. Recruter
 *    cent personnes inactives ne rapporte rien.
 */

/**
 * Profondeur maximale du réseau.
 *
 * Vaut 1, et doit le rester. Passer à 2 ferait dépendre une partie du gain du
 * recrutement opéré par autrui, ce qui est précisément la définition de la
 * vente à la boule de neige.
 */
export const MAX_REFERRAL_DEPTH = 1;

export type ReferrerKind = "CLIENT" | "CLEANER";

/** Nature de la récompense, qui détermine son traitement fiscal. */
export type RewardKind =
  /** Avoir sur ses propres prestations : remise commerciale, non imposable. */
  | "CREDIT"
  /** Versement en espèces : revenu, déclaré par son bénéficiaire. */
  | "CASH";

export interface ReferralProgram {
  kind: ReferrerKind;
  rewardKind: RewardKind;
  /** Récompense unique au déclenchement, en centimes. Zéro si récurrente. */
  oneOffRewardCents: number;
  /** Part du chiffre d'affaires du filleul, en points de base. Zéro si unique. */
  recurringRateBp: number;
  /** Durée de la commission récurrente, en mois. */
  recurringMonths: number;
  /** Plafond mensuel de commission, tous filleuls confondus, en centimes. */
  monthlyCapCents: number;
  /** Réduction offerte au filleul sur sa première prestation, en centimes. */
  refereeDiscountCents: number;
  /**
   * Nombre de prestations que le filleul doit avoir réalisées avant que la
   * première récompense ne soit due. C'est ce seuil qui rattache le gain à
   * l'activité réelle plutôt qu'au recrutement.
   */
  qualifyingCompletedBookings: number;
  /** Délai au-delà duquel un parrainage non concrétisé expire, en jours. */
  expiryDays: number;
}

/** Tarif horaire de référence du programme client, en centimes. */
const ONE_HOUR_OF_CLEANING_CENTS = 2900;

export const REFERRAL_PROGRAMS: Readonly<
  Record<ReferrerKind, ReferralProgram>
> = {
  /**
   * Un client parraine un client : une heure de ménage offerte en avoir, une
   * seule fois, dès la première prestation du filleul.
   */
  CLIENT: {
    kind: "CLIENT",
    rewardKind: "CREDIT",
    oneOffRewardCents: ONE_HOUR_OF_CLEANING_CENTS,
    recurringRateBp: 0,
    recurringMonths: 0,
    monthlyCapCents: 0,
    refereeDiscountCents: ONE_HOUR_OF_CLEANING_CENTS,
    qualifyingCompletedBookings: 1,
    expiryDays: 90,
  },

  /**
   * Un intervenant en coopte un autre : 5 % du chiffre d'affaires du filleul
   * pendant douze mois, en espèces.
   *
   * Le seuil de cinq prestations évite de rémunérer une inscription sans
   * suite. Le plafond mensuel borne l'engagement : sans lui, la commission
   * serait impossible à provisionner, une commission de 5 % du chiffre
   * d'affaires représentant environ 13 % de la marge de coordination.
   */
  CLEANER: {
    kind: "CLEANER",
    rewardKind: "CASH",
    oneOffRewardCents: 0,
    recurringRateBp: 500,
    recurringMonths: 12,
    monthlyCapCents: 15_000,
    refereeDiscountCents: 0,
    qualifyingCompletedBookings: 5,
    expiryDays: 180,
  },
};

export type ReferralStatus =
  /** Code utilisé, filleul inscrit, conditions non encore remplies. */
  | "PENDING"
  /** Le filleul a atteint le seuil : la récompense est due. */
  | "QUALIFIED"
  /** Délai dépassé sans activité suffisante. */
  | "EXPIRED"
  /** Annulé : fraude constatée, compte supprimé, filleul remboursé. */
  | "CANCELLED";

export interface ReferralState {
  program: ReferralProgram;
  status: ReferralStatus;
  /** Prestations du filleul terminées et payées. */
  completedBookings: number;
  createdAt: Date;
  qualifiedAt: Date | null;
}

/** Erreur d'éligibilité, avec un motif affichable tel quel. */
export class ReferralRejected extends Error {
  readonly reason:
    | "SELF_REFERRAL"
    | "ALREADY_REFERRED"
    | "UNKNOWN_CODE"
    | "INACTIVE_CODE"
    | "KIND_MISMATCH";

  constructor(reason: ReferralRejected["reason"], message: string) {
    super(message);
    this.name = "ReferralRejected";
    this.reason = reason;
  }
}

export interface EligibilityInput {
  referrerUserId: string;
  refereeUserId: string;
  codeIsActive: boolean;
  /** Le filleul a-t-il déjà été parrainé, par qui que ce soit ? */
  refereeAlreadyReferred: boolean;
  /** Nature du code employé, et nature du compte du filleul. */
  codeKind: ReferrerKind;
  refereeKind: ReferrerKind;
}

/**
 * Vérifie qu'un parrainage peut être enregistré.
 *
 * Lève plutôt que de renvoyer un booléen : chaque refus a un motif distinct,
 * qui doit être affiché au filleul et journalisé.
 */
export function assertReferralEligible(input: EligibilityInput): void {
  if (input.referrerUserId === input.refereeUserId) {
    throw new ReferralRejected(
      "SELF_REFERRAL",
      "On ne peut pas utiliser son propre code de parrainage.",
    );
  }

  if (!input.codeIsActive) {
    throw new ReferralRejected(
      "INACTIVE_CODE",
      "Ce code de parrainage n'est plus valable.",
    );
  }

  // Un filleul n'est parrainé qu'une fois dans sa vie : sans cette règle, il
  // suffirait de supprimer et recréer un compte pour générer des récompenses.
  if (input.refereeAlreadyReferred) {
    throw new ReferralRejected(
      "ALREADY_REFERRED",
      "Ce compte a déjà bénéficié d'un parrainage.",
    );
  }

  // Un code d'intervenant ne parraine pas un client, et réciproquement : les
  // deux programmes n'ont ni les mêmes montants ni le même traitement fiscal.
  if (input.codeKind !== input.refereeKind) {
    throw new ReferralRejected(
      "KIND_MISMATCH",
      input.codeKind === "CLEANER"
        ? "Ce code est réservé au parrainage d'un intervenant."
        : "Ce code est réservé au parrainage d'un client.",
    );
  }
}

/** Le parrainage a-t-il atteint son seuil de déclenchement ? */
export function hasQualified(state: ReferralState): boolean {
  return state.completedBookings >= state.program.qualifyingCompletedBookings;
}

/** Date au-delà de laquelle un parrainage non concrétisé expire. */
export function expiresAt(state: ReferralState): Date {
  return new Date(
    state.createdAt.getTime() + state.program.expiryDays * 86_400_000,
  );
}

export interface AccrualInput {
  state: ReferralState;
  /** Chiffre d'affaires du filleul sur le mois considéré, en centimes. */
  refereeMonthlyRevenueCents: number;
  /** Commissions déjà acquises sur ce mois, tous filleuls confondus. */
  alreadyAccruedThisMonthCents: number;
  /** Fin du mois considéré. */
  monthEnd: Date;
}

export interface Accrual {
  amountCents: number;
  /** Le plafond mensuel a rogné la commission. */
  cappedByMonthlyLimit: boolean;
  /** La période de commission est échue. */
  windowClosed: boolean;
}

/**
 * Commission due au titre d'un mois.
 *
 * Trois conditions cumulatives : le parrainage est qualifié, la fenêtre de
 * douze mois court encore, et le plafond mensuel n'est pas atteint. Le calcul
 * porte sur le chiffre d'affaires réalisé, jamais sur le nombre de filleuls.
 */
export function monthlyAccrual({
  state,
  refereeMonthlyRevenueCents,
  alreadyAccruedThisMonthCents,
  monthEnd,
}: AccrualInput): Accrual {
  const { program } = state;

  if (
    state.status !== "QUALIFIED" ||
    state.qualifiedAt === null ||
    program.recurringRateBp === 0
  ) {
    return { amountCents: 0, cappedByMonthlyLimit: false, windowClosed: false };
  }

  const windowEnd = new Date(state.qualifiedAt);
  windowEnd.setMonth(windowEnd.getMonth() + program.recurringMonths);

  if (monthEnd > windowEnd) {
    return { amountCents: 0, cappedByMonthlyLimit: false, windowClosed: true };
  }

  const gross = Math.round(
    (refereeMonthlyRevenueCents * program.recurringRateBp) / 10_000,
  );
  const remainingCap = Math.max(
    0,
    program.monthlyCapCents - alreadyAccruedThisMonthCents,
  );
  const amountCents = Math.min(gross, remainingCap);

  return {
    amountCents,
    cappedByMonthlyLimit: amountCents < gross,
    windowClosed: false,
  };
}

/** Récompense unique due au déclenchement, s'il y en a une. */
export function oneOffReward(state: ReferralState): number {
  return state.status === "QUALIFIED" ? state.program.oneOffRewardCents : 0;
}
