import { describe, expect, it } from "vitest";

import {
  type LigneVersement,
  type Organisme,
  anneeClose,
  composerAttestation,
  mentionsAttestation,
  versementsDeLannee,
} from "./attestation";

const ORGANISME: Organisme = {
  nom: "Émilie Ducasse",
  adresse: ["4 rue des Vignes", "33850 Léognan"],
  siret: "89456712300019",
  numeroSap: "SAP894567123",
};

const BENEFICIAIRE = {
  nom: "Michel Crado",
  adresse: ["12 avenue de Chartrèze", "33170 Gradignan"],
};

const MAINTENANT = new Date("2027-02-10T09:00:00Z");

function ligne(surcharge: Partial<LigneVersement> = {}): LigneVersement {
  return {
    encaisseLe: new Date("2026-06-15T10:00:00Z"),
    montantCents: 6900,
    rembourseCents: 0,
    eligibleCents: 6900,
    prestationRealisee: true,
    ...surcharge,
  };
}

function attester(lignes: LigneVersement[], annee = 2026) {
  return composerAttestation({
    annee,
    organisme: ORGANISME,
    beneficiaire: BENEFICIAIRE,
    lignes,
    maintenant: MAINTENANT,
  });
}

describe("anneeClose", () => {
  it("refuse l'année en cours", () => {
    expect(anneeClose(2027, MAINTENANT)).toBe(false);
  });

  it("accepte l'année précédente", () => {
    expect(anneeClose(2026, MAINTENANT)).toBe(true);
  });
});

describe("versementsDeLannee", () => {
  /*
   * La règle qui décide de tout : l'avantage porte sur les sommes versées dans
   * l'année. Une prestation de décembre payée en janvier appartient à l'année
   * du paiement — c'est le cas de tout abonné, donc de la clientèle visée.
   */
  it("range un encaissement de janvier dans l'année du paiement", () => {
    const decembre = ligne({ encaisseLe: new Date("2027-01-02T09:00:00Z") });
    expect(versementsDeLannee([decembre], 2026)).toHaveLength(0);
    expect(versementsDeLannee([decembre], 2027)).toHaveLength(1);
  });

  /*
   * Le 31 décembre à 23 h 30 heure de Paris, il est déjà le 1ᵉʳ janvier en UTC :
   * l'année civile est locale, pas universelle.
   */
  it("suit l'année civile française", () => {
    const reveillon = ligne({ encaisseLe: new Date("2026-12-31T23:30:00Z") });
    expect(versementsDeLannee([reveillon], 2026)).toHaveLength(0);
    expect(versementsDeLannee([reveillon], 2027)).toHaveLength(1);
  });
});

describe("composerAttestation", () => {
  it("totalise les versements de l'année", () => {
    const resultat = attester([ligne(), ligne(), ligne()]);
    expect(resultat).toMatchObject({
      attestation: {
        verseCents: 20_700,
        eligibleCents: 20_700,
        prestations: 3,
      },
    });
  });

  it("refuse d'attester sans déclaration", () => {
    const resultat = composerAttestation({
      annee: 2026,
      organisme: { ...ORGANISME, numeroSap: null },
      beneficiaire: BENEFICIAIRE,
      lignes: [ligne()],
      maintenant: MAINTENANT,
    });
    expect(resultat).toEqual({ refus: "ORGANISME_NON_DECLARE" });
  });

  it("refuse une année qui n'est pas close", () => {
    expect(attester([ligne()], 2027)).toEqual({ refus: "ANNEE_NON_CLOSE" });
  });

  it("refuse quand rien n'a été versé", () => {
    expect(attester([])).toEqual({ refus: "AUCUN_VERSEMENT" });
  });

  /*
   * Attester d'un montant qu'on a rendu ferait déduire au client un impôt
   * qu'il devra restituer.
   */
  it("déduit un remboursement du montant attesté", () => {
    const resultat = attester([ligne({ rembourseCents: 2300 })]);
    expect(resultat).toMatchObject({
      attestation: { verseCents: 4600, eligibleCents: 4600 },
    });
  });

  it("réduit la part éligible au prorata, en arrondissant vers le bas", () => {
    /* 6 900 versés dont 5 000 éligibles, un tiers remboursé. */
    const resultat = attester([
      ligne({ eligibleCents: 5000, rembourseCents: 2300 }),
    ]);
    expect(resultat).toMatchObject({
      attestation: {
        verseCents: 4600,
        /* 5 000 × 4 600 / 6 900 = 3 333,33 → 3 333, jamais 3 334. */
        eligibleCents: 3333,
      },
    });
  });

  it("ne rend jamais une ligne négative", () => {
    const resultat = attester([ligne(), ligne({ rembourseCents: 999_999 })]);
    expect(resultat).toMatchObject({
      attestation: { verseCents: 6900, prestations: 1 },
    });
  });

  /*
   * Des frais d'annulation indemnisent un créneau perdu : aucune prestation
   * n'a été rendue, et le crédit d'impôt rémunère un service.
   */
  it("écarte les frais d'annulation, et les compte à part", () => {
    const resultat = attester([
      ligne(),
      ligne({
        montantCents: 2000,
        eligibleCents: 0,
        prestationRealisee: false,
      }),
    ]);
    expect(resultat).toMatchObject({
      attestation: {
        verseCents: 6900,
        eligibleCents: 6900,
        prestations: 1,
        ecarteCents: 2000,
      },
    });
  });

  /* La part éligible ne peut jamais dépasser ce qui a été versé. */
  it("borne la part éligible au montant net", () => {
    const resultat = attester([ligne({ eligibleCents: 999_999 })]);
    const { attestation } = resultat as {
      attestation: { eligibleCents: number; verseCents: number };
    };
    expect(attestation.eligibleCents).toBeLessThanOrEqual(
      attestation.verseCents,
    );
  });

  /*
   * Le plafond de 12 000 € s'applique au foyer, sur l'ensemble de ses
   * organismes. Le poser ici sous-déclarerait un client qui fait aussi appel à
   * quelqu'un d'autre.
   */
  it("ne plafonne pas le montant attesté", () => {
    const resultat = attester(Array.from({ length: 200 }, () => ligne())) as {
      attestation: { verseCents: number };
    };
    expect(resultat.attestation.verseCents).toBe(1_380_000);
  });
});

describe("mentionsAttestation", () => {
  const { attestation } = attester([ligne()]) as {
    attestation: Parameters<typeof mentionsAttestation>[0];
  };

  it("dit que le montant est celui des sommes versées", () => {
    expect(mentionsAttestation(attestation).join(" ")).toMatch(
      /effectivement versées/,
    );
  });

  /*
   * L'avertissement qui compte autant que le montant : un client qui déclare
   * le brut sans déduire son CESU préfinancé se fait redresser.
   */
  it("avertit qu'il faut déduire les aides perçues", () => {
    const mentions = mentionsAttestation(attestation).join(" ");
    expect(mentions).toMatch(/CESU préfinancé/);
    expect(mentions).toMatch(/APA/);
  });

  it("annonce le plafond", () => {
    expect(
      mentionsAttestation(attestation).join(" ").replace(/\s/g, " "),
    ).toContain("12 000 €");
  });

  it("se tait sur les frais d'annulation quand il n'y en a pas", () => {
    expect(mentionsAttestation(attestation).join(" ")).not.toMatch(
      /frais d'annulation/,
    );
  });

  it("explique le montant manquant quand des frais ont été écartés", () => {
    const avecFrais = attester([
      ligne(),
      ligne({
        montantCents: 2000,
        eligibleCents: 0,
        prestationRealisee: false,
      }),
    ]) as { attestation: Parameters<typeof mentionsAttestation>[0] };

    expect(mentionsAttestation(avecFrais.attestation).join(" ")).toMatch(
      /frais d'annulation/,
    );
  });
});
