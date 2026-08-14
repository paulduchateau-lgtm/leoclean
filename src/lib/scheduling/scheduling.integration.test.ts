import { describe, expect, it } from "vitest";

import { forOrganization, prisma } from "@/lib/db";
import { loadCleanerSchedules } from "@/lib/scheduling/repository";
import { findSlots } from "@/lib/scheduling/slots";
import { travelMatrixFrom } from "@/lib/scheduling/travel";
import { getCommuneBySlug } from "@/lib/territory";
import { parisWallClockToUtc } from "@/lib/time";

/**
 * Le moteur de disponibilité, branché à la base.
 *
 * Les tests unitaires prouvent que le calcul est juste. Ceux-ci prouvent deux
 * choses qu'aucune fonction pure ne peut établir seule :
 *
 * 1. que ce qui est lu en base arrive intact dans le moteur — statuts filtrés,
 *    fenêtres bornées, cloisonnement respecté ;
 * 2. que **le moteur et la contrainte d'exclusion sont d'accord**. C'est
 *    l'invariant central du produit : si le moteur propose un créneau que la
 *    base refuse, la réservation échoue après paiement.
 */

const LEOGNAN = getCommuneBySlug("leognan")!;
const CESTAS = getCommuneBySlug("cestas")!;

const paris = (day: number, hour: number, minute = 0) =>
  parisWallClockToUtc({ year: 2026, month: 1, day, hour, minute });

/** Mardi 13 janvier 2026. */
const TUESDAY = {
  start: paris(13, 0).getTime(),
  end: paris(14, 0).getTime(),
};

interface Fixture {
  organizationId: string;
  cleanerProfileId: string;
  clientProfileId: string;
  addressId: string;
  serviceId: string;
}

async function seedOrganization(slug: string): Promise<Fixture> {
  const organization = await prisma.organization.create({
    data: { slug, name: slug, type: "MARKETPLACE", status: "ACTIVE" },
  });
  const db = forOrganization(organization.id);

  const cleanerUser = await prisma.user.create({
    data: { email: `pro@${slug}.test` },
  });
  const clientUser = await prisma.user.create({
    data: { email: `client@${slug}.test` },
  });

  const clientProfile = await db.clientProfile.create({
    data: { organizationId: organization.id, userId: clientUser.id },
  });

  const home = await db.address.create({
    data: {
      organizationId: organization.id,
      street: "1 place Joane",
      postalCode: LEOGNAN.postalCode,
      cityName: LEOGNAN.name,
      inseeCode: LEOGNAN.insee,
      lat: LEOGNAN.lat,
      lng: LEOGNAN.lng,
    },
  });

  const address = await db.address.create({
    data: {
      organizationId: organization.id,
      clientProfileId: clientProfile.id,
      street: "2 rue de Gazinet",
      postalCode: CESTAS.postalCode,
      cityName: CESTAS.name,
      inseeCode: CESTAS.insee,
      lat: CESTAS.lat,
      lng: CESTAS.lng,
    },
  });

  const cleanerProfile = await db.cleanerProfile.create({
    data: {
      organizationId: organization.id,
      userId: cleanerUser.id,
      displayName: "Intervenante",
      status: "ACTIVE",
      homeAddressId: home.id,
      maxTravelMinutes: 30,
    },
  });

  // Mardi 9 h – 17 h.
  await db.availabilityRule.create({
    data: {
      organizationId: organization.id,
      cleanerProfileId: cleanerProfile.id,
      weekday: 2,
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      validFrom: new Date(Date.UTC(2020, 0, 1)),
    },
  });

  const service = await db.service.create({
    data: {
      organizationId: organization.id,
      slug: "menage-regulier",
      name: "Ménage régulier",
      kind: "MENAGE_REGULIER",
    },
  });

  return {
    organizationId: organization.id,
    cleanerProfileId: cleanerProfile.id,
    clientProfileId: clientProfile.id,
    addressId: address.id,
    serviceId: service.id,
  };
}

async function createBookingWithAssignment(
  fixture: Fixture,
  start: Date,
  end: Date,
  travelBefore: number,
  travelAfter: number,
  status: "PROPOSED" | "ACCEPTED" | "CANCELLED" = "ACCEPTED",
) {
  const db = forOrganization(fixture.organizationId);

  const booking = await db.booking.create({
    data: {
      organizationId: fixture.organizationId,
      clientProfileId: fixture.clientProfileId,
      addressId: fixture.addressId,
      serviceId: fixture.serviceId,
      status: "CONFIRMED",
      scheduledStart: start,
      scheduledEnd: end,
      durationMinutes: (end.getTime() - start.getTime()) / 60_000,
      hourlyRateCents: 2900,
      grossAmountCents: 5800,
      professionalAmountCents: 4350,
      platformFeeAmountCents: 1450,
      commissionRateBp: 2500,
      taxCreditAmountCents: 2900,
      netAmountCents: 2900,
    },
  });

  return db.assignment.create({
    data: {
      organizationId: fixture.organizationId,
      bookingId: booking.id,
      cleanerProfileId: fixture.cleanerProfileId,
      status,
      startAt: start,
      endAt: end,
      blockStartAt: new Date(start.getTime() - travelBefore * 60_000),
      blockEndAt: new Date(end.getTime() + travelAfter * 60_000),
      travelMinutesBefore: travelBefore,
      travelMinutesAfter: travelAfter,
    },
  });
}

describe("chargement du planning", () => {
  it("reconstitue la disponibilité déclarée d'un intervenant actif", async () => {
    const fixture = await seedOrganization("leoclean");
    const schedules = await loadCleanerSchedules(
      forOrganization(fixture.organizationId),
      { window: TUESDAY },
    );

    expect(schedules).toHaveLength(1);
    expect(schedules[0]!.availability).toHaveLength(1);
    expect(schedules[0]!.homePoint).toEqual({
      lat: LEOGNAN.lat,
      lng: LEOGNAN.lng,
    });
  });

  it("écarte les intervenants qui ne sont pas actifs", async () => {
    const fixture = await seedOrganization("leoclean");
    await forOrganization(fixture.organizationId).cleanerProfile.update({
      where: { id: fixture.cleanerProfileId },
      data: { status: "SUSPENDED" },
    });

    const schedules = await loadCleanerSchedules(
      forOrganization(fixture.organizationId),
      { window: TUESDAY },
    );
    expect(schedules).toEqual([]);
  });

  it("ne voit jamais les intervenants d'une autre organisation", async () => {
    // Deux sociétés se disputent le même territoire : la disponibilité des
    // intervenants de l'une ne doit pas fuir vers l'autre.
    const leoclean = await seedOrganization("leoclean");
    await seedOrganization("concurrent");

    const schedules = await loadCleanerSchedules(
      forOrganization(leoclean.organizationId),
      { window: TUESDAY },
    );

    expect(schedules).toHaveLength(1);
    expect(schedules[0]!.cleanerProfileId).toBe(leoclean.cleanerProfileId);
  });

  it("retire une mission acceptée, avec ses tampons de trajet", async () => {
    const fixture = await seedOrganization("leoclean");
    await createBookingWithAssignment(
      fixture,
      paris(13, 12),
      paris(13, 14),
      20,
      15,
    );

    const [schedule] = await loadCleanerSchedules(
      forOrganization(fixture.organizationId),
      { window: TUESDAY },
    );

    expect(schedule!.availability).toHaveLength(2);
    expect(schedule!.stops).toHaveLength(1);
    // 9 h → 11 h 40, puis 14 h 15 → 17 h.
    expect(schedule!.availability[0]!.end).toBe(paris(13, 11, 40).getTime());
    expect(schedule!.availability[1]!.start).toBe(paris(13, 14, 15).getTime());
  });

  it("bloque aussi sur une proposition en attente de réponse", async () => {
    // L'intervenant peut accepter d'une seconde à l'autre : proposer le même
    // créneau à un autre client fabriquerait le conflit qu'on veut éviter.
    const fixture = await seedOrganization("leoclean");
    await createBookingWithAssignment(
      fixture,
      paris(13, 12),
      paris(13, 14),
      0,
      0,
      "PROPOSED",
    );

    const [schedule] = await loadCleanerSchedules(
      forOrganization(fixture.organizationId),
      { window: TUESDAY },
    );
    expect(schedule!.availability).toHaveLength(2);
  });

  it("libère le créneau d'une mission annulée", async () => {
    const fixture = await seedOrganization("leoclean");
    await createBookingWithAssignment(
      fixture,
      paris(13, 12),
      paris(13, 14),
      0,
      0,
      "CANCELLED",
    );

    const [schedule] = await loadCleanerSchedules(
      forOrganization(fixture.organizationId),
      { window: TUESDAY },
    );
    expect(schedule!.availability).toHaveLength(1);
  });
});

describe("accord entre le moteur et la contrainte d'exclusion", () => {
  it("ne propose que des créneaux que la base accepte", async () => {
    // L'invariant central. Le moteur produit ses créneaux, on tente de les
    // écrire tous : la base doit tous les accepter. Un seul refus signifierait
    // qu'un client peut payer une réservation impossible.
    const fixture = await seedOrganization("leoclean");
    await createBookingWithAssignment(
      fixture,
      paris(13, 12),
      paris(13, 14),
      10,
      10,
    );

    const db = forOrganization(fixture.organizationId);
    const schedules = await loadCleanerSchedules(db, { window: TUESDAY });

    const slots = findSlots(schedules, {
      window: TUESDAY,
      durationMinutes: 120,
      destination: { lat: CESTAS.lat, lng: CESTAS.lng },
      now: paris(1, 8),
    });

    expect(slots.length).toBeGreaterThan(0);

    for (const slot of slots) {
      // Chaque créneau est écrit puis retiré : on teste la compatibilité avec
      // l'existant, pas la compatibilité des créneaux entre eux.
      const assignment = await createBookingWithAssignment(
        fixture,
        slot.start,
        slot.end,
        slot.travelMinutesBefore,
        slot.travelMinutesAfter,
      );
      await db.assignment.delete({ where: { id: assignment.id } });
    }
  });

  it("la base refuse bien un créneau que le moteur n'aurait pas proposé", async () => {
    // Contrôle en miroir : sans lui, le test précédent passerait aussi avec
    // une contrainte d'exclusion inactive.
    const fixture = await seedOrganization("leoclean");
    await createBookingWithAssignment(
      fixture,
      paris(13, 12),
      paris(13, 14),
      10,
      10,
    );

    await expect(
      createBookingWithAssignment(fixture, paris(13, 13), paris(13, 15), 0, 0),
    ).rejects.toThrow();
  });
});

describe("recherche de créneaux de bout en bout", () => {
  it("propose des heures rondes tenant compte de la route réelle", async () => {
    const fixture = await seedOrganization("leoclean");
    const db = forOrganization(fixture.organizationId);
    const schedules = await loadCleanerSchedules(db, { window: TUESDAY });

    // Trajet mesuré Léognan ↔ Cestas, injecté tel quel : le moteur doit s'en
    // servir plutôt que de son estimation géométrique.
    const travel = travelMatrixFrom([
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

    const slots = findSlots(schedules, {
      window: TUESDAY,
      durationMinutes: 180,
      destination: { lat: CESTAS.lat, lng: CESTAS.lng },
      now: paris(1, 8),
      travel,
    });

    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      // Les tampons sont arrondis au pas de cinq minutes — 11 devient 15 —
      // mais le coût d'insertion garde la valeur brute : il sert à comparer
      // des attributions, pas à réserver du temps.
      expect(slot.travelMinutesBefore).toBe(15);
      expect(slot.travelMinutesAfter).toBe(15);
      expect(slot.insertionCostMinutes).toBe(22);
      expect(slot.cleanerProfileId).toBe(fixture.cleanerProfileId);
    }

    // 9 h 00 est refusé : le départ de Léognan tomberait à 8 h 45, hors des
    // heures déclarées. Le premier créneau de la grille qui passe est 9 h 30.
    expect(slots[0]!.start.getTime()).toBe(paris(13, 9, 30).getTime());
  });

  it("distingue l'intervenant attitré", async () => {
    const fixture = await seedOrganization("leoclean");
    const schedules = await loadCleanerSchedules(
      forOrganization(fixture.organizationId),
      {
        window: TUESDAY,
        preferredCleanerProfileId: fixture.cleanerProfileId,
      },
    );

    expect(schedules[0]!.isPreferred).toBe(true);
  });
});
