import { describe, expect, it } from "vitest";

import {
  COURT_DELAI_HEURES,
  MAJORATIONS_PAR_DEFAUT,
  chiffrerMajorations,
  majorationsApplicables,
} from "./majorations";

/** Mercredi 19 août 2026, 10 h UTC. Aucun jour particulier. */
const RESERVE_LE = new Date("2026-08-19T10:00:00Z");

/** Mardi 25 août, bien au-delà de 48 h. */
const MARDI = new Date("2026-08-25T08:00:00Z");
const SAMEDI = new Date("2026-08-29T08:00:00Z");
const DIMANCHE = new Date("2026-08-30T08:00:00Z");

describe("majorationsApplicables", () => {
  it("n'en applique aucune un mardi réservé à l'avance", () => {
    expect(majorationsApplicables(MARDI, RESERVE_LE)).toEqual([]);
  });

  it("applique le samedi à l'intervenant", () => {
    const [majoration] = majorationsApplicables(SAMEDI, RESERVE_LE);
    expect(majoration).toMatchObject({
      cause: "SAMEDI",
      rateBp: 1000,
      beneficiaire: "PROFESSIONAL",
    });
  });

  it("applique le dimanche à l'intervenant, au taux fort", () => {
    const [majoration] = majorationsApplicables(DIMANCHE, RESERVE_LE);
    expect(majoration).toMatchObject({
      cause: "DIMANCHE_FERIE",
      rateBp: 2500,
      beneficiaire: "PROFESSIONAL",
    });
  });

  /*
   * Le partage est le cœur de l'arbitrage : le jour revient à celui qui
   * travaille, l'urgence à celle qui place la mission au forceps.
   */
  it("applique le court délai à la plateforme", () => {
    const demain = new Date("2026-08-20T08:00:00Z");
    const [majoration] = majorationsApplicables(demain, RESERVE_LE);
    expect(majoration).toMatchObject({
      cause: "COURT_DELAI",
      beneficiaire: "PLATFORM",
    });
  });

  it("cumule le jour et le délai, chacun pour son bénéficiaire", () => {
    // Réservé le vendredi soir pour le dimanche : moins de 48 h.
    const reserve = new Date("2026-08-28T20:00:00Z");
    const causes = majorationsApplicables(DIMANCHE, reserve).map(
      (m) => m.cause,
    );
    expect(causes).toEqual(["DIMANCHE_FERIE", "COURT_DELAI"]);
  });

  /*
   * Une journée n'est pas les deux. Et un férié l'emporte sur le samedi :
   * l'inverse ferait payer Noël moins cher qu'un samedi ordinaire dès lors
   * qu'il tombe en fin de semaine.
   */
  it("ne cumule jamais samedi et dimanche", () => {
    for (const jour of [SAMEDI, DIMANCHE]) {
      const causes = majorationsApplicables(jour, RESERVE_LE).map(
        (m) => m.cause,
      );
      expect(causes.filter((c) => c !== "COURT_DELAI")).toHaveLength(1);
    }
  });

  it("traite un férié tombant un samedi au taux du férié", () => {
    // 15 août 2026, Assomption, tombe un samedi.
    const assomption = new Date("2026-08-15T08:00:00Z");
    const [majoration] = majorationsApplicables(assomption, RESERVE_LE);
    expect(majoration?.cause).toBe("DIMANCHE_FERIE");
    expect(majoration?.rateBp).toBe(2500);
  });

  it("nomme le férié plutôt que de le dire générique", () => {
    const toussaint = new Date("2026-11-01T08:00:00Z");
    expect(majorationsApplicables(toussaint, RESERVE_LE)[0]?.label).toBe(
      "Toussaint",
    );
  });

  it("n'applique pas le court délai exactement au seuil", () => {
    const debut = new Date(
      RESERVE_LE.getTime() + COURT_DELAI_HEURES * 3_600_000,
    );
    expect(majorationsApplicables(debut, RESERVE_LE)).toEqual([]);
  });

  it("l'applique une minute en deçà du seuil", () => {
    const debut = new Date(
      RESERVE_LE.getTime() + COURT_DELAI_HEURES * 3_600_000 - 60_000,
    );
    expect(majorationsApplicables(debut, RESERVE_LE)[0]?.cause).toBe(
      "COURT_DELAI",
    );
  });

  /*
   * Une organisation peut annuler une majoration en posant un taux nul, sans
   * qu'on ait à distinguer « absente » et « à zéro » partout ailleurs.
   */
  it("ignore une règle dont le taux est nul", () => {
    const sansSamedi = MAJORATIONS_PAR_DEFAUT.map((regle) =>
      regle.cause === "SAMEDI" ? { ...regle, rateBp: 0 } : regle,
    );
    expect(majorationsApplicables(SAMEDI, RESERVE_LE, sansSamedi)).toEqual([]);
  });
});

describe("chiffrerMajorations", () => {
  /** Trois heures de régulier : 84 € au client, 69 € à l'intervenant. */
  const BASE = 8400;

  it("ne facture rien sans majoration", () => {
    const resultat = chiffrerMajorations(BASE, []);
    expect(resultat).toMatchObject({
      totalCents: 0,
      professionalCents: 0,
      platformCents: 0,
    });
  });

  it("verse la majoration de dimanche entièrement à l'intervenant", () => {
    const resultat = chiffrerMajorations(
      BASE,
      majorationsApplicables(DIMANCHE, RESERVE_LE),
    );
    expect(resultat.totalCents).toBe(2100);
    expect(resultat.professionalCents).toBe(2100);
    expect(resultat.platformCents).toBe(0);
  });

  it("verse la majoration de délai entièrement à la plateforme", () => {
    const demain = new Date("2026-08-20T08:00:00Z");
    const resultat = chiffrerMajorations(
      BASE,
      majorationsApplicables(demain, RESERVE_LE),
    );
    expect(resultat.totalCents).toBe(840);
    expect(resultat.professionalCents).toBe(0);
    expect(resultat.platformCents).toBe(840);
  });

  /*
   * Chaque majoration porte sur la base, jamais sur le résultat de la
   * précédente : un cumul multiplicatif donnerait 37,5 % au lieu de 35 %,
   * écart que personne ne saurait expliquer à un client.
   */
  it("cumule sur la base et non en cascade", () => {
    const reserve = new Date("2026-08-28T20:00:00Z");
    const resultat = chiffrerMajorations(
      BASE,
      majorationsApplicables(DIMANCHE, reserve),
    );
    // 25 % + 10 % de 84 €, et non 84 × 1,25 × 1,10.
    expect(resultat.totalCents).toBe(2100 + 840);
    expect(resultat.professionalCents).toBe(2100);
    expect(resultat.platformCents).toBe(840);
  });

  /*
   * L'invariant du dépôt : une répartition additionne toujours exactement au
   * total. La part de la plateforme est déduite, jamais calculée à part.
   */
  it("répartit exactement, sur des milliers de combinaisons", () => {
    const causes = [
      majorationsApplicables(SAMEDI, RESERVE_LE),
      majorationsApplicables(DIMANCHE, RESERVE_LE),
      majorationsApplicables(new Date("2026-08-20T08:00:00Z"), RESERVE_LE),
      majorationsApplicables(DIMANCHE, new Date("2026-08-28T20:00:00Z")),
    ];

    for (let base = 1; base <= 2000; base += 1) {
      for (const applicables of causes) {
        const resultat = chiffrerMajorations(base * 7, applicables);
        expect(resultat.professionalCents + resultat.platformCents).toBe(
          resultat.totalCents,
        );
        expect(resultat.lignes.reduce((s, l) => s + l.amountCents, 0)).toBe(
          resultat.totalCents,
        );
      }
    }
  });

  it("n'invente pas de centime sur une base nulle", () => {
    const resultat = chiffrerMajorations(
      0,
      majorationsApplicables(DIMANCHE, RESERVE_LE),
    );
    expect(resultat.totalCents).toBe(0);
  });
});
