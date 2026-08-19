import { describe, expect, it } from "vitest";

import {
  type FaitsExploitation,
  ORPHELINE_CRITIQUE_HEURES,
  SLA_HEURES,
  compter,
  composerLaFile,
  enRetard,
} from "./file-actions";

const MAINTENANT = new Date("2026-09-10T09:00:00Z");

function faits(overrides: Partial<FaitsExploitation> = {}): FaitsExploitation {
  return {
    missionsOrphelines: [],
    pointagesManquants: [],
    propositionsPerimees: [],
    rappelsNonTraites: [],
    dossiersAExaminer: [],
    piecesExpirant: [],
    paiementsEchoues: [],
    notesBasses: [],
    ajustementsAArbitrer: [],
    candidaturesSansNouvelle: [],
    ...overrides,
  };
}

describe("composerLaFile", () => {
  it("ne rend rien quand rien n'attend", () => {
    expect(composerLaFile(faits(), MAINTENANT)).toEqual([]);
  });

  it("classe une mission orpheline selon son urgence", () => {
    const proche = composerLaFile(
      faits({
        missionsOrphelines: [
          {
            id: "a",
            debut: new Date("2026-09-11T09:00:00Z"),
            commune: "Léognan",
          },
        ],
      }),
      MAINTENANT,
    );
    expect(proche[0]!.priorite).toBe("P0");

    const lointaine = composerLaFile(
      faits({
        missionsOrphelines: [
          {
            id: "b",
            debut: new Date("2026-09-20T09:00:00Z"),
            commune: "Cestas",
          },
        ],
      }),
      MAINTENANT,
    );
    expect(lointaine[0]!.priorite).toBe("P2");
  });

  it("passe en critique au seuil exact", () => {
    const file = composerLaFile(
      faits({
        missionsOrphelines: [
          {
            id: "a",
            debut: new Date(
              MAINTENANT.getTime() + ORPHELINE_CRITIQUE_HEURES * 3_600_000,
            ),
            commune: "Léognan",
          },
        ],
      }),
      MAINTENANT,
    );
    expect(file[0]!.priorite).toBe("P0");
  });

  /*
   * La règle qui rend le module utilisable au lieu d'impressionnant : un motif
   * en langage clair. « 3 annulations en 60 jours » se traite ; « score 72 » ne
   * se traite pas.
   */
  it("donne toujours un motif lisible, jamais un score nu", () => {
    const file = composerLaFile(
      faits({
        missionsOrphelines: [
          {
            id: "a",
            debut: new Date("2026-09-11T09:00:00Z"),
            commune: "Léognan",
          },
        ],
        pointagesManquants: [
          {
            id: "b",
            debut: new Date("2026-09-10T08:30:00Z"),
            intervenant: "Sonia",
          },
        ],
        notesBasses: [
          { id: "c", recuLe: new Date("2026-09-09T20:00:00Z"), etoiles: 2 },
        ],
      }),
      MAINTENANT,
    );

    for (const element of file) {
      expect(element.motif.length).toBeGreaterThan(20);
      expect(element.motif).not.toMatch(/^\d+$/);
      expect(element.motif).toMatch(/[.!]$/);
    }
  });

  it("traite un pointage manquant comme critique", () => {
    const file = composerLaFile(
      faits({
        pointagesManquants: [
          {
            id: "b",
            debut: new Date("2026-09-10T08:30:00Z"),
            intervenant: "Sonia",
          },
        ],
      }),
      MAINTENANT,
    );
    expect(file[0]!.priorite).toBe("P0");
    expect(file[0]!.motif).toContain("30 minutes");
  });

  it("aggrave un paiement au troisième échec", () => {
    const deuxieme = composerLaFile(
      faits({
        paiementsEchoues: [
          { id: "p", depuis: new Date("2026-09-09T09:00:00Z"), tentatives: 2 },
        ],
      }),
      MAINTENANT,
    );
    expect(deuxieme[0]!.priorite).toBe("P1");

    const troisieme = composerLaFile(
      faits({
        paiementsEchoues: [
          { id: "p", depuis: new Date("2026-09-09T09:00:00Z"), tentatives: 3 },
        ],
      }),
      MAINTENANT,
    );
    expect(troisieme[0]!.priorite).toBe("P0");
    expect(troisieme[0]!.motif).toContain("préavis");
  });

  /*
   * Le tri est par échéance et non par priorité : un P1 dont le délai expire
   * dans dix minutes passe avant un P0 posé à l'instant. Trier par priorité
   * ferait dépasser des délais qu'on avait le temps de tenir.
   */
  it("trie par échéance, pas par priorité", () => {
    const file = composerLaFile(
      faits({
        // P0 posé maintenant : échéance dans 1 h.
        missionsOrphelines: [
          {
            id: "p0",
            debut: new Date("2026-09-11T09:00:00Z"),
            commune: "Léognan",
          },
        ],
        // P1 posé il y a 4 h : échéance dépassée.
        rappelsNonTraites: [
          {
            id: "p1",
            recuLe: new Date("2026-09-09T00:00:00Z"),
            nom: "Camille",
          },
        ],
      }),
      MAINTENANT,
    );

    expect(file[0]!.entiteId).toBe("p1");
    expect(file[0]!.priorite).toBe("P1");
    expect(file[1]!.priorite).toBe("P0");
  });

  it("distingue une pièce expirée d'une pièce qui expire bientôt", () => {
    const file = composerLaFile(
      faits({
        piecesExpirant: [
          {
            id: "x",
            expireLe: new Date("2026-09-01T09:00:00Z"),
            intervenant: "Marc",
            piece: "RC Pro",
          },
          {
            id: "y",
            expireLe: new Date("2026-09-20T09:00:00Z"),
            intervenant: "Sonia",
            piece: "Vigilance URSSAF",
          },
        ],
      }),
      MAINTENANT,
    );

    const expiree = file.find((e) => e.entiteId === "x")!;
    const bientot = file.find((e) => e.entiteId === "y")!;
    expect(expiree.priorite).toBe("P1");
    expect(expiree.motif).toContain("pause");
    expect(bientot.priorite).toBe("P2");
  });

  it("rappelle qu'un ajustement ne facture rien avant arbitrage", () => {
    const file = composerLaFile(
      faits({
        ajustementsAArbitrer: [
          { id: "a", depuis: new Date("2026-09-09T09:00:00Z"), minutes: 30 },
        ],
      }),
      MAINTENANT,
    );
    expect(file[0]!.motif).toContain("Rien n'est facturé");
  });
});

describe("délais", () => {
  it("promet une heure sur le critique et quatre sur l'important", () => {
    expect(SLA_HEURES.P0).toBe(1);
    expect(SLA_HEURES.P1).toBe(4);
  });

  it("les ordonne du plus court au plus long", () => {
    expect(SLA_HEURES.P0).toBeLessThan(SLA_HEURES.P1);
    expect(SLA_HEURES.P1).toBeLessThan(SLA_HEURES.P2);
    expect(SLA_HEURES.P2).toBeLessThan(SLA_HEURES.P3);
  });
});

describe("enRetard", () => {
  /*
   * Le dépassement est la métrique de qualité d'exploitation : un SLA qu'on ne
   * compte pas n'existe pas.
   */
  it("ne retient que ce dont le délai est passé", () => {
    const file = composerLaFile(
      faits({
        rappelsNonTraites: [
          { id: "vieux", recuLe: new Date("2026-09-08T00:00:00Z"), nom: "A" },
          { id: "frais", recuLe: new Date("2026-09-10T08:55:00Z"), nom: "B" },
        ],
      }),
      MAINTENANT,
    );

    const retards = enRetard(file, MAINTENANT);
    expect(retards.map((e) => e.entiteId)).toEqual(["vieux"]);
  });
});

describe("compter", () => {
  it("répartit par priorité", () => {
    const file = composerLaFile(
      faits({
        missionsOrphelines: [
          {
            id: "a",
            debut: new Date("2026-09-11T09:00:00Z"),
            commune: "Léognan",
          },
        ],
        candidaturesSansNouvelle: [
          { id: "c", depuis: new Date("2026-08-20T09:00:00Z"), nom: "Fatou" },
        ],
      }),
      MAINTENANT,
    );

    expect(compter(file)).toEqual({ P0: 1, P1: 0, P2: 1, P3: 0 });
  });
});
