import { describe, expect, it } from "vitest";

import {
  RANG_MAXIMUM,
  SERIE_PLATEFORME,
  analyserNumero,
  anneeDemission,
  composerNumero,
  serieIntervenant,
  trousDansLaSuite,
} from "./numerotation";

describe("serieIntervenant", () => {
  it("compose une série dédiée à partir du SIREN", () => {
    expect(serieIntervenant("894567123")).toBe("LC-894567123");
  });

  it("tolère les espaces d'un SIREN recopié", () => {
    expect(serieIntervenant("894 567 123")).toBe("LC-894567123");
  });

  /*
   * Un SIREN tronqué produirait deux séries différentes pour la même personne,
   * donc deux suites qui se recouvrent. Mieux vaut échouer à l'écriture.
   */
  it("refuse un SIREN qui n'en est pas un", () => {
    expect(() => serieIntervenant("8945671")).toThrow(/neuf chiffres/);
  });

  it("se distingue de la série de la plateforme", () => {
    expect(serieIntervenant("894567123")).not.toBe(SERIE_PLATEFORME);
  });
});

describe("composerNumero", () => {
  it("cadre le rang sur cinq chiffres", () => {
    expect(composerNumero({ serie: "LC", annee: 2026, rang: 42 })).toBe(
      "LC-2026-00042",
    );
  });

  /*
   * Deux longueurs dans la même suite casseraient le tri alphabétique des
   * exports comptables, sur une suite censée être chronologique.
   */
  it("refuse de déborder sur six chiffres", () => {
    expect(() =>
      composerNumero({ serie: "LC", annee: 2026, rang: RANG_MAXIMUM + 1 }),
    ).toThrow(/pleine/);
  });

  it("refuse un rang nul : la suite commence à un", () => {
    expect(() =>
      composerNumero({ serie: "LC", annee: 2026, rang: 0 }),
    ).toThrow();
  });
});

describe("analyserNumero", () => {
  it("relit un numéro de la plateforme", () => {
    expect(analyserNumero("LC-2026-00042")).toEqual({
      serie: "LC",
      annee: 2026,
      rang: 42,
    });
  });

  /*
   * Le cas qui casse une lecture naïve : la série d'un intervenant contient
   * elle-même un tiret. Découper par la gauche rendrait « LC » et une année de
   * neuf chiffres.
   */
  it("relit un numéro d'intervenant, dont la série porte un tiret", () => {
    expect(analyserNumero("LC-894567123-2026-00007")).toEqual({
      serie: "LC-894567123",
      annee: 2026,
      rang: 7,
    });
  });

  it("rend null sur ce qui n'est pas un numéro", () => {
    for (const entree of [
      "",
      "LC-2026",
      "LC-2026-7",
      "facture",
      "2026-00007",
    ]) {
      expect(analyserNumero(entree)).toBeNull();
    }
  });

  it("fait l'aller-retour", () => {
    const numero = { serie: "LC-894567123", annee: 2031, rang: 12_345 };
    expect(analyserNumero(composerNumero(numero))).toEqual(numero);
  });
});

describe("anneeDemission", () => {
  /*
   * L'exercice comptable est civil et local. Une facture émise le 1ᵉʳ janvier à
   * 00 h 30 à Paris appartient à l'année qui commence — en UTC il est encore
   * le 31 décembre.
   */
  it("suit l'année civile française, pas UTC", () => {
    expect(anneeDemission(new Date("2026-12-31T23:30:00Z"))).toBe(2027);
    expect(anneeDemission(new Date("2026-06-30T23:30:00Z"))).toBe(2026);
  });
});

describe("trousDansLaSuite", () => {
  it("ne trouve rien dans une suite continue", () => {
    expect(
      trousDansLaSuite(["LC-2026-00001", "LC-2026-00002", "LC-2026-00003"]),
    ).toEqual([]);
  });

  /*
   * Un trou se présume être une facture retirée : c'est la première chose que
   * l'administration cherche. On le nomme, on ne le répare pas.
   */
  it("nomme les rangs manquants", () => {
    expect(trousDansLaSuite(["LC-2026-00001", "LC-2026-00004"])).toEqual([
      2, 3,
    ]);
  });

  it("ignore ce qui n'est pas un numéro", () => {
    expect(trousDansLaSuite(["LC-2026-00001", "brouillon"])).toEqual([]);
  });
});
