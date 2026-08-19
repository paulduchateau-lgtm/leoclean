import { describe, expect, it } from "vitest";

import {
  HORIZON_JOURS,
  MOTIFS_RESILIATION,
  PAUSE_MAXIMALE_SEMAINES,
  jourDuMois,
  prochainesOccurrences,
  propositionDeRetention,
  verifierPause,
} from "./recurrence";
import { utcToParisWallClock } from "@/lib/time";

/** Mardi 1ᵉʳ septembre 2026, 9 h heure française. */
const ANCRAGE = new Date("2026-09-01T07:00:00Z");
const MARDI = 2;
const NEUF_HEURES = 9 * 60;

function heuresParis(instant: Date): string {
  const mur = utcToParisWallClock(instant);
  return `${mur.year}-${String(mur.month).padStart(2, "0")}-${String(mur.day).padStart(2, "0")} ${String(mur.hour).padStart(2, "0")}:${String(mur.minute).padStart(2, "0")}`;
}

describe("prochainesOccurrences — hebdomadaire", () => {
  it("rend les mardis à 9 h, heure française", () => {
    const occurrences = prochainesOccurrences(
      {
        rythme: "WEEKLY",
        jourSemaine: MARDI,
        minuteDebut: NEUF_HEURES,
        ancrage: ANCRAGE,
      },
      ANCRAGE,
    );

    expect(occurrences.map(heuresParis)).toEqual([
      "2026-09-01 09:00",
      "2026-09-08 09:00",
      "2026-09-15 09:00",
      "2026-09-22 09:00",
    ]);
  });

  it("s'arrête à l'horizon", () => {
    const occurrences = prochainesOccurrences(
      {
        rythme: "WEEKLY",
        jourSemaine: MARDI,
        minuteDebut: NEUF_HEURES,
        ancrage: ANCRAGE,
      },
      ANCRAGE,
    );
    const dernier = occurrences[occurrences.length - 1]!;
    expect(dernier.getTime() - ANCRAGE.getTime()).toBeLessThanOrEqual(
      HORIZON_JOURS * 86_400_000,
    );
  });

  /*
   * Le cœur du module. Ajouter sept fois 24 heures à un mardi 9 h donne un
   * mardi 8 h ou 10 h de part et d'autre du changement d'heure : le
   * rendez-vous glisserait deux fois par an sans que personne ne l'ait décidé.
   */
  it("garde 9 h de part et d'autre du passage à l'heure d'hiver", () => {
    // Le changement a lieu le dimanche 25 octobre 2026.
    const octobre = new Date("2026-10-20T07:00:00Z");
    const occurrences = prochainesOccurrences(
      {
        rythme: "WEEKLY",
        jourSemaine: MARDI,
        minuteDebut: NEUF_HEURES,
        ancrage: octobre,
      },
      octobre,
      21,
    );

    for (const occurrence of occurrences) {
      expect(heuresParis(occurrence).endsWith("09:00")).toBe(true);
    }
    expect(occurrences.map(heuresParis)).toContain("2026-10-27 09:00");
    expect(occurrences.map(heuresParis)).toContain("2026-11-03 09:00");
  });
});

describe("prochainesOccurrences — tous les quinze jours", () => {
  it("saute une semaine sur deux", () => {
    const occurrences = prochainesOccurrences(
      {
        rythme: "BIWEEKLY",
        jourSemaine: MARDI,
        minuteDebut: NEUF_HEURES,
        ancrage: ANCRAGE,
      },
      ANCRAGE,
    );
    expect(occurrences.map(heuresParis)).toEqual([
      "2026-09-01 09:00",
      "2026-09-15 09:00",
    ]);
  });

  /*
   * C'est l'ancrage qui définit la parité d'une série bimensuelle. Recalculer
   * une position depuis « maintenant » ferait sauter une semaine sur deux dès
   * qu'on génère à un autre moment — et le client verrait son rendez-vous
   * changer de semaine sans raison.
   */
  it("garde la même parité quel que soit le moment de génération", () => {
    const regle = {
      rythme: "BIWEEKLY" as const,
      jourSemaine: MARDI,
      minuteDebut: NEUF_HEURES,
      ancrage: ANCRAGE,
    };

    const depuisLundi = prochainesOccurrences(
      regle,
      new Date("2026-09-07T06:00:00Z"),
    );
    const depuisJeudi = prochainesOccurrences(
      regle,
      new Date("2026-09-10T06:00:00Z"),
    );

    expect(depuisLundi.map(heuresParis)[0]).toBe("2026-09-15 09:00");
    expect(depuisJeudi.map(heuresParis)[0]).toBe("2026-09-15 09:00");
  });
});

describe("pause", () => {
  const regle = {
    rythme: "WEEKLY" as const,
    jourSemaine: MARDI,
    minuteDebut: NEUF_HEURES,
    ancrage: ANCRAGE,
  };

  /*
   * Mettre en pause ne décale pas la série, elle la troue. Sans cela, trois
   * semaines d'absence feraient basculer un client du mardi au vendredi sans
   * qu'il l'ait demandé.
   */
  it("troue la série sans la décaler", () => {
    const occurrences = prochainesOccurrences(regle, ANCRAGE, 21, {
      debut: new Date("2026-09-07T00:00:00Z"),
      fin: new Date("2026-09-21T00:00:00Z"),
    });

    expect(occurrences.map(heuresParis)).toEqual([
      "2026-09-01 09:00",
      "2026-09-22 09:00",
    ]);
  });
});

describe("verifierPause", () => {
  const maintenant = new Date("2026-09-01T07:00:00Z");

  it("accepte une pause de deux semaines", () => {
    expect(
      verifierPause(
        {
          debut: new Date("2026-09-07T00:00:00Z"),
          fin: new Date("2026-09-21T00:00:00Z"),
        },
        maintenant,
      ),
    ).toBeNull();
  });

  it("accepte exactement la durée maximale", () => {
    const debut = new Date("2026-09-07T00:00:00Z");
    const fin = new Date(
      debut.getTime() + PAUSE_MAXIMALE_SEMAINES * 7 * 86_400_000,
    );
    expect(verifierPause({ debut, fin }, maintenant)).toBeNull();
  });

  it("refuse au-delà de deux mois", () => {
    const debut = new Date("2026-09-07T00:00:00Z");
    const fin = new Date(
      debut.getTime() + (PAUSE_MAXIMALE_SEMAINES + 1) * 7 * 86_400_000,
    );
    expect(verifierPause({ debut, fin }, maintenant)).toBe("DUREE");
  });

  it("refuse une période révolue ou mal ordonnée", () => {
    expect(
      verifierPause(
        {
          debut: new Date("2026-07-01T00:00:00Z"),
          fin: new Date("2026-07-15T00:00:00Z"),
        },
        maintenant,
      ),
    ).toBe("PASSEE");
    expect(
      verifierPause(
        {
          debut: new Date("2026-10-01T00:00:00Z"),
          fin: new Date("2026-09-01T00:00:00Z"),
        },
        maintenant,
      ),
    ).toBe("ORDRE");
  });
});

describe("jourDuMois", () => {
  it("trouve le deuxième mardi de septembre 2026", () => {
    expect(jourDuMois(2026, 9, MARDI, 2)).toBe(8);
  });

  it("trouve le dernier mardi de septembre 2026", () => {
    expect(jourDuMois(2026, 9, MARDI, -1)).toBe(29);
  });

  it("rend null quand la cinquième semaine n'existe pas", () => {
    expect(jourDuMois(2026, 2, MARDI, 5)).toBeNull();
  });

  it("gère février d'une année bissextile", () => {
    // 2028 est bissextile ; le dernier mardi de février tombe le 29.
    expect(jourDuMois(2028, 2, MARDI, -1)).toBe(29);
  });
});

describe("rétention", () => {
  it("répond au motif, ou ne répond rien", () => {
    expect(propositionDeRetention("PRIX")).toBe("FREQUENCE_MOINDRE");
    expect(propositionDeRetention("QUALITE")).toBe("AUTRE_INTERVENANT");
    expect(propositionDeRetention("PLUS_BESOIN")).toBe("PAUSE");
  });

  /*
   * Proposer une remise à quelqu'un qui déménage est la meilleure façon de
   * transformer un départ neutre en mauvais souvenir.
   */
  it("ne propose rien à qui déménage", () => {
    expect(propositionDeRetention("DEMENAGEMENT")).toBeNull();
    expect(propositionDeRetention("AUTRE")).toBeNull();
  });

  it("couvre tous les motifs sans exception", () => {
    for (const motif of MOTIFS_RESILIATION) {
      expect(() => propositionDeRetention(motif)).not.toThrow();
    }
  });
});
