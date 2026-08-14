import { describe, expect, it } from "vitest";

import {
  type WeeklyAvailabilityRule,
  computeAvailability,
  fitsInAvailability,
} from "@/lib/scheduling/availability";
import { type Interval, durationMinutes } from "@/lib/scheduling/intervals";
import { formatParis, parisWallClockToUtc } from "@/lib/time";

/** Heure murale française → instant, pour écrire les cas comme on les pense. */
function paris(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  return parisWallClockToUtc({ year, month, day, hour, minute });
}

function window(from: Date, to: Date): Interval {
  return { start: from.getTime(), end: to.getTime() };
}

const ALWAYS = new Date(Date.UTC(2000, 0, 1));

/** Du lundi au vendredi, 9 h – 17 h, heure de Paris. */
const WEEKDAYS_9_TO_17: WeeklyAvailabilityRule[] = [1, 2, 3, 4, 5].map(
  (weekday) => ({
    weekday,
    startMinute: 9 * 60,
    endMinute: 17 * 60,
    validFrom: ALWAYS,
    validUntil: null,
  }),
);

describe("disponibilité", () => {
  it("projette une règle hebdomadaire sur les bons jours", () => {
    // Semaine du lundi 12 au dimanche 18 janvier 2026.
    const result = computeAvailability({
      window: window(paris(2026, 1, 12, 0), paris(2026, 1, 19, 0)),
      rules: WEEKDAYS_9_TO_17,
    });

    expect(result).toHaveLength(5);
    for (const slot of result) {
      expect(durationMinutes(slot)).toBe(480);
      expect(formatParis(new Date(slot.start), { timeStyle: "short" })).toBe(
        "09:00",
      );
    }
  });

  it("ne produit rien en dehors de la fenêtre demandée", () => {
    const from = paris(2026, 1, 13, 12);
    const to = paris(2026, 1, 14, 12);

    const result = computeAvailability({
      window: window(from, to),
      rules: WEEKDAYS_9_TO_17,
    });

    for (const slot of result) {
      expect(slot.start).toBeGreaterThanOrEqual(from.getTime());
      expect(slot.end).toBeLessThanOrEqual(to.getTime());
    }
    // Mardi après-midi tronqué, mercredi matin tronqué.
    expect(result).toHaveLength(2);
    expect(durationMinutes(result[0]!)).toBe(300);
    expect(durationMinutes(result[1]!)).toBe(180);
  });

  it("respecte la période de validité d'une règle", () => {
    const result = computeAvailability({
      window: window(paris(2026, 1, 12, 0), paris(2026, 1, 17, 0)),
      rules: [
        {
          weekday: 3,
          startMinute: 9 * 60,
          endMinute: 17 * 60,
          validFrom: paris(2026, 1, 15, 0),
          validUntil: null,
        },
      ],
    });

    // La règle ne prend effet que le jeudi : le mercredi 14 reste vide.
    expect(result).toEqual([]);
  });

  it("retire une absence déclarée", () => {
    const result = computeAvailability({
      window: window(paris(2026, 1, 13, 0), paris(2026, 1, 14, 0)),
      rules: WEEKDAYS_9_TO_17,
      exceptions: [
        {
          type: "UNAVAILABLE",
          start: paris(2026, 1, 13, 12),
          end: paris(2026, 1, 13, 14),
        },
      ],
    });

    expect(result).toHaveLength(2);
    expect(durationMinutes(result[0]!)).toBe(180);
    expect(durationMinutes(result[1]!)).toBe(180);
  });

  it("ajoute une ouverture exceptionnelle hors des heures habituelles", () => {
    const result = computeAvailability({
      window: window(paris(2026, 1, 17, 0), paris(2026, 1, 18, 0)),
      rules: WEEKDAYS_9_TO_17,
      exceptions: [
        {
          type: "AVAILABLE",
          start: paris(2026, 1, 17, 9),
          end: paris(2026, 1, 17, 13),
        },
      ],
    });

    // Le samedi n'est couvert par aucune règle : seule l'ouverture compte.
    expect(result).toHaveLength(1);
    expect(durationMinutes(result[0]!)).toBe(240);
  });

  it("fait primer l'absence sur l'ouverture exceptionnelle", () => {
    // Arbitrage figé : poser une absence est un acte délibéré, une ouverture
    // peut n'être qu'un reliquat. En cas de recouvrement, l'absence gagne.
    const result = computeAvailability({
      window: window(paris(2026, 1, 17, 0), paris(2026, 1, 18, 0)),
      rules: [],
      exceptions: [
        {
          type: "AVAILABLE",
          start: paris(2026, 1, 17, 9),
          end: paris(2026, 1, 17, 17),
        },
        {
          type: "UNAVAILABLE",
          start: paris(2026, 1, 17, 11),
          end: paris(2026, 1, 17, 13),
        },
      ],
    });

    expect(result).toHaveLength(2);
    expect(durationMinutes(result[0]!)).toBe(120);
    expect(durationMinutes(result[1]!)).toBe(240);
  });

  it("retire les occupations d'agenda externe", () => {
    const result = computeAvailability({
      window: window(paris(2026, 1, 13, 0), paris(2026, 1, 14, 0)),
      rules: WEEKDAYS_9_TO_17,
      externalBusy: [
        {
          start: paris(2026, 1, 13, 10).getTime(),
          end: paris(2026, 1, 13, 11).getTime(),
        },
      ],
    });

    expect(result.map(durationMinutes)).toEqual([60, 360]);
  });

  it("retire les missions avec leurs tampons de trajet", () => {
    // Une mission de 12 h à 14 h précédée de 20 minutes de route et suivie de
    // 15 occupe en réalité 11 h 40 – 14 h 15.
    const result = computeAvailability({
      window: window(paris(2026, 1, 13, 0), paris(2026, 1, 14, 0)),
      rules: WEEKDAYS_9_TO_17,
      assignments: [
        {
          start: paris(2026, 1, 13, 12),
          end: paris(2026, 1, 13, 14),
          travelMinutesBefore: 20,
          travelMinutesAfter: 15,
        },
      ],
    });

    expect(result).toHaveLength(2);
    expect(durationMinutes(result[0]!)).toBe(160); // 9 h 00 → 11 h 40
    expect(durationMinutes(result[1]!)).toBe(165); // 14 h 15 → 17 h 00
  });

  it("écarte les fragments trop courts pour la moindre mission", () => {
    const result = computeAvailability({
      window: window(paris(2026, 1, 13, 0), paris(2026, 1, 14, 0)),
      rules: WEEKDAYS_9_TO_17,
      assignments: [
        {
          start: paris(2026, 1, 13, 10),
          end: paris(2026, 1, 13, 16),
          travelMinutesBefore: 0,
          travelMinutesAfter: 0,
        },
      ],
      minimumSlotMinutes: 120,
    });

    // Restent 9 h – 10 h et 16 h – 17 h : deux fragments d'une heure, aucun
    // réservable puisque le minimum facturé est de deux heures.
    expect(result).toEqual([]);
  });

  it("tient l'heure locale au passage à l'heure d'été", () => {
    // Nuit du 28 au 29 mars 2026 : l'horloge saute de 2 h à 3 h. Une
    // disponibilité déclarée « 9 h – 17 h » doit rester de 9 h à 17 h, donc
    // durer huit heures — pas sept.
    const result = computeAvailability({
      window: window(paris(2026, 3, 29, 0), paris(2026, 3, 30, 0)),
      rules: [
        {
          weekday: 7,
          startMinute: 9 * 60,
          endMinute: 17 * 60,
          validFrom: ALWAYS,
          validUntil: null,
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(durationMinutes(result[0]!)).toBe(480);
    expect(
      formatParis(new Date(result[0]!.start), { timeStyle: "short" }),
    ).toBe("09:00");
  });

  it("tient l'heure locale au passage à l'heure d'hiver", () => {
    // Nuit du 24 au 25 octobre 2026 : la journée dure vingt-cinq heures. La
    // disponibilité déclarée n'en dure pas moins huit.
    const result = computeAvailability({
      window: window(paris(2026, 10, 25, 0), paris(2026, 10, 26, 0)),
      rules: [
        {
          weekday: 7,
          startMinute: 9 * 60,
          endMinute: 17 * 60,
          validFrom: ALWAYS,
          validUntil: null,
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(durationMinutes(result[0]!)).toBe(480);
    expect(
      formatParis(new Date(result[0]!.start), { timeStyle: "short" }),
    ).toBe("09:00");
  });

  it("couvre une plage débordant sur le jour suivant", () => {
    // Une règle allant jusqu'à minuit ne doit pas être tronquée par
    // l'itération sur les jours.
    const result = computeAvailability({
      window: window(paris(2026, 1, 13, 20), paris(2026, 1, 14, 4)),
      rules: [
        {
          weekday: 2,
          startMinute: 18 * 60,
          endMinute: 24 * 60,
          validFrom: ALWAYS,
          validUntil: null,
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(durationMinutes(result[0]!)).toBe(240); // 20 h → minuit
  });
});

describe("insertion d'une mission dans la disponibilité", () => {
  const availability = computeAvailability({
    window: window(paris(2026, 1, 13, 0), paris(2026, 1, 14, 0)),
    rules: WEEKDAYS_9_TO_17,
  });

  it("accepte une mission qui tient dans la plage", () => {
    expect(
      fitsInAvailability(availability, {
        start: paris(2026, 1, 13, 10).getTime(),
        end: paris(2026, 1, 13, 12).getTime(),
      }),
    ).toBe(true);
  });

  it("refuse une mission dont le trajet déborde de la plage", () => {
    // La mission de 9 h à 11 h tient, mais pas les vingt minutes de route qui
    // la précèdent : l'intervenant n'est pas disponible à 8 h 40. C'est
    // exactement le créneau qu'un moteur naïf vendrait.
    const candidate = {
      start: paris(2026, 1, 13, 9).getTime(),
      end: paris(2026, 1, 13, 11).getTime(),
    };
    expect(fitsInAvailability(availability, candidate)).toBe(true);
    expect(fitsInAvailability(availability, candidate, 20, 0)).toBe(false);
  });

  it("refuse une mission à cheval sur deux plages", () => {
    expect(
      fitsInAvailability(availability, {
        start: paris(2026, 1, 13, 16).getTime(),
        end: paris(2026, 1, 13, 18).getTime(),
      }),
    ).toBe(false);
  });
});
