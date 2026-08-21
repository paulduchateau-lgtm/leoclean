import { describe, expect, it } from "vitest";

import {
  type Emetteur,
  type Facture,
  decomposerTtc,
  mentionsObligatoires,
  partEligible,
  quantiteLisible,
  verifierLaFacture,
} from "./document";

const INTERVENANTE: Emetteur = {
  nom: "Émilie Ducasse",
  formeJuridique: "Entrepreneur individuel",
  adresse: ["4 rue des Vignes", "33850 Léognan"],
  siret: "89456712300019",
  regimeTva: "FRANCHISE_EN_BASE",
  tauxTvaBp: null,
  numeroSap: "SAP894567123",
  autofacturee: true,
};

function facture(surcharge: Partial<Facture> = {}): Facture {
  return {
    numero: "LC-894567123-2026-00007",
    emiseLe: "2026-08-20T10:00:00.000Z",
    executeeLe: "2026-08-19T08:00:00.000Z",
    lieu: "33170 Gradignan",
    emetteur: INTERVENANTE,
    destinataire: { nom: "Michel Crado", adresse: ["12 avenue de Chartrèze"] },
    lignes: [
      {
        designation: "Ménage à domicile",
        quantiteCentiemes: 300,
        unite: "h",
        prixUnitaireCents: 2300,
        totalCents: 6900,
      },
    ],
    totalHtCents: 6900,
    tvaCents: 0,
    totalTtcCents: 6900,
    eligibleCreditImpotCents: 6900,
    ...surcharge,
  };
}

describe("verifierLaFacture", () => {
  it("accepte une facture complète", () => {
    expect(verifierLaFacture(facture())).toEqual([]);
  });

  /*
   * L'arrêté du 3 octobre 1983 impose la date **et le lieu** d'exécution pour
   * une prestation de services à un particulier. Le lieu est celui qu'on oublie.
   */
  it("exige la date et le lieu d'exécution", () => {
    expect(verifierLaFacture(facture({ executeeLe: "" }))).toContain(
      "DATE_EXECUTION",
    );
    expect(verifierLaFacture(facture({ lieu: "  " }))).toContain("LIEU");
  });

  it("exige un décompte détaillé, pas un total", () => {
    expect(verifierLaFacture(facture({ lignes: [] }))).toContain(
      "AUCUNE_LIGNE",
    );
  });

  it("refuse une ligne sans quantité ni prix unitaire", () => {
    const sansQuantite = facture({
      lignes: [
        {
          designation: "Ménage",
          quantiteCentiemes: 0,
          unite: "h",
          prixUnitaireCents: 2300,
          totalCents: 6900,
        },
      ],
    });
    expect(verifierLaFacture(sansQuantite)).toContain("LIGNE_INCOMPLETE");
  });

  it("refuse un total qui ne suit pas ses lignes", () => {
    expect(verifierLaFacture(facture({ totalHtCents: 7000 }))).toContain(
      "TOTAL_INCOHERENT",
    );
    expect(verifierLaFacture(facture({ totalTtcCents: 7000 }))).toContain(
      "TOTAL_INCOHERENT",
    );
  });

  it("exige le taux de TVA d'un émetteur assujetti", () => {
    const assujetti = facture({
      emetteur: { ...INTERVENANTE, regimeTva: "ASSUJETTI", tauxTvaBp: null },
    });
    expect(verifierLaFacture(assujetti)).toContain("TVA_SANS_TAUX");
  });

  /*
   * Le garde-fou qui compte : annoncer une part éligible sans déclaration
   * ferait porter au client une réduction que l'administration lui reprendrait.
   */
  it("refuse une part éligible sans numéro de déclaration", () => {
    const nonDeclare = facture({
      emetteur: { ...INTERVENANTE, numeroSap: null },
    });
    expect(verifierLaFacture(nonDeclare)).toContain(
      "CREDIT_IMPOT_SANS_DECLARATION",
    );
  });

  it("accepte un émetteur non déclaré dont la part éligible est nulle", () => {
    const nonDeclare = facture({
      emetteur: { ...INTERVENANTE, numeroSap: null },
      eligibleCreditImpotCents: 0,
    });
    expect(verifierLaFacture(nonDeclare)).toEqual([]);
  });
});

describe("mentionsObligatoires", () => {
  it("porte la franchise en base", () => {
    expect(mentionsObligatoires(facture()).join(" ")).toContain(
      "article 293 B du CGI",
    );
  });

  it("ne porte pas la franchise pour un assujetti", () => {
    const assujetti = facture({
      emetteur: { ...INTERVENANTE, regimeTva: "ASSUJETTI", tauxTvaBp: 2000 },
    });
    expect(mentionsObligatoires(assujetti).join(" ")).not.toContain("293 B");
  });

  /*
   * L'autofacturation sans sa mention rend la facture irrégulière — article
   * 289, I-2 du CGI. C'est celle qu'un gabarit oublie.
   */
  it("nomme le mandat quand la facture est établie pour le compte d'un autre", () => {
    const mentions = mentionsObligatoires(facture()).join(" ");
    expect(mentions).toContain("au nom et pour le compte de Émilie Ducasse");
  });

  it("se tait sur le mandat quand l'émetteur facture pour lui-même", () => {
    const propreCompte = facture({
      emetteur: { ...INTERVENANTE, autofacturee: false },
    });
    expect(mentionsObligatoires(propreCompte).join(" ")).not.toContain(
      "pour le compte",
    );
  });

  it("annonce la déclaration SAP quand elle existe", () => {
    expect(mentionsObligatoires(facture()).join(" ")).toContain("SAP894567123");
  });

  /*
   * Rien sur le crédit d'impôt sans déclaration : c'est la même frontière que
   * `fiscal.ts` tient pour le site, appliquée facture par facture.
   */
  it("ne dit pas un mot du crédit d'impôt sans déclaration", () => {
    const nonDeclare = facture({
      emetteur: { ...INTERVENANTE, numeroSap: null },
      eligibleCreditImpotCents: 0,
    });
    const mentions = mentionsObligatoires(nonDeclare).join(" ");
    expect(mentions).not.toMatch(
      /crédit d'impôt|199 sexdecies|avantage fiscal/i,
    );
    expect(mentions).not.toContain("SAP");
  });
});

describe("partEligible", () => {
  it("rend le montant quand l'émetteur est déclaré", () => {
    expect(partEligible(6900, "SAP894567123")).toBe(6900);
  });

  it("rend zéro sans déclaration, quelle que soit la prestation", () => {
    expect(partEligible(6900, null)).toBe(0);
  });
});

describe("quantiteLisible", () => {
  it("écrit les centièmes en heures", () => {
    expect(
      quantiteLisible({
        designation: "Ménage",
        quantiteCentiemes: 350,
        unite: "h",
        prixUnitaireCents: 2300,
        totalCents: 8050,
      }),
    ).toBe("3,5 h");
  });
});

describe("decomposerTtc", () => {
  it("laisse le montant intact en franchise en base", () => {
    expect(decomposerTtc(6900, "FRANCHISE_EN_BASE", null)).toEqual({
      htCents: 6900,
      tvaCents: 0,
    });
  });

  /*
   * La règle qui compte : le client est annoncé un prix tout compris, et les
   * deux factures se partagent ce prix-là. La TVA s'en **extrait**. L'ajouter
   * ferait somme des deux factures supérieure à ce que le client a réglé — le
   * même défaut que d'annoncer un prix et d'en prélever un autre.
   */
  it("extrait la TVA du montant, sans jamais l'y ajouter", () => {
    const { htCents, tvaCents } = decomposerTtc(12_000, "ASSUJETTI", 2000);
    expect(htCents).toBe(10_000);
    expect(tvaCents).toBe(2000);
    expect(htCents + tvaCents).toBe(12_000);
  });

  /* `ht + tva === ttc` au centime, quel que soit l'arrondi. */
  it("retombe toujours exactement sur le montant d'origine", () => {
    for (let ttc = 1; ttc <= 5000; ttc += 1) {
      const { htCents, tvaCents } = decomposerTtc(ttc, "ASSUJETTI", 2000);
      expect(htCents + tvaCents).toBe(ttc);
    }
  });

  it("ignore un taux absent, faute de quoi il diviserait par le vide", () => {
    expect(decomposerTtc(6900, "ASSUJETTI", null)).toEqual({
      htCents: 6900,
      tvaCents: 0,
    });
  });

  /*
   * Le cas qui a motivé le test : à 20 %, une part de coordination de 84,36 €
   * est du TTC. La traiter comme du HT la porterait à 101,23 € et la somme des
   * deux factures dépasserait de 16,87 € ce que le client a payé.
   */
  it("garde la somme des deux factures égale au prix client", () => {
    const prixClient = 22_200;
    const intervenant = 13_764;
    const plateforme = prixClient - intervenant;

    const partIntervenant = decomposerTtc(
      intervenant,
      "FRANCHISE_EN_BASE",
      null,
    );
    const partPlateforme = decomposerTtc(plateforme, "ASSUJETTI", 2000);

    const totalFacture =
      partIntervenant.htCents +
      partIntervenant.tvaCents +
      partPlateforme.htCents +
      partPlateforme.tvaCents;

    expect(totalFacture).toBe(prixClient);
  });
});
