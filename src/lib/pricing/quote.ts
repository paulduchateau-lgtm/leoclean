import type { Frequency } from "@prisma/client";

import {
  type BasisPoints,
  amountForDuration,
  applyRate,
  effectiveRateBp,
} from "./money";
import { type DurationParameters, estimateDuration } from "./duration";

/**
 * Moteur de tarification.
 *
 * Fonction pure : mêmes entrées, même devis, sans base de données ni horloge.
 * C'est ce qui la rend testable exhaustivement, et c'est important — elle
 * produit le montant que le client paie, ce que l'intervenant perçoit, et la
 * base du crédit d'impôt.
 *
 * Le devis se lit à deux niveaux. Le client voit un total et un reste à
 * charge ; la comptabilité voit deux factures, émises par deux entités
 * distinctes, dont la somme est ce total.
 */

export interface QuoteOption {
  slug: string;
  name: string;
  extraMinutes: number;
  extraPriceCents: number;
}

export interface QuoteServiceInput extends DurationParameters {
  slug: string;
  name: string;
}

export interface QuoteInput {
  service: QuoteServiceInput;
  options: readonly QuoteOption[];
  surfaceSqm: number;
  frequency: Frequency;
  hourlyRateCents: number;
  /**
   * Ce que perçoit l'intervenant, par heure.
   *
   * **C'est la grandeur primaire de la répartition**, et la coordination est ce
   * qui reste — jamais l'inverse. La raison n'est pas comptable mais juridique :
   * la rémunération est un montant proposé à l'intervenant, qu'il accepte avant
   * de prendre la mission. Un pourcentage appliqué après coup décrirait une
   * relation que le modèle refuse.
   *
   * Égale au tarif horaire pour une société qui opère en prestataire : elle
   * encaisse la totalité, la marge de coordination est nulle.
   */
  professionalHourlyRateCents: number;
  /** Taux du crédit d'impôt services à la personne. 5 000 = 50 %. */
  taxCreditRateBp: BasisPoints;
  /** Durée choisie par le client, si différente de l'estimation. */
  durationOverrideMinutes?: number;
}

export interface QuoteLine {
  kind: "SERVICE" | "OPTION";
  slug: string;
  label: string;
  extraMinutes: number;
  amountCents: number;
}

export interface Quote {
  durationMinutes: number;
  estimatedDurationMinutes: number;
  /** La durée retenue diffère de l'estimation, le client l'ayant ajustée. */
  durationAdjusted: boolean;
  hourlyRateCents: number;
  frequency: Frequency;

  /** Ce que règle le client, toutes lignes confondues. */
  grossAmountCents: number;

  /**
   * Les deux factures. En mise en relation, l'intervenant facture sa
   * prestation pour son propre compte et la plateforme sa coordination.
   */
  professionalAmountCents: number;
  platformFeeAmountCents: number;
  commissionRateBp: BasisPoints;

  /**
   * Crédit d'impôt, calculé ligne par ligne puis totalisé.
   *
   * L'ordre importe : chaque organisme déclaré émet sa propre attestation
   * fiscale, sur son propre montant. Calculer le crédit sur le total puis le
   * répartir produirait des attestations dont la somme ne retomberait pas sur
   * le crédit annoncé.
   *
   * Conséquence assumée : lorsque les deux arrondis tombent du même côté, le
   * crédit total dépasse d'un centime celui qu'un calcul global aurait donné.
   * L'écart profite au client, et il vaut mieux que des attestations fausses.
   */
  taxCreditRateBp: BasisPoints;
  taxCreditAmountCents: number;
  professionalTaxCreditCents: number;
  platformTaxCreditCents: number;

  /** Reste à charge réel, une fois le crédit d'impôt déduit. */
  netAmountCents: number;

  lines: QuoteLine[];
}

export function quote(input: QuoteInput): Quote {
  const {
    service,
    options,
    surfaceSqm,
    frequency,
    hourlyRateCents,
    professionalHourlyRateCents,
    taxCreditRateBp,
    durationOverrideMinutes,
  } = input;

  const optionMinutes = options.reduce(
    (total, option) => total + option.extraMinutes,
    0,
  );

  const estimate = estimateDuration({ surfaceSqm, service, optionMinutes });
  const durationMinutes = durationOverrideMinutes ?? estimate.durationMinutes;

  if (durationMinutes < service.minDurationMinutes) {
    throw new Error(
      `La durée demandée (${durationMinutes} min) est inférieure au minimum de ` +
        `la prestation « ${service.name} » (${service.minDurationMinutes} min).`,
    );
  }

  // Le temps est facturé une seule fois, options comprises : celles-ci allongent
  // la durée plutôt que de s'ajouter au prix horaire. Un supplément forfaitaire
  // reste possible pour les options qui coûtent en fournitures.
  const timeAmountCents = amountForDuration(hourlyRateCents, durationMinutes);
  const optionSurchargeCents = options.reduce(
    (total, option) => total + option.extraPriceCents,
    0,
  );
  const grossAmountCents = timeAmountCents + optionSurchargeCents;

  if (professionalHourlyRateCents > hourlyRateCents) {
    throw new Error(
      `La rémunération horaire de l'intervenant (${professionalHourlyRateCents} c) ` +
        `dépasse le tarif client (${hourlyRateCents} c) : la coordination serait négative.`,
    );
  }

  /*
   * On calcule la part de l'intervenant, et la coordination est le reste. C'est
   * la règle de toutes les répartitions du dépôt : deux parts calculées
   * séparément finissent par ne plus retomber sur le total, et c'est le client
   * qui lit la différence.
   *
   * Le supplément forfaitaire d'une option suit l'intervenant : il paie des
   * fournitures, pas une prestation de coordination. La marge de la plateforme
   * reste donc exactement l'écart horaire, ni plus ni moins.
   */
  const professionalAmountCents =
    amountForDuration(professionalHourlyRateCents, durationMinutes) +
    optionSurchargeCents;
  const platformFeeAmountCents = grossAmountCents - professionalAmountCents;

  const professionalTaxCreditCents = applyRate(
    professionalAmountCents,
    taxCreditRateBp,
  );
  const platformTaxCreditCents = applyRate(
    platformFeeAmountCents,
    taxCreditRateBp,
  );
  const taxCreditAmountCents =
    professionalTaxCreditCents + platformTaxCreditCents;

  const lines: QuoteLine[] = [
    {
      kind: "SERVICE",
      slug: service.slug,
      label: service.name,
      extraMinutes: durationMinutes - optionMinutes,
      amountCents: timeAmountCents,
    },
    ...options.map<QuoteLine>((option) => ({
      kind: "OPTION",
      slug: option.slug,
      label: option.name,
      extraMinutes: option.extraMinutes,
      amountCents: option.extraPriceCents,
    })),
  ];

  return {
    durationMinutes,
    estimatedDurationMinutes: estimate.durationMinutes,
    durationAdjusted: durationMinutes !== estimate.durationMinutes,
    hourlyRateCents,
    frequency,

    grossAmountCents,
    professionalAmountCents,
    platformFeeAmountCents,
    commissionRateBp: effectiveRateBp(platformFeeAmountCents, grossAmountCents),

    taxCreditRateBp,
    taxCreditAmountCents,
    professionalTaxCreditCents,
    platformTaxCreditCents,

    netAmountCents: grossAmountCents - taxCreditAmountCents,

    lines,
  };
}

/**
 * Projette un devis sur les colonnes de `Booking`.
 *
 * Point de passage unique entre le moteur et la persistance : c'est ce qui
 * garantit que ce qui est affiché au client et ce qui est enregistré sont le
 * même calcul, et que les contraintes de cohérence posées en base ne sont
 * jamais violées.
 */
export function quoteToBookingAmounts(value: Quote) {
  return {
    durationMinutes: value.durationMinutes,
    hourlyRateCents: value.hourlyRateCents,
    grossAmountCents: value.grossAmountCents,
    professionalAmountCents: value.professionalAmountCents,
    platformFeeAmountCents: value.platformFeeAmountCents,
    commissionRateBp: value.commissionRateBp,
    taxCreditRateBp: value.taxCreditRateBp,
    taxCreditAmountCents: value.taxCreditAmountCents,
    netAmountCents: value.netAmountCents,
  };
}
