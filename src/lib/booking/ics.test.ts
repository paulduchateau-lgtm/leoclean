import { describe, expect, it } from "vitest";

import { bookingCalendar, bookingCalendarFilename } from "@/lib/booking/ics";

/**
 * Un fichier iCalendar mal formé n'échoue pas bruyamment : l'agenda l'ignore,
 * et le client croit avoir posé son rendez-vous. D'où des vérifications au
 * caractère près, sur les trois points où un générateur se trompe — les fins
 * de ligne, l'échappement et le repli.
 */

const EVENT = {
  bookingId: "cl123abc",
  start: new Date("2026-09-14T07:30:00.000Z"),
  end: new Date("2026-09-14T10:30:00.000Z"),
  location: "12 rue des Vignes, 33850 Léognan",
  stampedAt: new Date("2026-08-16T12:00:00.000Z"),
};

describe("fichier iCalendar", () => {
  it("porte l'enveloppe et l'événement attendus", () => {
    const ics = bookingCalendar(EVENT);

    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("VERSION:2.0");
  });

  it("écrit les instants en UTC, comme la base les stocke", () => {
    const ics = bookingCalendar(EVENT);

    expect(ics).toContain("DTSTART:20260914T073000Z");
    expect(ics).toContain("DTEND:20260914T103000Z");
    expect(ics).toContain("DTSTAMP:20260816T120000Z");
  });

  it("n'emploie que des fins de ligne CRLF", () => {
    const ics = bookingCalendar(EVENT);
    // Un LF isolé fait rejeter le fichier par les agendas de bureau.
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it("échappe la virgule d'une adresse", () => {
    const ics = bookingCalendar(EVENT);
    // Non échappée, elle couperait la valeur en deux.
    expect(ics).toContain("LOCATION:12 rue des Vignes\\, 33850 Léognan");
  });

  it("échappe aussi le point-virgule et l'antislash", () => {
    const ics = bookingCalendar({
      ...EVENT,
      location: "Lieu-dit ; le \\ bas",
    });

    expect(ics).toContain("LOCATION:Lieu-dit \\; le \\\\ bas");
  });

  it("replie les lignes longues sans couper un caractère accentué", () => {
    const ics = bookingCalendar({
      ...EVENT,
      location: `${"é".repeat(120)} rue de la Très Longue Adresse`,
    });

    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    // Le caractère n'a pas été coupé en deux octets : il se relit entier.
    expect(ics.replace(/\r\n /g, "")).toContain("é".repeat(120));
  });

  it("nomme l'intervenant quand il est déjà désigné", () => {
    const ics = bookingCalendar({ ...EVENT, cleanerFirstName: "Sabrina" });

    expect(ics).toContain("SUMMARY:Ménage Léo Clean — Sabrina");
    expect(ics).toContain("Sabrina vient faire le ménage");
  });

  it("ne promet personne tant que l'intervenant n'est pas confirmé", () => {
    const ics = bookingCalendar(EVENT);

    expect(ics).toContain("SUMMARY:Ménage Léo Clean");
    expect(ics).toContain("sous 24 heures");
  });

  it("réutilise l'identifiant de réservation, pour mettre à jour plutôt que dupliquer", () => {
    const ics = bookingCalendar(EVENT);
    expect(ics).toContain("UID:cl123abc@");
  });

  it("pose un rappel la veille, tant que l'annulation est gratuite", () => {
    const ics = bookingCalendar(EVENT);
    expect(ics).toContain("TRIGGER:-P1D");
  });

  it("nomme le fichier par la date de l'intervention", () => {
    expect(bookingCalendarFilename(EVENT.start)).toBe(
      "menage-leoclean-2026-09-14.ics",
    );
  });
});
