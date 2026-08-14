import { applyRate, capAmount } from "./money";

/**
 * Frais d'annulation.
 *
 * Le barème vient des conditions générales. Il poursuit deux objectifs qui
 * s'opposent : dédommager l'intervenant, dont le créneau devient invendable à
 * mesure que l'échéance approche, sans transformer une annulation légitime en
 * sanction disproportionnée.
 *
 * D'où des paliers **plafonnés en euros** : au-delà d'un certain montant, le
 * pourcentage cesse de croître. Annuler un grand ménage de 200 € deux heures
 * avant coûte 30 €, pas 160 €.
 */

export interface CancellationTier {
  /** Borne basse, en heures avant le début de la prestation. */
  fromHoursBefore: number;
  /** Part du montant retenue, en points de base. */
  rateBp: number;
  /** Plafond en centimes. */
  capCents: number;
  label: string;
}

/**
 * Paliers, du plus lointain au plus proche.
 *
 * Les intervalles sont fermés à gauche : annuler exactement 24 heures avant
 * est gratuit, exactement 8 heures avant coûte 5 €. Le doute profite au
 * client, qui n'a pas à surveiller la minute près.
 */
export const CANCELLATION_TIERS: readonly CancellationTier[] = [
  {
    fromHoursBefore: 24,
    rateBp: 0,
    capCents: 0,
    label: "Annulation gratuite",
  },
  {
    fromHoursBefore: 8,
    rateBp: 0,
    capCents: 500,
    label: "Entre 8 et 24 heures avant",
  },
  {
    fromHoursBefore: 4,
    rateBp: 0,
    capCents: 1000,
    label: "Entre 4 et 8 heures avant",
  },
  {
    fromHoursBefore: 2,
    rateBp: 5000,
    capCents: 2000,
    label: "Entre 2 et 4 heures avant",
  },
  {
    fromHoursBefore: 0,
    rateBp: 8000,
    capCents: 3000,
    label: "Moins de 2 heures avant",
  },
] as const;

/**
 * Absence du client, ou annulation après l'heure de rendez-vous.
 *
 * L'intervenant s'est déplacé : la totalité est due, dans la limite du plafond.
 */
export const NO_SHOW_TIER: CancellationTier = {
  fromHoursBefore: Number.NEGATIVE_INFINITY,
  rateBp: 10_000,
  capCents: 4000,
  label: "Absence ou annulation après le rendez-vous",
};

/** Paliers à taux nul mais plafond non nul : le montant retenu est forfaitaire. */
function tierAmount(tier: CancellationTier, grossAmountCents: number): number {
  if (tier.rateBp === 0) {
    return tier.capCents;
  }
  return capAmount(applyRate(grossAmountCents, tier.rateBp), tier.capCents);
}

export interface CancellationInput {
  grossAmountCents: number;
  /** Début de la prestation. */
  scheduledStart: Date;
  /** Instant de l'annulation. */
  cancelledAt: Date;
  /** Le client ne s'est pas présenté, ou a annulé après l'heure convenue. */
  noShow?: boolean;
}

export interface CancellationOutcome {
  feeCents: number;
  /** Montant remboursé au client, si le paiement a déjà été capturé. */
  refundCents: number;
  tier: CancellationTier;
  hoursBefore: number;
}

export function cancellationFee({
  grossAmountCents,
  scheduledStart,
  cancelledAt,
  noShow = false,
}: CancellationInput): CancellationOutcome {
  const hoursBefore =
    (scheduledStart.getTime() - cancelledAt.getTime()) / 3_600_000;

  if (noShow || hoursBefore < 0) {
    const feeCents = tierAmount(NO_SHOW_TIER, grossAmountCents);
    return {
      feeCents,
      refundCents: grossAmountCents - feeCents,
      tier: NO_SHOW_TIER,
      hoursBefore,
    };
  }

  const tier =
    CANCELLATION_TIERS.find(
      (candidate) => hoursBefore >= candidate.fromHoursBefore,
    ) ?? CANCELLATION_TIERS[CANCELLATION_TIERS.length - 1]!;

  const feeCents = capAmount(
    tierAmount(tier, grossAmountCents),
    grossAmountCents,
  );

  return {
    feeCents,
    refundCents: grossAmountCents - feeCents,
    tier,
    hoursBefore,
  };
}

/**
 * Une annulation par l'intervenant n'est jamais facturée au client.
 *
 * Le produit ne doit créer aucun lien de subordination : un intervenant
 * indépendant peut se désister, et c'est à la plateforme de réattribuer, pas
 * au client d'en supporter le coût. Le geste commercial se décide au cas par
 * cas, hors de ce barème.
 */
export function cleanerCancellationFee(): CancellationOutcome {
  return {
    feeCents: 0,
    refundCents: 0,
    tier: {
      fromHoursBefore: Number.NEGATIVE_INFINITY,
      rateBp: 0,
      capCents: 0,
      label: "Annulation par l'intervenant",
    },
    hoursBefore: 0,
  };
}
