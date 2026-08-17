import { describe, expect, it } from "vitest";

import { REQUIRED_DOCUMENTS, activationState } from "@/lib/cleaner/activation";

const NOW = new Date("2026-09-01T00:00:00Z");
const SIRET = "89822870500015";
const ASSURANCE = new Date("2027-06-01T00:00:00Z");

const COMPLET = {
  siret: SIRET,
  sapDeclarationNumber: "SAP898228705",
  insuranceExpiresAt: ASSURANCE,
  documents: REQUIRED_DOCUMENTS.map((type) => ({
    type,
    status: "APPROVED" as const,
  })),
  now: NOW,
};

describe("activation d'un intervenant", () => {
  it("valide un dossier complet", () => {
    const state = activationState(COMPLET);
    expect(state.ready).toBe(true);
    expect(state.missing).toEqual([]);
    expect(state.warnings).toEqual([]);
  });

  it("exige les quatre pièces, une par une", () => {
    // La liste est exactement celle promise aux clients sous « professionnels
    // vérifiés » : les deux faces du site doivent dire la même chose.
    for (const manquante of REQUIRED_DOCUMENTS) {
      const state = activationState({
        ...COMPLET,
        documents: COMPLET.documents.filter(
          (document) => document.type !== manquante,
        ),
      });
      expect(state.ready).toBe(false);
      expect(state.missing).toHaveLength(1);
    }
  });

  it("distingue une pièce refusée d'une pièce absente", () => {
    // Renvoyer la même chose serait cruel et faux : l'un doit envoyer, l'autre
    // doit recommencer.
    const state = activationState({
      ...COMPLET,
      documents: COMPLET.documents.map((document) =>
        document.type === "IDENTITY"
          ? { ...document, status: "REJECTED" as const }
          : document,
      ),
    });

    expect(state.ready).toBe(false);
    expect(state.missing[0]).toContain("refusé");
  });

  it("refuse un SIRET qui ne passe pas sa clé", () => {
    const state = activationState({ ...COMPLET, siret: "89822870500016" });
    expect(state.ready).toBe(false);
    expect(state.missing.join(" ")).toContain("clé");
  });

  it("refuse une assurance périmée", () => {
    const state = activationState({
      ...COMPLET,
      insuranceExpiresAt: new Date("2026-08-01T00:00:00Z"),
    });
    expect(state.ready).toBe(false);
    expect(state.missing.join(" ")).toContain("responsabilité civile");
  });

  it("prévient d'une assurance qui expire bientôt, sans bloquer", () => {
    const state = activationState({
      ...COMPLET,
      insuranceExpiresAt: new Date("2026-09-15T00:00:00Z"),
    });
    expect(state.ready).toBe(true);
    expect(state.warnings.join(" ")).toContain("expire bientôt");
  });

  it("laisse travailler sans numéro SAP, mais le dit", () => {
    // Arbitrage : la déclaration met des semaines à être instruite, et refuser
    // de faire travailler quelqu'un en attendant reviendrait à ne recruter
    // personne au lancement. Mais sa part n'ouvre alors aucun crédit d'impôt,
    // et le taire tromperait le client autant que l'intervenant.
    const state = activationState({ ...COMPLET, sapDeclarationNumber: null });
    expect(state.ready).toBe(true);
    expect(state.warnings.join(" ")).toContain("crédit d'impôt");
  });

  it("énumère tout ce qui manque sur un dossier vide", () => {
    const state = activationState({
      siret: null,
      sapDeclarationNumber: null,
      insuranceExpiresAt: null,
      documents: [],
      now: NOW,
    });

    expect(state.ready).toBe(false);
    // SIRET, assurance, puis les quatre pièces.
    expect(state.missing.length).toBe(2 + REQUIRED_DOCUMENTS.length);
  });
});
