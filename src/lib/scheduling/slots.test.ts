import { describe, expect, it } from "vitest";

import { computeAvailability } from "@/lib/scheduling/availability";
import type { Interval } from "@/lib/scheduling/intervals";
import {
  type CleanerSchedule,
  type RoundStop,
  evaluateSlot,
  findSlots,
  insertionCostMinutes,
} from "@/lib/scheduling/slots";
import { travelMatrixFrom } from "@/lib/scheduling/travel";
import { getCommuneBySlug } from "@/lib/territory";
import { formatParis, parisWallClockToUtc } from "@/lib/time";

const paris = (day: number, hour: number, minute = 0) =>
  parisWallClockToUtc({ year: 2026, month: 1, day, hour, minute });

const point = (slug: string) => {
  const commune = getCommuneBySlug(slug);
  if (!commune) throw new Error(`Commune inconnue : ${slug}`);
  return { lat: commune.lat, lng: commune.lng };
};

const ALWAYS = new Date(Date.UTC(2000, 0, 1));

/** Mardi 13 janvier 2026, 9 h – 17 h. */
const TUESDAY_9_TO_17 = computeAvailability({
  window: { start: paris(13, 0).getTime(), end: paris(14, 0).getTime() },
  rules: [
    {
      weekday: 2,
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      validFrom: ALWAYS,
      validUntil: null,
    },
  ],
});

function schedule(overrides: Partial<CleanerSchedule> = {}): CleanerSchedule {
  return {
    cleanerProfileId: "cleaner-leognan",
    homePoint: point("leognan"),
    maxTravelMinutes: 30,
    availability: TUESDAY_9_TO_17,
    stops: [],
    ratingAverage: 4.5,
    ratingCount: 20,
    acceptanceRate: 0.9,
    assignedMinutesInPeriod: 600,
    isPreferred: false,
    ...overrides,
  };
}

const DAY: Interval = {
  start: paris(13, 0).getTime(),
  end: paris(14, 0).getTime(),
};

/** Instant de référence très en amont : le délai de prévenance ne gêne pas. */
const NOW = paris(1, 8);

function stop(hour: number, endHour: number, slug: string): RoundStop {
  return {
    start: paris(13, hour),
    end: paris(13, endHour),
    point: point(slug),
  };
}

describe("coût d'insertion", () => {
  it("compte l'aller-retour pour la seule mission de la journée", () => {
    const travel = travelMatrixFrom([
      {
        origin: point("leognan"),
        destination: point("cestas"),
        durationMinutes: 11,
      },
      {
        origin: point("cestas"),
        destination: point("leognan"),
        durationMinutes: 11,
      },
    ]);

    expect(
      insertionCostMinutes(
        schedule(),
        point("cestas"),
        undefined,
        undefined,
        travel,
      ),
    ).toBe(22);
  });

  it("ne compte que le détour pour une mission intercalée", () => {
    // L'intervenante allait de toute façon de Martillac à La Brède ; s'arrêter
    // en route ne coûte que la différence.
    const travel = travelMatrixFrom([
      {
        origin: point("martillac"),
        destination: point("la-brede"),
        durationMinutes: 13,
      },
      {
        origin: point("martillac"),
        destination: point("saucats"),
        durationMinutes: 10,
      },
      {
        origin: point("saucats"),
        destination: point("la-brede"),
        durationMinutes: 9,
      },
    ]);

    expect(
      insertionCostMinutes(
        schedule(),
        point("saucats"),
        stop(9, 11, "martillac"),
        stop(15, 17, "la-brede"),
        travel,
      ),
    ).toBe(6);
  });

  it("n'est jamais négatif", () => {
    // Un détour ne peut pas raccourcir la tournée. Si le calcul le prétend,
    // c'est que les données de trajet se contredisent — un score négatif se
    // propagerait alors dans le classement.
    const travel = travelMatrixFrom([
      {
        origin: point("martillac"),
        destination: point("la-brede"),
        durationMinutes: 40,
      },
      {
        origin: point("martillac"),
        destination: point("saucats"),
        durationMinutes: 5,
      },
      {
        origin: point("saucats"),
        destination: point("la-brede"),
        durationMinutes: 5,
      },
    ]);

    expect(
      insertionCostMinutes(
        schedule(),
        point("saucats"),
        stop(9, 11, "martillac"),
        stop(15, 17, "la-brede"),
        travel,
      ),
    ).toBe(0);
  });
});

describe("faisabilité d'un créneau", () => {
  it("accepte une mission qui tient, trajets compris", () => {
    const candidate = evaluateSlot(
      schedule(),
      { window: DAY, durationMinutes: 120, destination: point("leognan") },
      paris(13, 10).getTime(),
    );

    expect(candidate).not.toBeNull();
    expect(candidate!.cleanerProfileId).toBe("cleaner-leognan");
  });

  it("refuse un créneau que la route ne permet pas d'atteindre", () => {
    // La mission précédente se termine à 12 h à Cabanac ; il faut une demi-
    // heure pour rejoindre Villenave-d'Ornon. Un créneau à 12 h y est donc
    // impossible, même si la disponibilité déclarée dit le contraire.
    const cleaner = schedule({
      stops: [stop(10, 12, "cabanac-et-villagrains")],
      availability: computeAvailability({
        window: DAY,
        rules: [
          {
            weekday: 2,
            startMinute: 9 * 60,
            endMinute: 17 * 60,
            validFrom: ALWAYS,
            validUntil: null,
          },
        ],
        assignments: [
          {
            start: paris(13, 10),
            end: paris(13, 12),
            travelMinutesBefore: 0,
            travelMinutesAfter: 0,
          },
        ],
      }),
    });

    expect(
      evaluateSlot(
        cleaner,
        {
          window: DAY,
          durationMinutes: 120,
          destination: point("villenave-d-ornon"),
        },
        paris(13, 12).getTime(),
      ),
    ).toBeNull();

    // Une heure plus tard, la route passe.
    expect(
      evaluateSlot(
        cleaner,
        {
          window: DAY,
          durationMinutes: 120,
          destination: point("villenave-d-ornon"),
        },
        paris(13, 13).getTime(),
      ),
    ).not.toBeNull();
  });

  it("refuse un trajet inter-missions au-delà de ce que l'intervenant accepte", () => {
    const cleaner = schedule({
      maxTravelMinutes: 10,
      stops: [stop(9, 11, "cabanac-et-villagrains")],
    });

    expect(
      evaluateSlot(
        cleaner,
        {
          window: DAY,
          durationMinutes: 120,
          destination: point("villenave-d-ornon"),
        },
        paris(13, 14).getTime(),
      ),
    ).toBeNull();
  });

  it("n'applique pas ce plafond au trajet depuis le domicile", () => {
    // Refuser une mission proche de chez soi parce qu'on habite loin des
    // autres n'aurait pas de sens : le domicile relève du choix de
    // l'intervenant, pas de la tournée.
    const cleaner = schedule({
      maxTravelMinutes: 5,
      homePoint: point("cabanac-et-villagrains"),
      stops: [],
    });

    expect(
      evaluateSlot(
        cleaner,
        {
          window: DAY,
          durationMinutes: 120,
          destination: point("cabanac-et-villagrains"),
        },
        paris(13, 10).getTime(),
      ),
    ).not.toBeNull();
  });

  it("refuse un créneau dont le tampon de trajet déborde des heures déclarées", () => {
    // La mission de 15 h à 17 h tient, mais pas le retour : l'intervenante
    // n'est plus disponible après 17 h. Sans ce contrôle, on lui vendrait une
    // journée qui déborde.
    const cleaner = schedule({ homePoint: point("cabanac-et-villagrains") });

    expect(
      evaluateSlot(
        cleaner,
        {
          window: DAY,
          durationMinutes: 120,
          destination: point("villenave-d-ornon"),
        },
        paris(13, 15).getTime(),
      ),
    ).toBeNull();
  });

  it("ignore les missions des autres journées", () => {
    // Régression. Une mission située un autre jour n'appartient pas à la
    // tournée : la traiter comme « étape suivante » fait calculer un trajet
    // entre deux adresses que personne n'enchaîne — et si les deux adresses
    // coïncident, un trajet nul.
    //
    // Le cas réel : une intervenante disponible le samedi de 9 h à 13 h se
    // voyait proposer 9 h 30 pour une mission de 3 h 30 à Léognan, parce
    // qu'elle avait le lundi suivant une mission à cette même adresse. Le
    // trajet de retour valait donc zéro, et le créneau paraissait tenir.
    const lundi: RoundStop = {
      start: parisWallClockToUtc({
        year: 2026,
        month: 1,
        day: 19,
        hour: 9,
        minute: 0,
      }),
      end: parisWallClockToUtc({
        year: 2026,
        month: 1,
        day: 19,
        hour: 12,
        minute: 0,
      }),
      point: point("leognan"),
    };

    const cleaner = schedule({
      homePoint: point("cabanac-et-villagrains"),
      availability: computeAvailability({
        window: DAY,
        rules: [
          {
            weekday: 2,
            startMinute: 9 * 60,
            endMinute: 13 * 60,
            validFrom: ALWAYS,
            validUntil: null,
          },
        ],
      }),
      stops: [lundi],
    });

    // Mardi 9 h 30 → 13 h : la mission tient dans les heures déclarées, mais
    // pas le retour vers Cabanac. Elle doit être refusée.
    expect(
      evaluateSlot(
        cleaner,
        { window: DAY, durationMinutes: 210, destination: point("leognan") },
        paris(13, 9, 30).getTime(),
      ),
    ).toBeNull();
  });

  it("chaîne bien deux missions d'une même journée", () => {
    // Le pendant du test précédent : la restriction à la journée ne doit pas
    // faire perdre l'enchaînement réel entre deux missions du même jour.
    const cleaner = schedule({
      homePoint: point("cabanac-et-villagrains"),
      stops: [stop(14, 16, "leognan")],
    });

    const candidate = evaluateSlot(
      cleaner,
      { window: DAY, durationMinutes: 120, destination: point("leognan") },
      paris(13, 11).getTime(),
    );

    expect(candidate).not.toBeNull();
    // L'étape suivante est à la même adresse : le trajet de sortie est nul,
    // et c'est cette fois parfaitement exact.
    expect(candidate!.travelMinutesAfter).toBe(0);
  });

  it("arrondit les tampons de trajet au pas de cinq minutes", () => {
    const candidate = evaluateSlot(
      schedule({ homePoint: point("martillac") }),
      { window: DAY, durationMinutes: 120, destination: point("leognan") },
      paris(13, 10).getTime(),
    );

    expect(candidate).not.toBeNull();
    expect(candidate!.travelMinutesBefore % 5).toBe(0);
    expect(candidate!.travelMinutesAfter % 5).toBe(0);
  });
});

describe("recherche de créneaux", () => {
  it("propose une grille d'heures rondes", () => {
    const slots = findSlots([schedule()], {
      window: DAY,
      durationMinutes: 120,
      destination: point("leognan"),
      now: NOW,
    });

    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(slot.start.getUTCMinutes() % 30).toBe(0);
    }
    expect(formatParis(slots[0]!.start, { timeStyle: "short" })).toBe("09:00");
  });

  it("ne propose rien avant le délai de prévenance", () => {
    const slots = findSlots([schedule()], {
      window: DAY,
      durationMinutes: 120,
      destination: point("leognan"),
      // Mardi 8 h : les douze heures de prévenance couvrent toute la journée.
      now: paris(13, 8),
    });

    expect(slots).toEqual([]);
  });

  it("ne renvoie qu'un créneau par heure, avec le meilleur intervenant", () => {
    // Le client choisit une heure, jamais une personne.
    const slots = findSlots(
      [
        schedule({ cleanerProfileId: "a", isPreferred: false }),
        schedule({ cleanerProfileId: "b", isPreferred: true }),
      ],
      {
        window: DAY,
        durationMinutes: 120,
        destination: point("leognan"),
        now: NOW,
      },
    );

    const starts = slots.map((slot) => slot.start.getTime());
    expect(new Set(starts).size).toBe(starts.length);
    for (const slot of slots) {
      // L'intervenante attitrée l'emporte : la continuité est la promesse
      // commerciale centrale, elle ne se troque pas contre quelques minutes.
      expect(slot.cleanerProfileId).toBe("b");
    }
  });

  it("préfère l'intervenant dont la tournée absorbe le mieux la mission", () => {
    const proche = schedule({
      cleanerProfileId: "proche",
      homePoint: point("leognan"),
    });
    const lointain = schedule({
      cleanerProfileId: "lointain",
      homePoint: point("cabanac-et-villagrains"),
    });

    const slots = findSlots([lointain, proche], {
      window: DAY,
      durationMinutes: 120,
      destination: point("leognan"),
      now: NOW,
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((slot) => slot.cleanerProfileId === "proche")).toBe(
      true,
    );
  });

  it("respecte la limite demandée en gardant les créneaux les plus proches", () => {
    const slots = findSlots([schedule()], {
      window: DAY,
      durationMinutes: 120,
      destination: point("leognan"),
      now: NOW,
      limit: 3,
    });

    expect(slots).toHaveLength(3);
    expect(slots[0]!.start.getTime()).toBeLessThan(slots[2]!.start.getTime());
  });

  it("ne propose rien quand l'intervenant n'a aucune disponibilité", () => {
    expect(
      findSlots([schedule({ availability: [] })], {
        window: DAY,
        durationMinutes: 120,
        destination: point("leognan"),
        now: NOW,
      }),
    ).toEqual([]);
  });

  it("propose moins de créneaux pour une mission longue", () => {
    const courte = findSlots([schedule()], {
      window: DAY,
      durationMinutes: 120,
      destination: point("leognan"),
      now: NOW,
    });
    const longue = findSlots([schedule()], {
      window: DAY,
      durationMinutes: 300,
      destination: point("leognan"),
      now: NOW,
    });

    expect(longue.length).toBeLessThan(courte.length);
  });

  it("intercale une mission entre deux existantes quand la route le permet", () => {
    const cleaner = schedule({
      stops: [stop(9, 11, "leognan"), stop(15, 17, "leognan")],
      availability: computeAvailability({
        window: DAY,
        rules: [
          {
            weekday: 2,
            startMinute: 9 * 60,
            endMinute: 17 * 60,
            validFrom: ALWAYS,
            validUntil: null,
          },
        ],
        assignments: [
          {
            start: paris(13, 9),
            end: paris(13, 11),
            travelMinutesBefore: 0,
            travelMinutesAfter: 5,
          },
          {
            start: paris(13, 15),
            end: paris(13, 17),
            travelMinutesBefore: 5,
            travelMinutesAfter: 0,
          },
        ],
      }),
    });

    const slots = findSlots([cleaner], {
      window: DAY,
      durationMinutes: 120,
      destination: point("leognan"),
      now: NOW,
    });

    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(slot.start.getTime()).toBeGreaterThanOrEqual(
        paris(13, 11).getTime(),
      );
      expect(slot.end.getTime()).toBeLessThanOrEqual(paris(13, 15).getTime());
      // Mission voisine de la précédente : le détour est nul.
      expect(slot.insertionCostMinutes).toBe(0);
    }
  });
});

describe("marge de trajet sur une destination approximative", () => {
  /**
   * Le tunnel demande la commune avant l'adresse. Entre les deux, les créneaux
   * sont cherchés sur le centre de la commune : ce qui est proposé là doit
   * rester tenable une fois l'adresse exacte connue, sinon la réservation
   * échoue au dernier écran, après que tout a été rempli.
   */
  const request = {
    window: DAY,
    durationMinutes: 120,
    destination: point("martillac"),
    now: NOW,
    travel: travelMatrixFrom([]),
  };

  it("élargit les deux tampons de trajet", () => {
    const sans = evaluateSlot(schedule(), request, paris(13, 10).getTime());
    const avec = evaluateSlot(
      schedule(),
      { ...request, travelMarginMinutes: 10 },
      paris(13, 10).getTime(),
    );

    expect(sans).not.toBeNull();
    expect(avec).not.toBeNull();
    expect(avec!.travelMinutesBefore).toBeGreaterThan(
      sans!.travelMinutesBefore,
    );
    expect(avec!.travelMinutesAfter).toBeGreaterThan(sans!.travelMinutesAfter);
  });

  it("ne rend jamais un créneau plus facile", () => {
    // Une marge ne peut que retirer des créneaux, jamais en ajouter : c'est ce
    // qui permet de s'y fier avant de connaître l'adresse.
    const sans = findSlots([schedule()], request);
    const avec = findSlots([schedule()], {
      ...request,
      travelMarginMinutes: 10,
    });

    const heures = new Set(sans.map((slot) => slot.start.getTime()));
    for (const slot of avec) {
      expect(heures.has(slot.start.getTime())).toBe(true);
    }
  });

  it("retire le créneau qui ne tiendrait plus une fois la route allongée", () => {
    // Journée bornée à 17 h : une mission de 9 h à 17 h ne laisse aucune place
    // au retour, et la marge suffit à faire tomber le dernier départ possible.
    const cleaner = schedule({ homePoint: point("cabanac-et-villagrains") });
    const tardif = paris(13, 14, 30).getTime();

    const sans = evaluateSlot(cleaner, request, tardif);
    const avec = evaluateSlot(
      cleaner,
      { ...request, travelMarginMinutes: 30 },
      tardif,
    );

    expect(sans).not.toBeNull();
    expect(avec).toBeNull();
  });

  it("laisse tout inchangé quand la marge est nulle", () => {
    const sans = evaluateSlot(schedule(), request, paris(13, 10).getTime());
    const zero = evaluateSlot(
      schedule(),
      { ...request, travelMarginMinutes: 0 },
      paris(13, 10).getTime(),
    );

    expect(zero).toEqual(sans);
  });
});
