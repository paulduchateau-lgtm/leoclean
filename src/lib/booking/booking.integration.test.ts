import { describe, expect, it } from "vitest";

import { createBooking, responseDeadline } from "@/lib/booking/create";
import { SlotTakenError } from "@/lib/booking/errors";
import { forOrganization, prisma } from "@/lib/db";
import { travelMatrixFrom } from "@/lib/scheduling/travel";
import { getCommuneBySlug } from "@/lib/territory";
import { parisWallClockToUtc } from "@/lib/time";

/**
 * Réservation.
 *
 * Le test qui compte est celui de la concurrence. Deux clients qui valident le
 * même créneau à la même seconde, c'est le cas nominal d'un service local : un
 * seul intervenant couvre parfois une commune, et le mardi matin est demandé
 * par tout le monde. Aucune vérification applicative ne résiste à cette
 * situation — seule la contrainte d'exclusion en base l'arbitre.
 */

const LEOGNAN = getCommuneBySlug("leognan")!;
const CESTAS = getCommuneBySlug("cestas")!;

const paris = (day: number, hour: number, minute = 0) =>
  parisWallClockToUtc({ year: 2026, month: 1, day, hour, minute });

/** Trajets figés : le test ne doit dépendre d'aucun service extérieur. */
const TRAVEL = travelMatrixFrom([
  {
    origin: { lat: LEOGNAN.lat, lng: LEOGNAN.lng },
    destination: { lat: CESTAS.lat, lng: CESTAS.lng },
    durationMinutes: 11,
  },
  {
    origin: { lat: CESTAS.lat, lng: CESTAS.lng },
    destination: { lat: LEOGNAN.lat, lng: LEOGNAN.lng },
    durationMinutes: 11,
  },
]);

interface Fixture {
  organizationId: string;
  commissionRateBp: number;
  clientProfileIds: string[];
  addressIds: string[];
  cleanerProfileIds: string[];
}

async function seed({ cleaners = 1, clients = 2 } = {}): Promise<Fixture> {
  const organization = await prisma.organization.create({
    data: {
      slug: "leoclean",
      name: "Léo Clean",
      type: "MARKETPLACE",
      status: "ACTIVE",
      commissionRateBp: 2500,
    },
  });
  const db = forOrganization(organization.id);

  const service = await db.service.create({
    data: {
      organizationId: organization.id,
      slug: "menage-regulier",
      name: "Ménage régulier",
      kind: "MENAGE_REGULIER",
      sqmPerHour: 25,
      minDurationMinutes: 120,
    },
  });

  for (const frequency of ["ONE_OFF", "WEEKLY"] as const) {
    await db.pricingRule.create({
      data: {
        organizationId: organization.id,
        serviceId: service.id,
        frequency,
        hourlyRateCents: frequency === "ONE_OFF" ? 3300 : 2900,
        taxCreditRateBp: 5000,
        validFrom: new Date(Date.UTC(2020, 0, 1)),
      },
    });
  }

  const cleanerProfileIds: string[] = [];
  for (let index = 0; index < cleaners; index += 1) {
    const user = await prisma.user.create({
      data: { email: `pro${index}@leoclean.test` },
    });
    const home = await db.address.create({
      data: {
        organizationId: organization.id,
        street: `${index + 1} place Joane`,
        postalCode: LEOGNAN.postalCode,
        cityName: LEOGNAN.name,
        inseeCode: LEOGNAN.insee,
        lat: LEOGNAN.lat,
        lng: LEOGNAN.lng,
      },
    });
    const cleaner = await db.cleanerProfile.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        displayName: `Intervenante ${index + 1}`,
        status: "ACTIVE",
        homeAddressId: home.id,
        maxTravelMinutes: 30,
      },
    });
    // Mardi 9 h – 17 h.
    await db.availabilityRule.create({
      data: {
        organizationId: organization.id,
        cleanerProfileId: cleaner.id,
        weekday: 2,
        startMinute: 9 * 60,
        endMinute: 17 * 60,
        validFrom: new Date(Date.UTC(2020, 0, 1)),
      },
    });
    cleanerProfileIds.push(cleaner.id);
  }

  const clientProfileIds: string[] = [];
  const addressIds: string[] = [];
  for (let index = 0; index < clients; index += 1) {
    const user = await prisma.user.create({
      data: { email: `client${index}@leoclean.test` },
    });
    const profile = await db.clientProfile.create({
      data: { organizationId: organization.id, userId: user.id },
    });
    const address = await db.address.create({
      data: {
        organizationId: organization.id,
        clientProfileId: profile.id,
        street: `${index + 1} rue de Gazinet`,
        postalCode: CESTAS.postalCode,
        cityName: CESTAS.name,
        inseeCode: CESTAS.insee,
        lat: CESTAS.lat,
        lng: CESTAS.lng,
      },
    });
    clientProfileIds.push(profile.id);
    addressIds.push(address.id);
  }

  return {
    organizationId: organization.id,
    commissionRateBp: organization.commissionRateBp,
    clientProfileIds,
    addressIds,
    cleanerProfileIds,
  };
}

function book(fixture: Fixture, clientIndex: number, start: Date) {
  const db = forOrganization(fixture.organizationId);
  return createBooking(
    db,
    {
      id: fixture.organizationId,
      commissionRateBp: fixture.commissionRateBp,
    },
    {
      organizationId: fixture.organizationId,
      clientProfileId: fixture.clientProfileIds[clientIndex]!,
      addressId: fixture.addressIds[clientIndex]!,
      serviceSlug: "menage-regulier",
      surfaceSqm: 75,
      frequency: "WEEKLY",
      scheduledStart: start,
      travel: TRAVEL,
      now: paris(1, 8),
    },
  );
}

describe("création d'une réservation", () => {
  it("enregistre la réservation, ses lignes et l'affectation ensemble", async () => {
    const fixture = await seed();
    const created = await book(fixture, 0, paris(13, 10));

    const db = forOrganization(fixture.organizationId);
    const booking = await db.booking.findUniqueOrThrow({
      where: { id: created.bookingId },
      include: { items: true, assignments: true, statusEvents: true },
    });

    expect(booking.status).toBe("ASSIGNED");
    expect(booking.items).toHaveLength(1);
    expect(booking.assignments).toHaveLength(1);
    expect(booking.statusEvents).toHaveLength(1);
    expect(booking.assignments[0]!.status).toBe("PROPOSED");
    expect(booking.assignments[0]!.cleanerProfileId).toBe(
      fixture.cleanerProfileIds[0],
    );
  });

  it("fige les montants du devis affiché", async () => {
    // 75 m² à 25 m²/h font trois heures ; trois heures à 29 €/h font 87 €.
    const fixture = await seed();
    const created = await book(fixture, 0, paris(13, 10));

    const booking = await forOrganization(
      fixture.organizationId,
    ).booking.findUniqueOrThrow({ where: { id: created.bookingId } });

    expect(booking.durationMinutes).toBe(180);
    expect(booking.hourlyRateCents).toBe(2900);
    expect(booking.grossAmountCents).toBe(8700);
    // Les deux lignes de facturation somment exactement au total réglé.
    expect(
      booking.professionalAmountCents + booking.platformFeeAmountCents,
    ).toBe(booking.grossAmountCents);
    expect(booking.netAmountCents).toBe(
      booking.grossAmountCents - booking.taxCreditAmountCents,
    );
  });

  it("réserve le créneau tampons de trajet compris", async () => {
    const fixture = await seed();
    const created = await book(fixture, 0, paris(13, 10));

    const assignment = await forOrganization(
      fixture.organizationId,
    ).assignment.findFirstOrThrow({ where: { bookingId: created.bookingId } });

    // 11 minutes de route arrondies au pas de cinq, de part et d'autre.
    expect(assignment.travelMinutesBefore).toBe(15);
    expect(assignment.travelMinutesAfter).toBe(15);
    expect(assignment.blockStartAt.getTime()).toBe(paris(13, 9, 45).getTime());
    expect(assignment.blockEndAt.getTime()).toBe(paris(13, 13, 15).getTime());
    expect(assignment.score).toBeGreaterThan(0);
    expect(assignment.scoreBreakdown).not.toBeNull();
  });

  it("conserve la décomposition du score, pour pouvoir s'expliquer", async () => {
    const fixture = await seed();
    const created = await book(fixture, 0, paris(13, 10));

    const assignment = await forOrganization(
      fixture.organizationId,
    ).assignment.findFirstOrThrow({ where: { bookingId: created.bookingId } });

    expect(Object.keys(assignment.scoreBreakdown as object).sort()).toEqual([
      "acceptance",
      "continuity",
      "fairness",
      "rating",
      "travel",
    ]);
  });

  it("refuse un créneau sans intervenant disponible", async () => {
    // Mercredi : aucune règle de disponibilité ne le couvre.
    const fixture = await seed();
    await expect(book(fixture, 0, paris(14, 10))).rejects.toThrow(
      /Aucun intervenant/,
    );
  });
});

describe("concurrence sur un même créneau", () => {
  it("n'accorde le créneau qu'à un seul client", async () => {
    // Le cœur du verrou. Deux réservations parties en même temps sur le même
    // créneau, avec une seule intervenante : la base doit en accepter une et
    // une seule, et l'autre doit recevoir une erreur métier lisible — pas une
    // trace d'exécution.
    const fixture = await seed({ cleaners: 1, clients: 2 });
    const start = paris(13, 10);

    const results = await Promise.allSettled([
      book(fixture, 0, start),
      book(fixture, 1, start),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(SlotTakenError);

    // Et la base ne porte qu'une affectation : rien n'a été écrit à moitié.
    const assignments = await forOrganization(
      fixture.organizationId,
    ).assignment.findMany();
    expect(assignments).toHaveLength(1);
  });

  it("ne laisse aucune réservation orpheline après un échec", async () => {
    // Si la transaction ne couvrait pas l'affectation, le perdant laisserait
    // derrière lui une réservation sans intervenant — un client qui attend
    // quelqu'un qui ne viendra pas.
    const fixture = await seed({ cleaners: 1, clients: 2 });
    const start = paris(13, 10);

    await Promise.allSettled([
      book(fixture, 0, start),
      book(fixture, 1, start),
    ]);

    const db = forOrganization(fixture.organizationId);
    const bookings = await db.booking.findMany({
      include: { assignments: true, items: true },
    });

    expect(bookings).toHaveLength(1);
    expect(bookings[0]!.assignments).toHaveLength(1);
    expect(bookings[0]!.items).toHaveLength(1);
  });

  it("sert les deux clients quand deux intervenantes sont disponibles", async () => {
    // Ce test défend le repli sur le candidat suivant. Les deux réservations
    // désignent d'abord la même intervenante — la lecture des disponibilités
    // ne voit pas les transactions en cours — et la perdante doit réessayer
    // avec la seconde plutôt que d'annoncer un créneau pris alors qu'il ne
    // l'est pas.
    const fixture = await seed({ cleaners: 2, clients: 2 });
    const start = paris(13, 10);

    const results = await Promise.allSettled([
      book(fixture, 0, start),
      book(fixture, 1, start),
    ]);

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);

    const assignments = await forOrganization(
      fixture.organizationId,
    ).assignment.findMany();
    expect(assignments).toHaveLength(2);
    // Deux intervenantes distinctes : la seconde n'a pas été attribuée deux
    // fois au même créneau.
    expect(
      new Set(assignments.map((entry) => entry.cleanerProfileId)).size,
    ).toBe(2);
  });

  it("laisse le créneau suivant libre après une réservation", async () => {
    const fixture = await seed({ cleaners: 1, clients: 2 });
    await book(fixture, 0, paris(13, 9, 30));

    // 9 h 30 – 12 h 30 plus quinze minutes de retour : le créneau de 13 h passe.
    await expect(book(fixture, 1, paris(13, 13))).resolves.toBeDefined();
  });
});

describe("délai de réponse laissé à l'intervenant", () => {
  it("laisse la moitié du temps restant, entre deux et vingt-quatre heures", () => {
    const now = new Date(Date.UTC(2026, 0, 12, 8));

    // Mission dans dix heures : cinq heures pour répondre.
    expect(
      responseDeadline(new Date(Date.UTC(2026, 0, 12, 18)), now).getTime(),
    ).toBe(Date.UTC(2026, 0, 12, 13));

    // Mission dans deux heures : le plancher de deux heures s'applique, borné
    // au début de la mission — on ne demande jamais de répondre après coup.
    expect(
      responseDeadline(new Date(Date.UTC(2026, 0, 12, 10)), now).getTime(),
    ).toBe(Date.UTC(2026, 0, 12, 10));

    // Mission dans dix jours : le plafond de vingt-quatre heures s'applique.
    expect(
      responseDeadline(new Date(Date.UTC(2026, 0, 22, 8)), now).getTime(),
    ).toBe(Date.UTC(2026, 0, 13, 8));
  });
});
