import { describe, expect, it } from "vitest";

import {
  generateReferralCode,
  isWellFormedCode,
  normalizeReferralCode,
} from "./code";
import {
  MAX_REFERRAL_DEPTH,
  REFERRAL_PROGRAMS,
  ReferralRejected,
  type ReferralState,
  assertReferralEligible,
  expiresAt,
  hasQualified,
  monthlyAccrual,
  oneOffReward,
} from "./rules";

const eligibleInput = {
  referrerUserId: "parrain",
  refereeUserId: "filleul",
  codeIsActive: true,
  refereeAlreadyReferred: false,
  codeKind: "CLIENT" as const,
  refereeKind: "CLIENT" as const,
};

function stateFor(
  kind: "CLIENT" | "CLEANER",
  overrides: Partial<ReferralState> = {},
): ReferralState {
  return {
    program: REFERRAL_PROGRAMS[kind],
    status: "PENDING",
    completedBookings: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    qualifiedAt: null,
    ...overrides,
  };
}

describe("cadre juridique du programme", () => {
  it("ne comporte qu'un seul niveau", () => {
    // Passer à 2 ferait dépendre une part du gain du recrutement opéré par
    // autrui : c'est la définition de la vente à la boule de neige, interdite
    // par l'article L.121-15 du Code de la consommation.
    expect(MAX_REFERRAL_DEPTH).toBe(1);
  });

  it("subordonne toute récompense à une activité réelle", () => {
    // Recruter cent personnes inactives ne doit rien rapporter.
    for (const program of Object.values(REFERRAL_PROGRAMS)) {
      expect(program.qualifyingCompletedBookings).toBeGreaterThanOrEqual(1);
    }
  });

  it("récompense les clients en avoir, non en espèces", () => {
    // Un avoir est une remise commerciale ; un versement récurrent ferait du
    // parrain un apporteur d'affaires, tenu de s'immatriculer.
    expect(REFERRAL_PROGRAMS.CLIENT.rewardKind).toBe("CREDIT");
    expect(REFERRAL_PROGRAMS.CLIENT.recurringRateBp).toBe(0);
  });

  it("borne la commission des intervenants dans le temps et en montant", () => {
    const program = REFERRAL_PROGRAMS.CLEANER;
    expect(program.recurringMonths).toBeGreaterThan(0);
    expect(program.monthlyCapCents).toBeGreaterThan(0);
  });
});

describe("éligibilité", () => {
  it("accepte un parrainage régulier", () => {
    expect(() => assertReferralEligible(eligibleInput)).not.toThrow();
  });

  it("refuse l'auto-parrainage", () => {
    expect(() =>
      assertReferralEligible({ ...eligibleInput, refereeUserId: "parrain" }),
    ).toThrow(ReferralRejected);
  });

  it("refuse un filleul déjà parrainé", () => {
    // Sans cette règle, supprimer puis recréer un compte suffirait à générer
    // des récompenses en boucle.
    try {
      assertReferralEligible({
        ...eligibleInput,
        refereeAlreadyReferred: true,
      });
      expect.unreachable();
    } catch (error) {
      expect((error as ReferralRejected).reason).toBe("ALREADY_REFERRED");
    }
  });

  it("refuse un code désactivé", () => {
    expect(() =>
      assertReferralEligible({ ...eligibleInput, codeIsActive: false }),
    ).toThrow(/plus valable/);
  });

  it("refuse qu'un code d'intervenant parraine un client", () => {
    try {
      assertReferralEligible({ ...eligibleInput, codeKind: "CLEANER" });
      expect.unreachable();
    } catch (error) {
      expect((error as ReferralRejected).reason).toBe("KIND_MISMATCH");
    }
  });
});

describe("déclenchement", () => {
  it("qualifie un client dès sa première prestation", () => {
    expect(hasQualified(stateFor("CLIENT", { completedBookings: 1 }))).toBe(
      true,
    );
    expect(hasQualified(stateFor("CLIENT", { completedBookings: 0 }))).toBe(
      false,
    );
  });

  it("exige cinq missions d'un intervenant coopté", () => {
    expect(hasQualified(stateFor("CLEANER", { completedBookings: 4 }))).toBe(
      false,
    );
    expect(hasQualified(stateFor("CLEANER", { completedBookings: 5 }))).toBe(
      true,
    );
  });

  it("offre une heure de ménage au parrain d'un client", () => {
    const reward = oneOffReward(
      stateFor("CLIENT", { status: "QUALIFIED", completedBookings: 1 }),
    );
    expect(reward).toBe(2900);
  });

  it("ne verse rien tant que le parrainage n'est pas qualifié", () => {
    expect(oneOffReward(stateFor("CLIENT"))).toBe(0);
  });

  it("fait expirer un parrainage resté sans suite", () => {
    const state = stateFor("CLIENT");
    expect(expiresAt(state).toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });
});

describe("commission des intervenants", () => {
  const qualified = stateFor("CLEANER", {
    status: "QUALIFIED",
    completedBookings: 5,
    qualifiedAt: new Date("2026-01-15T00:00:00Z"),
  });

  it("verse 5 % du chiffre d'affaires du filleul", () => {
    const accrual = monthlyAccrual({
      state: qualified,
      refereeMonthlyRevenueCents: 180_000,
      alreadyAccruedThisMonthCents: 0,
      monthEnd: new Date("2026-02-28T00:00:00Z"),
    });

    expect(accrual.amountCents).toBe(9000);
    expect(accrual.cappedByMonthlyLimit).toBe(false);
  });

  it("ne verse rien sur un filleul sans activité", () => {
    // Le gain suit l'activité, jamais le nombre de recrues.
    expect(
      monthlyAccrual({
        state: qualified,
        refereeMonthlyRevenueCents: 0,
        alreadyAccruedThisMonthCents: 0,
        monthEnd: new Date("2026-02-28T00:00:00Z"),
      }).amountCents,
    ).toBe(0);
  });

  it("applique le plafond mensuel, tous filleuls confondus", () => {
    const accrual = monthlyAccrual({
      state: qualified,
      refereeMonthlyRevenueCents: 400_000,
      alreadyAccruedThisMonthCents: 12_000,
      monthEnd: new Date("2026-02-28T00:00:00Z"),
    });

    // 5 % de 4 000 € font 200 €, mais il ne reste que 30 € sous le plafond.
    expect(accrual.amountCents).toBe(3000);
    expect(accrual.cappedByMonthlyLimit).toBe(true);
  });

  it("s'arrête au terme des douze mois", () => {
    const accrual = monthlyAccrual({
      state: qualified,
      refereeMonthlyRevenueCents: 180_000,
      alreadyAccruedThisMonthCents: 0,
      monthEnd: new Date("2027-02-28T00:00:00Z"),
    });

    expect(accrual.amountCents).toBe(0);
    expect(accrual.windowClosed).toBe(true);
  });

  it("verse encore le dernier mois de la fenêtre", () => {
    const accrual = monthlyAccrual({
      state: qualified,
      refereeMonthlyRevenueCents: 100_000,
      alreadyAccruedThisMonthCents: 0,
      monthEnd: new Date("2027-01-10T00:00:00Z"),
    });

    expect(accrual.amountCents).toBe(5000);
  });

  it("ne verse rien tant que le seuil de cinq missions n'est pas atteint", () => {
    expect(
      monthlyAccrual({
        state: stateFor("CLEANER", { completedBookings: 3 }),
        refereeMonthlyRevenueCents: 180_000,
        alreadyAccruedThisMonthCents: 0,
        monthEnd: new Date("2026-02-28T00:00:00Z"),
      }).amountCents,
    ).toBe(0);
  });
});

describe("codes", () => {
  /** Générateur déterministe, pour que le test ne dépende pas du hasard. */
  const sequence = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length]!;
  };

  it("produit un code de la forme attendue", () => {
    const code = generateReferralCode({ random: sequence([0.1, 0.5, 0.9]) });
    expect(isWellFormedCode(code)).toBe(true);
    expect(code).toHaveLength(6);
  });

  it("n'emploie aucun caractère ambigu", () => {
    // 0 et O, 1 et I et L, 2 et Z, 5 et S, 8 et B : autant de codes recopiés de
    // travers, et de parrainages perdus.
    for (let i = 0; i < 200; i += 1) {
      expect(generateReferralCode()).not.toMatch(/[OIL01258BSZ]/);
    }
  });

  it("accepte un préfixe lisible", () => {
    const code = generateReferralCode({ prefix: "so", random: () => 0 });
    expect(code.startsWith("SO")).toBe(true);
  });

  it("normalise une saisie humaine sans deviner", () => {
    expect(normalizeReferralCode(" ah-4k 7m ")).toBe("AH4K7M");
  });

  it("ne substitue pas les caractères qui se ressemblent", () => {
    // Remplacer O par Q transformerait un code faux en un autre code valide,
    // et attribuerait le parrainage à un tiers.
    expect(normalizeReferralCode("QO")).toBe("QO");
    expect(isWellFormedCode(normalizeReferralCode("QO"))).toBe(false);
  });
});
