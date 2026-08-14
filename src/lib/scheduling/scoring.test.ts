import { describe, expect, it } from "vitest";

import {
  MAX_INSERTION_COST_MINUTES,
  NEUTRAL_RATING_SCORE,
  SCORE_WEIGHTS,
  type ScoreInput,
  scoreAssignment,
  scoreBreakdown,
} from "@/lib/scheduling/scoring";

function input(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    insertionCostMinutes: 20,
    ratingAverage: 4.5,
    ratingCount: 30,
    acceptanceRate: 0.9,
    assignedMinutesInPeriod: 600,
    isPreferred: false,
    ...overrides,
  };
}

describe("score d'attribution", () => {
  it("somme des pondérations égale à un", () => {
    // Sans cela, le score ne serait pas comparable d'une version à l'autre et
    // les seuils écrits ailleurs deviendraient faux en silence.
    const total = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("reste dans [0, 1] même aux extrêmes", () => {
    const pire = scoreAssignment(
      input({
        insertionCostMinutes: 999,
        ratingAverage: 1,
        ratingCount: 5,
        acceptanceRate: 0,
        assignedMinutesInPeriod: 100_000,
      }),
    );
    const meilleur = scoreAssignment(
      input({
        insertionCostMinutes: 0,
        ratingAverage: 5,
        ratingCount: 100,
        acceptanceRate: 1,
        assignedMinutesInPeriod: 0,
        isPreferred: true,
      }),
    );

    expect(pire.score).toBeGreaterThanOrEqual(0);
    expect(meilleur.score).toBeLessThanOrEqual(1);
    expect(meilleur.score).toBeGreaterThan(pire.score);
  });

  it("décroît quand le trajet s'allonge", () => {
    const court = scoreAssignment(input({ insertionCostMinutes: 5 })).score;
    const long = scoreAssignment(input({ insertionCostMinutes: 45 })).score;
    expect(court).toBeGreaterThan(long);
  });

  it("annule la composante trajet au-delà du plafond", () => {
    // Une heure de route ajoutée n'est pas une mauvaise attribution, c'est une
    // attribution qui ne devrait pas exister.
    expect(
      scoreBreakdown(
        input({ insertionCostMinutes: MAX_INSERTION_COST_MINUTES }),
      ).travel,
    ).toBe(0);
    expect(scoreBreakdown(input({ insertionCostMinutes: 500 })).travel).toBe(0);
  });

  it("donne une note neutre à un intervenant sans avis", () => {
    // Le mettre à zéro reviendrait à le sanctionner pour n'avoir pas encore
    // travaillé : il ne recevrait jamais sa première mission.
    expect(
      scoreBreakdown(input({ ratingCount: 0, ratingAverage: 0 })).rating,
    ).toBe(NEUTRAL_RATING_SCORE);
  });

  it("place la continuité au-dessus d'un trajet un peu plus long", () => {
    // L'intervenante attitrée doit l'emporter sur une inconnue mieux placée :
    // « le même intervenant chaque semaine » est la promesse centrale.
    const attitree = scoreAssignment(
      input({ isPreferred: true, insertionCostMinutes: 25 }),
    ).score;
    const inconnue = scoreAssignment(
      input({ isPreferred: false, insertionCostMinutes: 5 }),
    ).score;

    expect(attitree).toBeGreaterThan(inconnue);
  });

  it("ne laisse pas la continuité couvrir un trajet déraisonnable", () => {
    // Au-delà du plafond de trajet, la fidélité ne suffit plus.
    const attitreeLoin = scoreAssignment(
      input({ isPreferred: true, insertionCostMinutes: 60 }),
    ).score;
    const inconnueProche = scoreAssignment(
      input({ isPreferred: false, insertionCostMinutes: 0, ratingAverage: 5 }),
    ).score;

    expect(attitreeLoin).toBeLessThan(inconnueProche);
  });

  it("favorise l'intervenant le moins chargé, toutes choses égales", () => {
    const peuCharge = scoreAssignment(
      input({ assignedMinutesInPeriod: 0 }),
    ).score;
    const tresCharge = scoreAssignment(
      input({ assignedMinutesInPeriod: 2000 }),
    ).score;
    expect(peuCharge).toBeGreaterThan(tresCharge);
  });

  it("expose une décomposition complète et bornée", () => {
    // Elle est conservée en base pour qu'une décision contestée puisse être
    // relue plutôt que devinée.
    const { breakdown } = scoreAssignment(input());
    expect(Object.keys(breakdown).sort()).toEqual(
      Object.keys(SCORE_WEIGHTS).sort(),
    );
    for (const [key, value] of Object.entries(breakdown)) {
      expect(value, key).toBeGreaterThanOrEqual(0);
      expect(value, key).toBeLessThanOrEqual(1);
    }
  });

  it("arrondit le score à quatre décimales", () => {
    const { score } = scoreAssignment(input({ insertionCostMinutes: 7 }));
    expect(score).toBe(Math.round(score * 10_000) / 10_000);
  });
});
