import { describe, expect, it } from "vitest";

import { cancellationFee, cleanerCancellationFee } from "./cancellation";
import {
  MAX_DURATION_MINUTES,
  durationChoices,
  estimateDuration,
} from "./duration";
import {
  amountForDuration,
  applyRate,
  effectiveRateBp,
  formatDuration,
  formatEuros,
  formatHourlyRate,
  split,
} from "./money";
import { quote, quoteToBookingAmounts } from "./quote";

/** Prestation standard du catalogue : 25 m²/h, minimum deux heures. */
const MENAGE_REGULIER = {
  slug: "menage-regulier",
  name: "Ménage régulier",
  sqmPerHour: 25,
  minDurationMinutes: 120,
};

const GRAND_MENAGE = {
  slug: "grand-menage",
  name: "Grand ménage",
  sqmPerHour: 15,
  minDurationMinutes: 180,
};

const REPASSAGE = {
  slug: "repassage",
  name: "Repassage",
  extraMinutes: 60,
  extraPriceCents: 0,
};

const VITRES = {
  slug: "vitres",
  name: "Nettoyage des vitres",
  extraMinutes: 30,
  extraPriceCents: 0,
};

/** Grille retenue : 29 €/h en régulier, 33 €/h en ponctuel, marge 38 %. */
const REGULAR_RATE = 2800;
const REGULAR_PRO_RATE = 2300;
const ONE_OFF_RATE = 3000;
const ONE_OFF_PRO_RATE = 2100;
const TAX_CREDIT_BP = 5000;

describe("arithmétique monétaire", () => {
  it("refuse un montant en flottant", () => {
    expect(() => applyRate(29.5, 5000)).toThrow(/entier de centimes/);
  });

  it("garantit qu'une répartition additionne exactement au total", () => {
    // Propriété centrale : quel que soit le taux, les deux factures
    // recomposent le prix annoncé. Un écart d'un centime est un litige.
    for (let amount = 0; amount <= 20_000; amount += 7) {
      for (const rate of [0, 1200, 3800, 5000, 6667, 10_000]) {
        const { share, remainder } = split(amount, rate);
        expect(share + remainder).toBe(amount);
        expect(Number.isInteger(share)).toBe(true);
        expect(Number.isInteger(remainder)).toBe(true);
      }
    }
  });

  it("calcule le montant d'une durée au taux horaire", () => {
    expect(amountForDuration(REGULAR_RATE, 120)).toBe(5600);
    expect(amountForDuration(REGULAR_RATE, 150)).toBe(7000);
    expect(amountForDuration(REGULAR_RATE, 90)).toBe(4200);
  });

  it("déduit le taux effectif d'une part", () => {
    expect(effectiveRateBp(1100, 2900)).toBe(3793);
    expect(effectiveRateBp(0, 0)).toBe(0);
  });
});

describe("estimation de durée", () => {
  it("propose deux heures pour un T2 de 45 m²", () => {
    const estimate = estimateDuration({
      surfaceSqm: 45,
      service: MENAGE_REGULIER,
    });
    expect(estimate.durationMinutes).toBe(120);
  });

  it("propose trois heures pour une maison de 100 m²", () => {
    // 100 / 25 = 4 h. L'arrondi au pas supérieur ne change rien ici.
    expect(
      estimateDuration({ surfaceSqm: 100, service: MENAGE_REGULIER })
        .durationMinutes,
    ).toBe(240);
  });

  it("arrondit au pas de trente minutes supérieur", () => {
    // 80 m² à 25 m²/h font 3 h 12 : on propose 3 h 30 plutôt que 3 h, pour ne
    // pas mettre l'intervenant en retard sur la mission suivante.
    const estimate = estimateDuration({
      surfaceSqm: 80,
      service: MENAGE_REGULIER,
    });
    expect(estimate.rawMinutes).toBeCloseTo(192, 5);
    expect(estimate.durationMinutes).toBe(210);
  });

  it("relève au plancher de la prestation pour un studio", () => {
    const estimate = estimateDuration({
      surfaceSqm: 20,
      service: MENAGE_REGULIER,
    });
    expect(estimate.durationMinutes).toBe(120);
    expect(estimate.clampedToMinimum).toBe(true);
  });

  it("ajoute le temps des options", () => {
    const withoutOptions = estimateDuration({
      surfaceSqm: 60,
      service: MENAGE_REGULIER,
    });
    const withOptions = estimateDuration({
      surfaceSqm: 60,
      service: MENAGE_REGULIER,
      optionMinutes: REPASSAGE.extraMinutes + VITRES.extraMinutes,
    });

    expect(withoutOptions.durationMinutes).toBe(150);
    expect(withOptions.durationMinutes).toBe(240);
  });

  it("plafonne une intervention à six heures", () => {
    const estimate = estimateDuration({
      surfaceSqm: 400,
      service: MENAGE_REGULIER,
    });
    expect(estimate.durationMinutes).toBe(MAX_DURATION_MINUTES);
    expect(estimate.clampedToMaximum).toBe(true);
  });

  it("tient compte du rendement propre à chaque prestation", () => {
    // Un grand ménage traite 15 m²/h contre 25 pour l'entretien courant.
    expect(
      estimateDuration({ surfaceSqm: 90, service: GRAND_MENAGE })
        .durationMinutes,
    ).toBe(360);
  });

  it("refuse une surface nulle ou négative", () => {
    expect(() =>
      estimateDuration({ surfaceSqm: 0, service: MENAGE_REGULIER }),
    ).toThrow(/strictement positive/);
  });

  it("propose des durées d'ajustement bornées par le catalogue", () => {
    const estimate = estimateDuration({
      surfaceSqm: 45,
      service: MENAGE_REGULIER,
    });
    // Le pas inférieur passerait sous le minimum de deux heures : il est écarté.
    expect(durationChoices(estimate, MENAGE_REGULIER)).toEqual([120, 150, 180]);
  });
});

describe("devis", () => {
  it("chiffre un ménage régulier de 80 m² à Léognan", () => {
    const result = quote({
      service: MENAGE_REGULIER,
      options: [],
      surfaceSqm: 80,
      frequency: "WEEKLY",
      hourlyRateCents: REGULAR_RATE,
      professionalHourlyRateCents: REGULAR_PRO_RATE,
      taxCreditRateBp: TAX_CREDIT_BP,
    });

    expect(result.durationMinutes).toBe(210);
    expect(result.grossAmountCents).toBe(9800); // 3 h 30 à 28 €
    expect(formatEuros(result.grossAmountCents)).toMatch(/^98,00/);
  });

  it("répartit exactement le total entre les deux factures", () => {
    const result = quote({
      service: MENAGE_REGULIER,
      options: [],
      surfaceSqm: 80,
      frequency: "WEEKLY",
      hourlyRateCents: REGULAR_RATE,
      professionalHourlyRateCents: REGULAR_PRO_RATE,
      taxCreditRateBp: TAX_CREDIT_BP,
    });

    expect(result.professionalAmountCents + result.platformFeeAmountCents).toBe(
      result.grossAmountCents,
    );
    // 3 h 30 : 23 € l'heure pour l'intervenant, 5 € pour la coordination.
    expect(result.professionalAmountCents).toBe(8050);
    expect(result.platformFeeAmountCents).toBe(1750);
  });

  it("respecte l'économie annoncée dans les conditions générales", () => {
    // Une heure à 29 € doit laisser environ 18 € à l'intervenant, la
    // coordination prenant les 11 € restants.
    const result = quote({
      service: { ...MENAGE_REGULIER, minDurationMinutes: 60 },
      options: [],
      surfaceSqm: 25,
      frequency: "WEEKLY",
      hourlyRateCents: REGULAR_RATE,
      professionalHourlyRateCents: REGULAR_PRO_RATE,
      taxCreditRateBp: TAX_CREDIT_BP,
    });

    expect(result.grossAmountCents).toBe(2800);
    // 23 € pour l'intervenant, 5 € de coordination : la marge est un écart
    // horaire, pas un pourcentage.
    expect(result.professionalAmountCents).toBe(2300);
    expect(result.platformFeeAmountCents).toBe(500);
  });

  it("calcule le crédit d'impôt facture par facture", () => {
    /*
     * Chaque organisme déclaré émet sa propre attestation sur son propre
     * montant : le crédit se calcule facture par facture, jamais sur le total.
     *
     * Conséquence assumée : quand les deux arrondis tombent du même côté, la
     * somme dépasse d'un centime ce qu'un calcul global aurait donné. L'écart
     * profite au client, et vaut mieux que deux attestations dont la somme ne
     * retombe pas juste.
     *
     * La grille actuelle ne le produit pas : ses tarifs sont des euros ronds et
     * les durées des multiples de trente minutes, si bien que les deux parts
     * tombent toujours sur des centimes pairs. Le second cas force donc la
     * situation, pour que la règle reste vérifiée le jour où un tarif cesse
     * d'être rond.
     */
    const result = quote({
      service: MENAGE_REGULIER,
      options: [],
      surfaceSqm: 80,
      frequency: "WEEKLY",
      hourlyRateCents: REGULAR_RATE,
      professionalHourlyRateCents: REGULAR_PRO_RATE,
      taxCreditRateBp: TAX_CREDIT_BP,
    });

    expect(result.taxCreditAmountCents).toBe(
      Math.round((result.grossAmountCents * TAX_CREDIT_BP) / 10_000),
    );
    expect(
      result.professionalTaxCreditCents + result.platformTaxCreditCents,
    ).toBe(result.taxCreditAmountCents);

    // Deux parts impaires : chaque arrondi monte d'un demi-centime.
    const impair = quote({
      // Le plancher de deux heures ramènerait la durée sur un multiple qui
      // annule l'effet : on l'abaisse pour obtenir une heure et demie.
      service: { ...MENAGE_REGULIER, minDurationMinutes: 60 },
      options: [],
      surfaceSqm: 37,
      frequency: "WEEKLY",
      hourlyRateCents: 2704,
      professionalHourlyRateCents: 2202,
      taxCreditRateBp: TAX_CREDIT_BP,
    });

    expect(impair.professionalAmountCents % 2).toBe(1);
    expect(impair.platformFeeAmountCents % 2).toBe(1);
    expect(impair.taxCreditAmountCents).toBe(
      Math.round((impair.grossAmountCents * TAX_CREDIT_BP) / 10_000) + 1,
    );
    expect(
      impair.professionalTaxCreditCents + impair.platformTaxCreditCents,
    ).toBe(impair.taxCreditAmountCents);
  });

  it("laisse un reste à charge de moitié", () => {
    const result = quote({
      service: MENAGE_REGULIER,
      options: [],
      surfaceSqm: 100,
      frequency: "WEEKLY",
      hourlyRateCents: REGULAR_RATE,
      professionalHourlyRateCents: REGULAR_PRO_RATE,
      taxCreditRateBp: TAX_CREDIT_BP,
    });

    expect(result.grossAmountCents).toBe(11_200);
    expect(result.netAmountCents).toBe(5600);
  });

  it("facture les options en temps, pas en supplément de taux", () => {
    const withOptions = quote({
      service: MENAGE_REGULIER,
      options: [REPASSAGE, VITRES],
      surfaceSqm: 60,
      frequency: "WEEKLY",
      hourlyRateCents: REGULAR_RATE,
      professionalHourlyRateCents: REGULAR_PRO_RATE,
      taxCreditRateBp: TAX_CREDIT_BP,
    });

    expect(withOptions.durationMinutes).toBe(240);
    expect(withOptions.grossAmountCents).toBe(11_200);
    expect(withOptions.lines).toHaveLength(3);
    expect(withOptions.lines[1]?.label).toBe("Repassage");
  });

  it("applique le tarif ponctuel, plus élevé que le régulier", () => {
    const commonInput = {
      service: MENAGE_REGULIER,
      options: [],
      surfaceSqm: 80,
      taxCreditRateBp: TAX_CREDIT_BP,
    };

    const regular = quote({
      ...commonInput,
      frequency: "WEEKLY",
      hourlyRateCents: REGULAR_RATE,
      professionalHourlyRateCents: REGULAR_PRO_RATE,
    });
    const oneOff = quote({
      ...commonInput,
      frequency: "ONE_OFF",
      hourlyRateCents: ONE_OFF_RATE,
      professionalHourlyRateCents: ONE_OFF_PRO_RATE,
    });

    expect(oneOff.grossAmountCents).toBeGreaterThan(regular.grossAmountCents);
    expect(oneOff.grossAmountCents - regular.grossAmountCents).toBe(700);
  });

  it("prend en compte la durée ajustée par le client", () => {
    const result = quote({
      service: MENAGE_REGULIER,
      options: [],
      surfaceSqm: 80,
      frequency: "WEEKLY",
      hourlyRateCents: REGULAR_RATE,
      professionalHourlyRateCents: REGULAR_PRO_RATE,
      taxCreditRateBp: TAX_CREDIT_BP,
      durationOverrideMinutes: 180,
    });

    expect(result.durationMinutes).toBe(180);
    expect(result.estimatedDurationMinutes).toBe(210);
    expect(result.durationAdjusted).toBe(true);
    expect(result.grossAmountCents).toBe(8400);
  });

  it("refuse une durée inférieure au minimum de la prestation", () => {
    expect(() =>
      quote({
        service: MENAGE_REGULIER,
        options: [],
        surfaceSqm: 80,
        frequency: "WEEKLY",
        hourlyRateCents: REGULAR_RATE,
        professionalHourlyRateCents: REGULAR_PRO_RATE,
        taxCreditRateBp: TAX_CREDIT_BP,
        durationOverrideMinutes: 60,
      }),
    ).toThrow(/inférieure au minimum/);
  });

  it("laisse la totalité à une société opérant en prestataire", () => {
    const result = quote({
      service: MENAGE_REGULIER,
      options: [],
      surfaceSqm: 80,
      frequency: "WEEKLY",
      hourlyRateCents: REGULAR_RATE,
      // Une société prestataire encaisse la totalité : sa rémunération horaire
      // est le tarif lui-même, et la coordination tombe à zéro.
      professionalHourlyRateCents: REGULAR_RATE,
      taxCreditRateBp: TAX_CREDIT_BP,
    });

    expect(result.platformFeeAmountCents).toBe(0);
    expect(result.professionalAmountCents).toBe(result.grossAmountCents);
  });

  it("produit des montants compatibles avec les contraintes de la base", () => {
    const amounts = quoteToBookingAmounts(
      quote({
        service: MENAGE_REGULIER,
        options: [REPASSAGE],
        surfaceSqm: 95,
        frequency: "BIWEEKLY",
        hourlyRateCents: REGULAR_RATE,
        professionalHourlyRateCents: REGULAR_PRO_RATE,
        taxCreditRateBp: TAX_CREDIT_BP,
      }),
    );

    // Les deux invariants vérifiés en base par contrainte CHECK.
    expect(
      amounts.professionalAmountCents + amounts.platformFeeAmountCents,
    ).toBe(amounts.grossAmountCents);
    expect(amounts.netAmountCents).toBe(
      amounts.grossAmountCents - amounts.taxCreditAmountCents,
    );
    for (const value of Object.values(amounts)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe("frais d'annulation", () => {
  const scheduledStart = new Date("2026-09-01T08:00:00Z");
  const grossAmountCents = 10_150;

  const feeAt = (hoursBefore: number) =>
    cancellationFee({
      grossAmountCents,
      scheduledStart,
      cancelledAt: new Date(scheduledStart.getTime() - hoursBefore * 3_600_000),
    });

  it("ne facture rien au-delà de vingt-quatre heures", () => {
    expect(feeAt(48).feeCents).toBe(0);
    // La borne est inclusive : le client n'a pas à surveiller la minute près.
    expect(feeAt(24).feeCents).toBe(0);
  });

  it("retient cinq euros entre huit et vingt-quatre heures", () => {
    expect(feeAt(23.9).feeCents).toBe(500);
    expect(feeAt(8).feeCents).toBe(500);
  });

  it("retient dix euros entre quatre et huit heures", () => {
    expect(feeAt(7.9).feeCents).toBe(1000);
    expect(feeAt(4).feeCents).toBe(1000);
  });

  it("retient la moitié, plafonnée à vingt euros, entre deux et quatre heures", () => {
    expect(feeAt(3).feeCents).toBe(2000);
    // Sur une petite prestation, le plafond ne mord pas.
    expect(
      cancellationFee({
        grossAmountCents: 3000,
        scheduledStart,
        cancelledAt: new Date(scheduledStart.getTime() - 3 * 3_600_000),
      }).feeCents,
    ).toBe(1500);
  });

  it("retient 80 %, plafonnés à trente euros, en deçà de deux heures", () => {
    expect(feeAt(1).feeCents).toBe(3000);
    expect(
      cancellationFee({
        grossAmountCents: 3000,
        scheduledStart,
        cancelledAt: new Date(scheduledStart.getTime() - 3_600_000),
      }).feeCents,
    ).toBe(2400);
  });

  it("facture la totalité, plafonnée à quarante euros, en cas d'absence", () => {
    const outcome = cancellationFee({
      grossAmountCents,
      scheduledStart,
      cancelledAt: new Date(scheduledStart.getTime() + 1_800_000),
      noShow: true,
    });

    expect(outcome.feeCents).toBe(4000);
    expect(outcome.refundCents).toBe(grossAmountCents - 4000);
  });

  it("plafonne les frais au montant de la prestation elle-même", () => {
    // Un ménage à 15 € ne peut pas engendrer 30 € de frais.
    const outcome = cancellationFee({
      grossAmountCents: 1500,
      scheduledStart,
      cancelledAt: new Date(scheduledStart.getTime() - 600_000),
    });

    expect(outcome.feeCents).toBeLessThanOrEqual(1500);
  });

  it("ne facture jamais le client lorsque l'intervenant se désiste", () => {
    // Le produit ne doit créer aucun lien de subordination : un indépendant
    // peut se désister, et c'est à la plateforme de réattribuer.
    expect(cleanerCancellationFee().feeCents).toBe(0);
  });
});

describe("formatage", () => {
  /**
   * `Intl` insère une espace fine insécable avant le symbole monétaire, ce qui
   * est la typographie française correcte. On la normalise pour écrire des
   * attentes lisibles, sans pour autant l'ôter de l'affichage réel.
   */
  const normalize = (value: string) => value.replace(/[\u202f\u00a0]/g, " ");

  it("affiche les euros à la française", () => {
    expect(normalize(formatEuros(10_150))).toBe("101,50 €");
    expect(normalize(formatEuros(0))).toBe("0,00 €");
  });

  it("conserve l'espace fine insécable avant le symbole euro", () => {
    // Un espace ordinaire autoriserait un retour à la ligne entre le montant
    // et le symbole, ce que la typographie française proscrit.
    expect(formatEuros(2900)).toMatch(/[\u202f\u00a0]€$/);
  });

  it("omet les décimales inutiles sur un taux horaire", () => {
    expect(normalize(formatHourlyRate(2900))).toBe("29 €/h");
    expect(normalize(formatHourlyRate(2890))).toBe("28,90 €/h");
  });

  it("affiche les durées comme on les dit", () => {
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(210)).toBe("3 h 30");
    expect(formatDuration(45)).toBe("45 min");
  });
});
