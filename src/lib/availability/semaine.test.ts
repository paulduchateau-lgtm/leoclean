import { describe, expect, it } from "vitest";

import {
  type Plage,
  heureLisible,
  totalHebdomadaireMinutes,
  verifierSemaine,
} from "@/lib/availability/semaine";

/**
 * Semaine type.
 *
 * Chaque règle vérifiée ici a un coût précis si elle saute : des heures
 * vendues que personne ne peut honorer, ou un intervenant disponible que la
 * plateforme n'appelle jamais.
 */

const plage = (
  jour: Plage["jour"],
  debutHeure: number,
  finHeure: number,
): Plage => ({
  jour,
  debutMinute: Math.round(debutHeure * 60),
  finMinute: Math.round(finHeure * 60),
});

describe("vérification d'une semaine", () => {
  it("accepte une semaine ordinaire", () => {
    const semaine = [
      plage(1, 9, 17),
      plage(2, 9, 17),
      plage(3, 9, 12.5),
      plage(6, 9, 13),
    ];
    expect(verifierSemaine(semaine)).toEqual([]);
  });

  it("accepte une journée coupée en deux", () => {
    // Matin et après-midi séparés par une pause : c'est le cas le plus
    // fréquent, et il ne doit pas être pris pour un chevauchement.
    expect(verifierSemaine([plage(1, 8, 12), plage(1, 14, 18)])).toEqual([]);
  });

  it("refuse un chevauchement dans la même journée", () => {
    const anomalies = verifierSemaine([plage(1, 9, 13), plage(1, 12, 17)]);
    expect(anomalies).toEqual([{ jour: 1, erreur: "chevauchement" }]);
  });

  it("refuse une plage plus courte qu'un ménage", () => {
    // Une heure et demie ne peut accueillir aucune mission : le minimum
    // facturable est de deux heures.
    expect(verifierSemaine([plage(1, 9, 10.5)])).toEqual([
      { jour: 1, erreur: "trop-courte" },
    ]);
  });

  it("refuse une fin avant le début", () => {
    expect(verifierSemaine([plage(2, 17, 9)])).toEqual([
      { jour: 2, erreur: "ordre" },
    ]);
  });

  it("refuse ce qui ne tombe pas sur la demi-heure", () => {
    expect(
      verifierSemaine([{ jour: 3, debutMinute: 547, finMinute: 1020 }]),
    ).toEqual([{ jour: 3, erreur: "pas-respecte" }]);
  });

  it("refuse ce qui déborde de la journée", () => {
    expect(
      verifierSemaine([{ jour: 4, debutMinute: 600, finMinute: 1500 }]),
    ).toEqual([{ jour: 4, erreur: "hors-journee" }]);
  });

  it("ne signale pas deux fois la même anomalie", () => {
    // Trois plages qui se chevauchent le même jour, c'est un seul problème à
    // corriger : le répéter noierait l'information.
    const anomalies = verifierSemaine([
      plage(1, 9, 13),
      plage(1, 12, 16),
      plage(1, 15, 18),
    ]);
    expect(anomalies).toEqual([{ jour: 1, erreur: "chevauchement" }]);
  });

  it("accepte une semaine vide", () => {
    // Ne rien déclarer est un choix légitime : on ne reçoit alors aucune
    // proposition, ce qui vaut mieux qu'un refus permanent.
    expect(verifierSemaine([])).toEqual([]);
  });
});

describe("lecture", () => {
  it("dit les heures comme on les dit", () => {
    expect(heureLisible(540)).toBe("9 h");
    expect(heureLisible(570)).toBe("9 h 30");
    expect(heureLisible(0)).toBe("0 h");
  });

  it("totalise la semaine", () => {
    expect(totalHebdomadaireMinutes([plage(1, 9, 17), plage(2, 9, 12)])).toBe(
      11 * 60,
    );
  });
});
