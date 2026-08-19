import { describe, expect, it } from "vitest";

import {
  type Absence,
  DUREE_MAXIMALE_JOURS,
  MAXIMUM_ABSENCES,
  absencesVivantes,
  joursCouverts,
  recouvre,
  seChevauchent,
  verifierAbsence,
} from "./absences";

/**
 * Les tests s'exécutent en UTC (`vitest.setup.ts`). Les dates ci-dessous sont
 * donc écrites en UTC, comme ce que la base stocke.
 */

const MAINTENANT = new Date("2026-08-19T10:00:00.000Z");

function absence(debut: string, fin: string): Absence {
  return { debut: new Date(debut), fin: new Date(fin) };
}

describe("verifierAbsence", () => {
  it("accepte une absence à venir", () => {
    expect(
      verifierAbsence(
        absence("2026-09-01T00:00:00.000Z", "2026-09-08T00:00:00.000Z"),
        [],
        MAINTENANT,
      ),
    ).toBeNull();
  });

  it("refuse une fin antérieure au début", () => {
    expect(
      verifierAbsence(
        absence("2026-09-08T00:00:00.000Z", "2026-09-01T00:00:00.000Z"),
        [],
        MAINTENANT,
      ),
    ).toBe("ordre");
  });

  it("refuse une période de durée nulle", () => {
    expect(
      verifierAbsence(
        absence("2026-09-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z"),
        [],
        MAINTENANT,
      ),
    ).toBe("ordre");
  });

  it("refuse une période entièrement révolue", () => {
    expect(
      verifierAbsence(
        absence("2026-08-01T00:00:00.000Z", "2026-08-10T00:00:00.000Z"),
        [],
        MAINTENANT,
      ),
    ).toBe("passee");
  });

  /*
   * Le cas qui compte : quelqu'un qui tombe malade en cours de semaine doit
   * pouvoir se retirer du reste, sans qu'on lui oppose que lundi est passé.
   */
  it("accepte une absence déjà commencée mais pas terminée", () => {
    expect(
      verifierAbsence(
        absence("2026-08-17T00:00:00.000Z", "2026-08-23T00:00:00.000Z"),
        [],
        MAINTENANT,
      ),
    ).toBeNull();
  });

  it("refuse au-delà d'un an", () => {
    const debut = new Date("2026-09-01T00:00:00.000Z");
    const fin = new Date(
      debut.getTime() + (DUREE_MAXIMALE_JOURS + 1) * 24 * 60 * 60 * 1000,
    );
    expect(verifierAbsence({ debut, fin }, [], MAINTENANT)).toBe("trop-longue");
  });

  it("accepte exactement la durée maximale", () => {
    const debut = new Date("2026-09-01T00:00:00.000Z");
    const fin = new Date(
      debut.getTime() + DUREE_MAXIMALE_JOURS * 24 * 60 * 60 * 1000,
    );
    expect(verifierAbsence({ debut, fin }, [], MAINTENANT)).toBeNull();
  });

  it("refuse un chevauchement avec une absence déjà posée", () => {
    const existante = absence(
      "2026-09-01T00:00:00.000Z",
      "2026-09-08T00:00:00.000Z",
    );
    expect(
      verifierAbsence(
        absence("2026-09-07T00:00:00.000Z", "2026-09-10T00:00:00.000Z"),
        [existante],
        MAINTENANT,
      ),
    ).toBe("chevauchement");
  });

  /*
   * Bornes `[debut, fin)` : deux absences jointives ne se chevauchent pas.
   * Sans cette convention, poser « le 1ᵉʳ au 7 » puis « le 7 au 14 » échouerait
   * pour un conflit d'une milliseconde.
   */
  it("accepte deux absences jointives", () => {
    const existante = absence(
      "2026-09-01T00:00:00.000Z",
      "2026-09-08T00:00:00.000Z",
    );
    expect(
      verifierAbsence(
        absence("2026-09-08T00:00:00.000Z", "2026-09-15T00:00:00.000Z"),
        [existante],
        MAINTENANT,
      ),
    ).toBeNull();
  });

  it("refuse au-delà du nombre maximal d'absences", () => {
    const existantes = Array.from({ length: MAXIMUM_ABSENCES }, (_, index) => {
      const debut = new Date(Date.UTC(2027, 0, 1 + index * 3, 0, 0, 0));
      return { debut, fin: new Date(debut.getTime() + 24 * 60 * 60 * 1000) };
    });
    expect(
      verifierAbsence(
        absence("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z"),
        existantes,
        MAINTENANT,
      ),
    ).toBe("trop-nombreuses");
  });

  /*
   * L'ordre des contrôles n'est pas indifférent : une période mal saisie doit
   * s'entendre dire qu'elle est mal saisie, pas qu'il y a trop d'absences.
   */
  it("signale l'erreur de saisie avant la limite de nombre", () => {
    const existantes = Array.from({ length: MAXIMUM_ABSENCES }, (_, index) => {
      const debut = new Date(Date.UTC(2027, 0, 1 + index * 3, 0, 0, 0));
      return { debut, fin: new Date(debut.getTime() + 24 * 60 * 60 * 1000) };
    });
    expect(
      verifierAbsence(
        absence("2026-09-08T00:00:00.000Z", "2026-09-01T00:00:00.000Z"),
        existantes,
        MAINTENANT,
      ),
    ).toBe("ordre");
  });
});

describe("seChevauchent", () => {
  it("est symétrique", () => {
    const a = absence("2026-09-01T00:00:00.000Z", "2026-09-08T00:00:00.000Z");
    const b = absence("2026-09-05T00:00:00.000Z", "2026-09-12T00:00:00.000Z");
    expect(seChevauchent(a, b)).toBe(seChevauchent(b, a));
    expect(seChevauchent(a, b)).toBe(true);
  });

  it("détecte l'inclusion complète", () => {
    const large = absence(
      "2026-09-01T00:00:00.000Z",
      "2026-09-30T00:00:00.000Z",
    );
    const etroite = absence(
      "2026-09-10T00:00:00.000Z",
      "2026-09-11T00:00:00.000Z",
    );
    expect(seChevauchent(large, etroite)).toBe(true);
    expect(seChevauchent(etroite, large)).toBe(true);
  });
});

describe("absencesVivantes", () => {
  it("écarte les absences révolues et trie par date de début", () => {
    const vivantes = absencesVivantes(
      [
        absence("2026-09-10T00:00:00.000Z", "2026-09-12T00:00:00.000Z"),
        absence("2026-07-01T00:00:00.000Z", "2026-07-08T00:00:00.000Z"),
        absence("2026-08-25T00:00:00.000Z", "2026-08-30T00:00:00.000Z"),
      ],
      MAINTENANT,
    );

    expect(vivantes).toHaveLength(2);
    expect(vivantes[0]!.debut.toISOString()).toBe("2026-08-25T00:00:00.000Z");
    expect(vivantes[1]!.debut.toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });

  it("garde une absence en cours", () => {
    const vivantes = absencesVivantes(
      [absence("2026-08-17T00:00:00.000Z", "2026-08-23T00:00:00.000Z")],
      MAINTENANT,
    );
    expect(vivantes).toHaveLength(1);
  });
});

describe("recouvre", () => {
  it("reconnaît une mission prise dans l'absence", () => {
    expect(
      recouvre(
        absence("2026-09-01T00:00:00.000Z", "2026-09-08T00:00:00.000Z"),
        {
          debut: new Date("2026-09-03T07:00:00.000Z"),
          fin: new Date("2026-09-03T09:30:00.000Z"),
        },
      ),
    ).toBe(true);
  });

  it("laisse passer une mission qui commence quand l'absence finit", () => {
    expect(
      recouvre(
        absence("2026-09-01T00:00:00.000Z", "2026-09-08T00:00:00.000Z"),
        {
          debut: new Date("2026-09-08T00:00:00.000Z"),
          fin: new Date("2026-09-08T02:30:00.000Z"),
        },
      ),
    ).toBe(false);
  });
});

describe("joursCouverts", () => {
  it("compte une journée entière", () => {
    expect(
      joursCouverts(
        absence("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z"),
      ),
    ).toBe(1);
  });

  it("compte une semaine", () => {
    expect(
      joursCouverts(
        absence("2026-09-01T00:00:00.000Z", "2026-09-08T00:00:00.000Z"),
      ),
    ).toBe(7);
  });

  /*
   * Un passage à l'heure d'hiver allonge la journée d'une heure. Compter sur la
   * durée plutôt que sur le calendrier ferait afficher « 7,04 jours » si l'on
   * n'arrondissait pas — d'où l'arrondi, vérifié ici sur le week-end du
   * changement d'heure d'octobre 2026.
   */
  it("reste juste au passage à l'heure d'hiver", () => {
    expect(
      joursCouverts(
        absence("2026-10-24T22:00:00.000Z", "2026-10-31T23:00:00.000Z"),
      ),
    ).toBe(7);
  });

  it("ne descend jamais sous un jour", () => {
    expect(
      joursCouverts(
        absence("2026-09-01T08:00:00.000Z", "2026-09-01T12:00:00.000Z"),
      ),
    ).toBe(1);
  });
});
