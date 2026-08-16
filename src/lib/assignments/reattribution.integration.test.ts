import { describe, expect, it } from "vitest";

import { reattribuer } from "@/lib/assignments/reattribution";
import { forOrganization, prisma } from "@/lib/db";
import { travelMatrixFrom } from "@/lib/scheduling/travel";
import { getCommuneBySlug } from "@/lib/territory";
import { parisWallClockToUtc } from "@/lib/time";

/**
 * Réattribution après un refus.
 *
 * Ce qui se vérifie ici tient en une phrase : un refus ne doit jamais laisser
 * une réservation sans personne. Et son corollaire, moins évident : celui qui
 * vient de refuser ne doit pas se voir reproposer la même mission.
 */

const LEOGNAN = getCommuneBySlug("leognan")!;
const CESTAS = getCommuneBySlug("cestas")!;

/** Mardi 13 janvier 2026, 10 h heure de Paris. */
const DEBUT = parisWallClockToUtc({
  year: 2026,
  month: 1,
  day: 13,
  hour: 10,
  minute: 0,
});
const FIN = new Date(DEBUT.getTime() + 180 * 60_000);

/** Trajets figés : le test ne dépend d'aucun service extérieur. */
const TRAJETS = travelMatrixFrom([
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
  bookingId: string;
  cleanerProfileIds: string[];
}

async function seed({ cleaners = 2 } = {}): Promise<Fixture> {
  const organization = await prisma.organization.create({
    data: {
      slug: "leoclean",
      name: "Léo Clean",
      type: "MARKETPLACE",
      status: "ACTIVE",
      commissionRateBp: 3800,
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
    // Mardi, 9 h – 17 h.
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

  const clientUser = await prisma.user.create({
    data: { email: "cliente@leoclean.test", name: "Claire Dubourg" },
  });
  const clientProfile = await db.clientProfile.create({
    data: { organizationId: organization.id, userId: clientUser.id },
  });
  const address = await db.address.create({
    data: {
      organizationId: organization.id,
      clientProfileId: clientProfile.id,
      street: "8 rue de Gazinet",
      postalCode: CESTAS.postalCode,
      cityName: CESTAS.name,
      inseeCode: CESTAS.insee,
      lat: CESTAS.lat,
      lng: CESTAS.lng,
    },
  });

  const booking = await db.booking.create({
    data: {
      organizationId: organization.id,
      clientProfileId: clientProfile.id,
      addressId: address.id,
      serviceId: service.id,
      status: "ASSIGNED",
      scheduledStart: DEBUT,
      scheduledEnd: FIN,
      durationMinutes: 180,
      surfaceSqm: 75,
      frequency: "WEEKLY",
      hourlyRateCents: 2900,
      grossAmountCents: 8700,
      professionalAmountCents: 5400,
      platformFeeAmountCents: 3300,
      commissionRateBp: 3800,
      taxCreditAmountCents: 4350,
      netAmountCents: 4350,
    },
  });

  return {
    organizationId: organization.id,
    bookingId: booking.id,
    cleanerProfileIds,
  };
}

describe("réattribution après refus", () => {
  it("propose la mission à quelqu'un d'autre", async () => {
    const fixture = await seed({ cleaners: 2 });
    const db = forOrganization(fixture.organizationId);
    const refusant = fixture.cleanerProfileIds[0]!;

    const resultat = await reattribuer(
      db,
      { id: fixture.organizationId },
      {
        bookingId: fixture.bookingId,
        exclureCleanerProfileIds: [refusant],
        now: new Date(DEBUT.getTime() - 48 * 3_600_000),
        travel: TRAJETS,
      },
    );

    expect(resultat).not.toBeNull();
    expect(resultat!.cleanerProfileId).toBe(fixture.cleanerProfileIds[1]);

    const affectation = await db.assignment.findUniqueOrThrow({
      where: { id: resultat!.assignmentId },
    });
    expect(affectation.status).toBe("PROPOSED");
    expect(affectation.startAt.getTime()).toBe(DEBUT.getTime());
    // Le créneau bloqué déborde des temps de route, comme à la création.
    expect(affectation.blockStartAt.getTime()).toBeLessThan(DEBUT.getTime());
    expect(affectation.respondBy).not.toBeNull();
  });

  it("ne repropose jamais la mission à celui qui vient de la refuser", async () => {
    // C'est le corollaire du refus : sans cette exclusion, on lui renverrait
    // la même mission dans la seconde.
    const fixture = await seed({ cleaners: 1 });
    const db = forOrganization(fixture.organizationId);

    const resultat = await reattribuer(
      db,
      { id: fixture.organizationId },
      {
        bookingId: fixture.bookingId,
        exclureCleanerProfileIds: [fixture.cleanerProfileIds[0]!],
        now: new Date(DEBUT.getTime() - 48 * 3_600_000),
        travel: TRAJETS,
      },
    );

    expect(resultat).toBeNull();
    expect(await db.assignment.count()).toBe(0);
  });

  it("rend null plutôt que d'inventer un intervenant indisponible", async () => {
    // Deux intervenantes, mais la mission tombe un dimanche : aucune n'a
    // déclaré d'heures ce jour-là.
    const fixture = await seed({ cleaners: 2 });
    const db = forOrganization(fixture.organizationId);
    const dimanche = parisWallClockToUtc({
      year: 2026,
      month: 1,
      day: 18,
      hour: 10,
      minute: 0,
    });
    await db.booking.update({
      where: { id: fixture.bookingId },
      data: {
        scheduledStart: dimanche,
        scheduledEnd: new Date(dimanche.getTime() + 180 * 60_000),
      },
    });

    const resultat = await reattribuer(
      db,
      { id: fixture.organizationId },
      {
        bookingId: fixture.bookingId,
        exclureCleanerProfileIds: [],
        now: new Date(dimanche.getTime() - 48 * 3_600_000),
        travel: TRAJETS,
      },
    );

    expect(resultat).toBeNull();
  });

  it("descend le classement quand la base refuse le mieux placé", async () => {
    // Le premier candidat est déjà occupé sur ce créneau : la contrainte
    // d'exclusion refusera son affectation, et la réattribution doit passer au
    // suivant plutôt que d'abandonner.
    const fixture = await seed({ cleaners: 2 });
    const db = forOrganization(fixture.organizationId);

    // On occupe les deux, sauf une : on bloque la première par une mission
    // concurrente déjà acceptée.
    const premiere = fixture.cleanerProfileIds[0]!;
    await db.assignment.create({
      data: {
        organizationId: fixture.organizationId,
        bookingId: fixture.bookingId,
        cleanerProfileId: premiere,
        status: "ACCEPTED",
        startAt: DEBUT,
        endAt: FIN,
        blockStartAt: new Date(DEBUT.getTime() - 15 * 60_000),
        blockEndAt: new Date(FIN.getTime() + 15 * 60_000),
        travelMinutesBefore: 15,
        travelMinutesAfter: 15,
      },
    });

    const resultat = await reattribuer(
      db,
      { id: fixture.organizationId },
      {
        bookingId: fixture.bookingId,
        exclureCleanerProfileIds: [],
        now: new Date(DEBUT.getTime() - 48 * 3_600_000),
        travel: TRAJETS,
      },
    );

    expect(resultat).not.toBeNull();
    expect(resultat!.cleanerProfileId).toBe(fixture.cleanerProfileIds[1]);
  });
});
