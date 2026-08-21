import { describe, expect, it } from "vitest";

import {
  type EtatCandidature,
  MOTIFS_REFUS_PIECE,
  PIECES,
  SIGNAUX_ATTENTION,
  SLA_HEURES,
  STATUTS,
  STATUTS_TERMINAUX,
  bloquant,
  ceQuiManque,
  peutEtreActivee,
  prochaineRelance,
  progression,
} from "./parcours";

function etat(overrides: Partial<EtatCandidature> = {}): EtatCandidature {
  return {
    statut: "COMMENCE",
    brancheStatut: null,
    brancheSap: null,
    profilComplet: false,
    photoDeposee: false,
    siretVerifie: false,
    sapVerifie: false,
    piecesValidees: [],
    entretienPasse: false,
    chartesSignees: false,
    ...overrides,
  };
}

const COMPLET = etat({
  profilComplet: true,
  photoDeposee: true,
  siretVerifie: true,
  entretienPasse: true,
  chartesSignees: true,
  piecesValidees: PIECES.filter((p) => p !== "AVIS_SIRENE"),
});

describe("statuts", () => {
  it("en décrit quatorze, sans doublon", () => {
    expect(new Set(STATUTS).size).toBe(STATUTS.length);
  });

  it("ne compte comme terminaux que l'activation, le refus et l'abandon", () => {
    expect([...STATUTS_TERMINAUX].sort()).toEqual(
      ["ABANDONNE", "ACTIF", "REFUSE"].sort(),
    );
  });

  /*
   * L'attente est un état du parcours, pas une sortie : c'est tout le principe
   * du funnel. Un candidat sans SIRET est un candidat à quatre semaines, et le
   * dossier avance pendant ce temps sur ce qui n'en dépend pas.
   */
  it("ne fait pas de l'attente une sortie", () => {
    expect(STATUTS_TERMINAUX).not.toContain("ATTENTE_SIRET");
    expect(STATUTS_TERMINAUX).not.toContain("ATTENTE_SAP");
  });
});

describe("ceQuiManque", () => {
  it("nomme tout au départ", () => {
    const manques = ceQuiManque(etat());
    expect(manques).toContain("Votre profil");
    expect(manques).toContain("Votre numéro SIRET");
    expect(manques).toContain(
      "Assurance responsabilité civile professionnelle",
    );
  });

  /*
   * L'API Sirene rend l'information : demander à quelqu'un d'aller la
   * télécharger pour nous la renvoyer est un abandon gratuit dans le funnel.
   */
  it("cesse de demander l'avis SIRENE une fois le SIRET vérifié", () => {
    expect(ceQuiManque(etat({ siretVerifie: true }))).not.toContain(
      "Avis de situation SIRENE",
    );
    expect(ceQuiManque(etat())).toContain("Avis de situation SIRENE");
  });

  it("ne demande plus rien quand le dossier est complet, sauf le SAP", () => {
    expect(ceQuiManque(COMPLET)).toEqual([
      "Votre déclaration SAP (sans blocage)",
    ]);
  });
});

describe("peutEtreActivee", () => {
  it("accepte un dossier complet", () => {
    expect(peutEtreActivee(COMPLET)).toBe(true);
  });

  /*
   * La déclaration SAP met des semaines à être instruite. L'attendre pour
   * activer reviendrait à ne recruter personne au lancement — c'est la raison
   * pour laquelle `CleanerProfile.sapDeclarationNumber` est nullable.
   */
  it("n'attend pas la déclaration SAP", () => {
    expect(peutEtreActivee({ ...COMPLET, sapVerifie: false })).toBe(true);
  });

  it("refuse tant qu'une pièce manque", () => {
    for (const piece of PIECES) {
      if (piece === "AVIS_SIRENE") continue;
      const amputé = {
        ...COMPLET,
        piecesValidees: COMPLET.piecesValidees.filter((p) => p !== piece),
      };
      expect(peutEtreActivee(amputé), piece).toBe(false);
    }
  });

  it("refuse sans entretien, sans photo, sans signature", () => {
    expect(peutEtreActivee({ ...COMPLET, entretienPasse: false })).toBe(false);
    expect(peutEtreActivee({ ...COMPLET, photoDeposee: false })).toBe(false);
    expect(peutEtreActivee({ ...COMPLET, chartesSignees: false })).toBe(false);
  });
});

describe("progression", () => {
  it("part de zéro et arrive à cent", () => {
    expect(progression(etat())).toBe(0);
    expect(progression(COMPLET)).toBe(100);
  });

  /*
   * Une barre qui recule au moment où quelqu'un découvre qu'il doit créer une
   * auto-entreprise lui dit « votre dossier a régressé » précisément quand il a
   * besoin d'être rassuré.
   */
  it("ne recule jamais quand une branche longue s'ouvre", () => {
    const avant = progression(
      etat({ profilComplet: true, photoDeposee: true }),
    );
    const pendant = progression(
      etat({
        profilComplet: true,
        photoDeposee: true,
        statut: "ATTENTE_SIRET",
        brancheStatut: "CREATION_AE",
      }),
    );
    expect(pendant).toBeGreaterThanOrEqual(avant);
  });

  it("croît à mesure que les jalons tombent", () => {
    const etapes = [
      etat(),
      etat({ profilComplet: true }),
      etat({ profilComplet: true, photoDeposee: true }),
      etat({ profilComplet: true, photoDeposee: true, siretVerifie: true }),
      COMPLET,
    ];
    const valeurs = etapes.map(progression);
    for (let i = 1; i < valeurs.length; i += 1) {
      expect(valeurs[i]!).toBeGreaterThanOrEqual(valeurs[i - 1]!);
    }
  });
});

describe("relances", () => {
  const depuis = new Date("2026-09-01T09:00:00Z");

  it("relance un dossier commencé à J+1, J+3, J+7", () => {
    expect(prochaineRelance("COMMENCE", depuis, 0)?.toISOString()).toBe(
      "2026-09-02T09:00:00.000Z",
    );
    expect(prochaineRelance("COMMENCE", depuis, 2)?.toISOString()).toBe(
      "2026-09-08T09:00:00.000Z",
    );
    expect(prochaineRelance("COMMENCE", depuis, 3)).toBeNull();
  });

  /*
   * L'attente du SIRET dure une à trois semaines : relancer à J+1 y serait du
   * harcèlement, et ne pas relancer du tout laisserait le dossier mourir.
   */
  it("espace les relances pendant l'attente du SIRET", () => {
    expect(prochaineRelance("ATTENTE_SIRET", depuis, 0)?.toISOString()).toBe(
      "2026-09-08T09:00:00.000Z",
    );
  });

  it("ne relance pas un dossier actif ou refusé", () => {
    expect(prochaineRelance("ACTIF", depuis, 0)).toBeNull();
    expect(prochaineRelance("REFUSE", depuis, 0)).toBeNull();
    expect(prochaineRelance("ABANDONNE", depuis, 0)).toBeNull();
  });

  it("répond immédiatement à une pièce refusée", () => {
    expect(prochaineRelance("PIECES_REFUSEES", depuis, 0)?.toISOString()).toBe(
      depuis.toISOString(),
    );
  });
});

describe("délais promis", () => {
  it("promet vingt-quatre heures sur les pièces déposées", () => {
    expect(SLA_HEURES.PIECES_DEPOSEES).toBe(24);
  });

  it("ne promet rien qu'on ne puisse tenir en deux jours", () => {
    for (const heures of Object.values(SLA_HEURES)) {
      expect(heures).toBeLessThanOrEqual(48);
    }
  });
});

describe("motifs de refus", () => {
  /*
   * Un motif vague fait redéposer la même pièce. Chacun doit dire quoi refaire.
   */
  it("dit quoi refaire, jamais seulement ce qui ne va pas", () => {
    for (const [code, message] of Object.entries(MOTIFS_REFUS_PIECE)) {
      if (code === "AUTRE") continue;
      expect(message.length, code).toBeGreaterThan(30);
      expect(message, code).toMatch(/[.!]$/);
    }
  });

  it("en propose au moins dix", () => {
    expect(Object.keys(MOTIFS_REFUS_PIECE).length).toBeGreaterThanOrEqual(10);
  });
});

describe("signaux d'attention", () => {
  /*
   * Ils sont hors de tout score, et deux seulement suspendent l'examen : un
   * compte au nom d'un tiers et un IBAN déjà vu. Ce sont les deux vecteurs par
   * lesquels quelqu'un se fait payer le travail d'un autre.
   */
  it("ne bloque que sur les deux vecteurs de fraude au paiement", () => {
    const bloquants = SIGNAUX_ATTENTION.filter(bloquant);
    expect([...bloquants].sort()).toEqual(
      ["DOUBLON_IBAN", "IBAN_AUTRE_NOM"].sort(),
    );
  });

  it("laisse le reste s'expliquer en entretien", () => {
    expect(bloquant("SIRET_RECENT")).toBe(false);
    expect(bloquant("APE_INATTENDU")).toBe(false);
    expect(bloquant("NOM_INCOHERENT")).toBe(false);
  });
});
