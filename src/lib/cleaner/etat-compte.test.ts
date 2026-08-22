import { describe, expect, it } from "vitest";

import {
  type EntreeEtatCompte,
  etatDesPieces,
  etatDuCompte,
  peutSoumettreLeDossier,
} from "@/lib/cleaner/etat-compte";

/**
 * Ce que le bandeau de statut a le droit de dire.
 *
 * Le défaut qu'on garde ici est celui d'un badge rouge qui ne mène nulle part :
 * il punit sans informer. Chaque état inactif doit donc porter, ou bien un
 * écran où agir, ou bien une phrase qui dit le geste — jamais rien.
 */

const COMPLET = { ready: true, missing: [], warnings: [] };
const INCOMPLET = {
  ready: false,
  missing: ["votre SIRET", "un RIB"],
  warnings: [],
};

const BASE: EntreeEtatCompte = {
  status: "PENDING_VERIFICATION",
  suspensionOrigine: null,
  dossierSoumisLe: null,
  activation: COMPLET,
};

describe("état du compte", () => {
  it("n'affiche « actif » que pour un compte validé", () => {
    expect(etatDuCompte({ ...BASE, status: "ACTIVE" }).actif).toBe(true);

    for (const status of [
      "PENDING_VERIFICATION",
      "SUSPENDED",
      "INACTIVE",
    ] as const) {
      expect(
        etatDuCompte({
          ...BASE,
          status,
          suspensionOrigine: status === "SUSPENDED" ? "PLATFORM" : null,
        }).actif,
        status,
      ).toBe(false);
    }
  });

  it("dit toujours quoi faire, ou pourquoi on ne peut rien faire", () => {
    // La règle centrale : un état inactif sans issue est une punition.
    const cas: EntreeEtatCompte[] = [
      { ...BASE, activation: INCOMPLET },
      { ...BASE },
      { ...BASE, dossierSoumisLe: new Date() },
      { ...BASE, status: "SUSPENDED", suspensionOrigine: "CLEANER" },
      { ...BASE, status: "SUSPENDED", suspensionOrigine: "PLATFORM" },
      { ...BASE, status: "INACTIVE" },
    ];

    for (const entree of cas) {
      const etat = etatDuCompte(entree);
      if (etat.actif) continue;
      const aUneIssue =
        etat.action !== null || /appelez-nous/i.test(etat.explication);
      expect(aUneIssue, etat.motif ?? "?").toBe(true);
    }
  });

  it("mène au dossier quand c'est le dossier qui bloque", () => {
    const etat = etatDuCompte({ ...BASE, activation: INCOMPLET });

    expect(etat.motif).toBe("DOSSIER_INCOMPLET");
    expect(etat.action?.href).toBe("/intervenant/dossier");
    // Le décompte est dit : « il manque des pièces » n'apprend rien.
    expect(etat.explication).toContain("2 pièces");
  });

  it("distingue le dossier complet non soumis de l'examen en cours", () => {
    expect(etatDuCompte(BASE).motif).toBe("DOSSIER_A_SOUMETTRE");
    expect(etatDuCompte({ ...BASE, dossierSoumisLe: new Date() }).motif).toBe(
      "EN_COURS_EXAMEN",
    );
  });

  it("ne propose de reprendre que ce que l'intervenant a lui-même arrêté", () => {
    // Une suspension décidée par la plateforme ne se lève pas d'un bouton :
    // en proposer un ferait promettre au produit ce qu'il ne tiendra pas.
    const pause = etatDuCompte({
      ...BASE,
      status: "SUSPENDED",
      suspensionOrigine: "CLEANER",
    });
    const suspendu = etatDuCompte({
      ...BASE,
      status: "SUSPENDED",
      suspensionOrigine: "PLATFORM",
    });

    expect(pause.reversibleParLIntervenant).toBe(true);
    expect(pause.action).not.toBeNull();
    expect(suspendu.reversibleParLIntervenant).toBe(false);
    expect(suspendu.action).toBeNull();
  });

  it("ne réclame aucune pièce à un compte suspendu", () => {
    // Ce n'est pas ce qui le bloque : le lui dire l'enverrait réparer ce qui
    // n'est pas cassé.
    const etat = etatDuCompte({
      ...BASE,
      status: "SUSPENDED",
      suspensionOrigine: "PLATFORM",
      activation: INCOMPLET,
    });

    expect(etat.motif).toBe("SUSPENDU");
    expect(etat.explication).not.toMatch(/pièce|SIRET|RIB/i);
  });
});

describe("état des pièces", () => {
  const MAINTENANT = new Date("2026-08-22T10:00:00Z");
  const DEMAIN = new Date("2026-08-23T10:00:00Z");
  const HIER = new Date("2026-08-21T10:00:00Z");

  it("rend les quatre pièces, y compris celles qu'on n'a pas", () => {
    // Une liste qui ne montre que ce qui manque dit ce qui va mal, pas ce qui
    // reste à faire. Les quatre transforment un reproche en progression.
    const vues = etatDesPieces([], MAINTENANT);

    expect(vues).toHaveLength(4);
    expect(vues.every((piece) => piece.etat === "MANQUANTE")).toBe(true);
    expect(vues.every((piece) => !piece.conforme)).toBe(true);
  });

  it("traite une pièce expirée comme absente, et le dit", () => {
    // Sinon une attestation périmée garderait sa coche verte — le cas où le
    // client croit l'intervenant assuré alors qu'il ne l'est plus.
    const [piece] = etatDesPieces(
      [
        {
          type: "INSURANCE_RC_PRO",
          status: "APPROVED",
          expiresAt: HIER,
          rejectionReason: null,
        },
      ],
      MAINTENANT,
    ).filter((p) => p.type === "INSURANCE_RC_PRO");

    expect(piece!.etat).toBe("EXPIREE");
    expect(piece!.conforme).toBe(false);
  });

  it("compte une pièce reçue comme conforme tant qu'on ne lui demande rien", () => {
    // Une croix rouge sur un document qu'il vient d'envoyer le ferait le
    // renvoyer une seconde fois.
    const piece = etatDesPieces(
      [
        {
          type: "SIRET",
          status: "PENDING",
          expiresAt: null,
          rejectionReason: null,
        },
      ],
      MAINTENANT,
    ).find((p) => p.type === "SIRET")!;

    expect(piece.etat).toBe("EN_ATTENTE_DE_VALIDATION");
    expect(piece.conforme).toBe(true);
  });

  it("reprend le motif du refus, jamais une formule vague", () => {
    const piece = etatDesPieces(
      [
        {
          type: "IDENTITY",
          status: "REJECTED",
          expiresAt: null,
          rejectionReason: "La photo est floue, le numéro est illisible.",
        },
      ],
      MAINTENANT,
    ).find((p) => p.type === "IDENTITY")!;

    expect(piece.detail).toContain("floue");
  });

  it("n'autorise la soumission que si les quatre sont conformes", () => {
    const toutes = etatDesPieces(
      ["SIRET", "INSURANCE_RC_PRO", "IDENTITY", "BANK_DETAILS"].map((type) => ({
        type: type as never,
        status: "PENDING" as const,
        expiresAt: type === "INSURANCE_RC_PRO" ? DEMAIN : null,
        rejectionReason: null,
      })),
      MAINTENANT,
    );

    expect(peutSoumettreLeDossier(toutes)).toBe(true);
    expect(peutSoumettreLeDossier(etatDesPieces([], MAINTENANT))).toBe(false);
  });
});
