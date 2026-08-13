import { describe, expect, it } from "vitest";

import {
  formatParis,
  parisDayMinuteToUtc,
  parisIsoWeekday,
  parisMinuteOfDay,
  parisOffsetMinutes,
  parisWallClockToUtc,
  utcToParisWallClock,
} from "./time";

describe("décalage horaire de Paris", () => {
  it("vaut +1 h en hiver", () => {
    expect(parisOffsetMinutes(new Date("2026-01-15T12:00:00Z"))).toBe(60);
  });

  it("vaut +2 h en été", () => {
    expect(parisOffsetMinutes(new Date("2026-07-15T12:00:00Z"))).toBe(120);
  });
});

describe("heure murale française vers UTC", () => {
  it("convertit une heure d'hiver", () => {
    const utc = parisWallClockToUtc({
      year: 2026,
      month: 1,
      day: 15,
      hour: 9,
      minute: 0,
    });
    expect(utc.toISOString()).toBe("2026-01-15T08:00:00.000Z");
  });

  it("convertit une heure d'été", () => {
    const utc = parisWallClockToUtc({
      year: 2026,
      month: 7,
      day: 15,
      hour: 9,
      minute: 0,
    });
    expect(utc.toISOString()).toBe("2026-07-15T07:00:00.000Z");
  });

  it("garde 9 h locales de part et d'autre du passage à l'heure d'été", () => {
    // Le changement a lieu dans la nuit du 28 au 29 mars 2026. Un ménage
    // hebdomadaire du dimanche à 9 h doit rester à 9 h pour le client, même si
    // l'instant UTC, lui, se décale d'une heure.
    const before = parisWallClockToUtc({
      year: 2026,
      month: 3,
      day: 22,
      hour: 9,
      minute: 0,
    });
    const after = parisWallClockToUtc({
      year: 2026,
      month: 3,
      day: 29,
      hour: 9,
      minute: 0,
    });

    expect(before.toISOString()).toBe("2026-03-22T08:00:00.000Z");
    expect(after.toISOString()).toBe("2026-03-29T07:00:00.000Z");
    expect(utcToParisWallClock(before).hour).toBe(9);
    expect(utcToParisWallClock(after).hour).toBe(9);
  });

  it("garde 9 h locales de part et d'autre du passage à l'heure d'hiver", () => {
    const before = parisWallClockToUtc({
      year: 2026,
      month: 10,
      day: 18,
      hour: 9,
      minute: 0,
    });
    const after = parisWallClockToUtc({
      year: 2026,
      month: 11,
      day: 1,
      hour: 9,
      minute: 0,
    });

    expect(utcToParisWallClock(before).hour).toBe(9);
    expect(utcToParisWallClock(after).hour).toBe(9);
    expect(before.toISOString()).toBe("2026-10-18T07:00:00.000Z");
    expect(after.toISOString()).toBe("2026-11-01T08:00:00.000Z");
  });

  it("résout une heure inexistante vers l'heure suivante plutôt que de lever", () => {
    // Le 29 mars 2026, l'horloge saute de 2 h à 3 h : 2 h 30 n'existe pas.
    const utc = parisWallClockToUtc({
      year: 2026,
      month: 3,
      day: 29,
      hour: 2,
      minute: 30,
    });

    expect(utcToParisWallClock(utc).hour).toBe(3);
    expect(utcToParisWallClock(utc).minute).toBe(30);
  });

  it("retient la première occurrence d'une heure ambiguë", () => {
    // Le 25 octobre 2026, 2 h 30 existe deux fois. On garde celle en heure
    // d'été, soit 00 h 30 UTC.
    const utc = parisWallClockToUtc({
      year: 2026,
      month: 10,
      day: 25,
      hour: 2,
      minute: 30,
    });

    expect(utc.toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });

  it("fait l'aller-retour sans perte sur une année entière", () => {
    for (let month = 1; month <= 12; month += 1) {
      const wall = { year: 2026, month, day: 15, hour: 14, minute: 30 };
      expect(utcToParisWallClock(parisWallClockToUtc(wall))).toEqual(wall);
    }
  });
});

describe("jour de la semaine", () => {
  it("numérote lundi à 1 et dimanche à 7, selon ISO 8601", () => {
    // Le 17 août 2026 est un lundi.
    expect(parisIsoWeekday(new Date("2026-08-17T10:00:00Z"))).toBe(1);
    expect(parisIsoWeekday(new Date("2026-08-23T10:00:00Z"))).toBe(7);
  });

  it("se place du côté français lorsque l'UTC est encore la veille", () => {
    // 23 h 30 UTC le dimanche, c'est déjà lundi 1 h 30 à Paris.
    expect(parisIsoWeekday(new Date("2026-08-16T23:30:00Z"))).toBe(1);
  });
});

describe("minutes depuis minuit", () => {
  it("compte en heure locale, pas en UTC", () => {
    expect(parisMinuteOfDay(new Date("2026-08-17T07:00:00Z"))).toBe(9 * 60);
  });

  it("reconstruit l'instant à partir du jour et des minutes", () => {
    const utc = parisDayMinuteToUtc(
      { year: 2026, month: 8, day: 17 },
      9 * 60 + 30,
    );
    expect(utc.toISOString()).toBe("2026-08-17T07:30:00.000Z");
  });
});

describe("formatage", () => {
  it("affiche en français et en heure locale", () => {
    const formatted = formatParis(new Date("2026-08-17T07:00:00Z"), {
      dateStyle: "short",
      timeStyle: "short",
    });
    expect(formatted).toContain("09:00");
  });
});
