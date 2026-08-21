import { describe, expect, it } from "vitest";

import {
  CHARTES,
  VERSION_CHARTES,
  signatureAJour,
  verifierLaSignature,
} from "./chartes";

const TOUS = CHARTES.map((charte) => charte.id);

describe("CHARTES", () => {
  /*
   * Le mandat de facturation est le seul dont l'absence rendrait fausse une
   * mention déjà imprimée : les factures portent « conformément au mandat de
   * facturation accepté par ce dernier », et l'article 289, I-2 du CGI l'exige
   * par écrit et à l'avance.
   */
  it("porte le mandat de facturation, sans lequel l'autofacturation est irrégulière", () => {
    expect(TOUS).toContain("mandat");
    const mandat = CHARTES.find((charte) => charte.id === "mandat")!;
    expect(mandat.raison).toMatch(/289/);
  });

  it("dit à quoi chaque document engage, et pourquoi il existe", () => {
    for (const charte of CHARTES) {
      expect(charte.engagement.length).toBeGreaterThan(30);
      expect(charte.raison.length).toBeGreaterThan(30);
    }
  });

  /*
   * L'engagement est rédigé à la première personne : c'est ce que la personne
   * doit pouvoir redire. « Le prestataire s'engage à » se lit comme un contrat
   * qu'on subit.
   */
  it("rédige l'engagement à la première personne", () => {
    for (const charte of CHARTES) {
      expect(charte.engagement).toMatch(/^(J'|Je )/);
    }
  });
});

describe("verifierLaSignature", () => {
  it("accepte les trois documents cochés, à la version du jour", () => {
    expect(
      verifierLaSignature({
        acceptes: TOUS,
        version: VERSION_CHARTES,
        dejaSigneEn: null,
      }),
    ).toBeNull();
  });

  /*
   * Trois engagements distincts, trois acceptations. Une case unique rendrait
   * le consentement attaquable : le mandat de facturation n'a rien à voir avec
   * la charte de qualité.
   */
  it("refuse dès qu'un seul document manque", () => {
    for (const charte of CHARTES) {
      const partiel = TOUS.filter((id) => id !== charte.id);
      expect(
        verifierLaSignature({
          acceptes: partiel,
          version: VERSION_CHARTES,
          dejaSigneEn: null,
        }),
      ).toBe("DOCUMENT_NON_ACCEPTE");
    }
  });

  /*
   * Si les textes ont changé pendant que la page était ouverte, on refuse : une
   * acceptation portant sur autre chose que ce qui a été lu ne prouve rien.
   */
  it("refuse une version qui n'est plus celle du jour", () => {
    expect(
      verifierLaSignature({
        acceptes: TOUS,
        version: "2020-01-1",
        dejaSigneEn: null,
      }),
    ).toBe("VERSION_INCONNUE");
  });

  it("refuse une seconde signature de la même version", () => {
    expect(
      verifierLaSignature({
        acceptes: TOUS,
        version: VERSION_CHARTES,
        dejaSigneEn: VERSION_CHARTES,
      }),
    ).toBe("DEJA_SIGNE");
  });

  /* Une version antérieure, elle, se re-signe : les textes ont changé. */
  it("laisse re-signer quand les documents ont évolué", () => {
    expect(
      verifierLaSignature({
        acceptes: TOUS,
        version: VERSION_CHARTES,
        dejaSigneEn: "2020-01-1",
      }),
    ).toBeNull();
  });
});

describe("signatureAJour", () => {
  it("ne vaut que pour la version courante", () => {
    expect(signatureAJour(VERSION_CHARTES)).toBe(true);
    expect(signatureAJour("2020-01-1")).toBe(false);
    expect(signatureAJour(null)).toBe(false);
  });
});
