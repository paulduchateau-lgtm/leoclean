import { beforeEach, describe, expect, it } from "vitest";

import { forOrganization, prisma } from "@/lib/db";

/**
 * Garanties portées par la base elle-même.
 *
 * Verrou anti-double-réservation, cohérence des montants, colonne géographique
 * générée : ces règles sont écrites en SQL parce qu'un contrôle applicatif ne
 * résiste pas à deux requêtes concurrentes. Ces tests vérifient qu'elles sont
 * réellement en place — une migration qui les oublierait passerait autrement
 * inaperçue.
 */

let organizationId: string;
let cleanerProfileId: string;
let clientProfileId: string;
let addressId: string;
let serviceId: string;

async function createBooking(start: string, end: string): Promise<string> {
  const db = forOrganization(organizationId);
  const booking = await db.booking.create({
    data: {
      organizationId,
      clientProfileId,
      addressId,
      serviceId,
      status: "CONFIRMED",
      scheduledStart: new Date(start),
      scheduledEnd: new Date(end),
      durationMinutes: 120,
      hourlyRateCents: 2900,
      grossAmountCents: 5800,
      taxCreditAmountCents: 2900,
      netAmountCents: 2900,
      professionalAmountCents: 3600,
      platformFeeAmountCents: 2200,
      commissionRateBp: 3800,
    },
  });
  return booking.id;
}

/** Affecte l'intervenant, avec des tampons de trajet de part et d'autre. */
async function assign(
  bookingId: string,
  start: string,
  end: string,
  travelMinutes = 0,
) {
  const startAt = new Date(start);
  const endAt = new Date(end);
  const buffer = travelMinutes * 60_000;

  return forOrganization(organizationId).assignment.create({
    data: {
      organizationId,
      bookingId,
      cleanerProfileId,
      status: "ACCEPTED",
      startAt,
      endAt,
      blockStartAt: new Date(startAt.getTime() - buffer),
      blockEndAt: new Date(endAt.getTime() + buffer),
      travelMinutesBefore: travelMinutes,
      travelMinutesAfter: travelMinutes,
    },
  });
}

beforeEach(async () => {
  const organization = await prisma.organization.create({
    data: {
      slug: "leoclean",
      name: "Léo Clean",
      type: "MARKETPLACE",
      status: "ACTIVE",
    },
  });
  organizationId = organization.id;
  const db = forOrganization(organizationId);

  const clientUser = await prisma.user.create({
    data: { email: "client@test.fr" },
  });
  const cleanerUser = await prisma.user.create({
    data: { email: "pro@test.fr" },
  });

  clientProfileId = (
    await db.clientProfile.create({
      data: { organizationId, userId: clientUser.id },
    })
  ).id;
  cleanerProfileId = (
    await db.cleanerProfile.create({
      data: {
        organizationId,
        userId: cleanerUser.id,
        displayName: "Sophie",
        status: "ACTIVE",
      },
    })
  ).id;
  addressId = (
    await db.address.create({
      data: {
        organizationId,
        clientProfileId,
        street: "8 avenue de Gradignan",
        postalCode: "33850",
        cityName: "Léognan",
        inseeCode: "33238",
        lat: 44.7236,
        lng: -0.6172,
      },
    })
  ).id;
  serviceId = (
    await db.service.create({
      data: {
        organizationId,
        slug: "menage-regulier",
        name: "Ménage régulier",
        kind: "MENAGE_REGULIER",
      },
    })
  ).id;
});

describe("verrou anti-double-réservation", () => {
  it("refuse deux missions qui se chevauchent pour le même intervenant", async () => {
    const first = await createBooking(
      "2026-09-01T07:00:00Z",
      "2026-09-01T09:00:00Z",
    );
    const second = await createBooking(
      "2026-09-01T08:00:00Z",
      "2026-09-01T10:00:00Z",
    );

    await assign(first, "2026-09-01T07:00:00Z", "2026-09-01T09:00:00Z");

    await expect(
      assign(second, "2026-09-01T08:00:00Z", "2026-09-01T10:00:00Z"),
    ).rejects.toThrow();
  });

  it("accepte deux missions jointives, l'intervalle étant semi-ouvert", async () => {
    const first = await createBooking(
      "2026-09-01T07:00:00Z",
      "2026-09-01T09:00:00Z",
    );
    const second = await createBooking(
      "2026-09-01T09:00:00Z",
      "2026-09-01T11:00:00Z",
    );

    await assign(first, "2026-09-01T07:00:00Z", "2026-09-01T09:00:00Z");
    await expect(
      assign(second, "2026-09-01T09:00:00Z", "2026-09-01T11:00:00Z"),
    ).resolves.toBeDefined();
  });

  it("refuse deux missions jointives dès qu'il faut du temps de route entre les deux", async () => {
    // Deux ménages qui s'enchaînent à la minute près sont acceptables à
    // Léognan même ; entre Léognan et Saucats, il faut compter le trajet. Le
    // tampon fait partie du créneau bloqué, donc la base refuse.
    const first = await createBooking(
      "2026-09-01T07:00:00Z",
      "2026-09-01T09:00:00Z",
    );
    const second = await createBooking(
      "2026-09-01T09:00:00Z",
      "2026-09-01T11:00:00Z",
    );

    await assign(first, "2026-09-01T07:00:00Z", "2026-09-01T09:00:00Z", 15);

    await expect(
      assign(second, "2026-09-01T09:00:00Z", "2026-09-01T11:00:00Z", 15),
    ).rejects.toThrow();
  });

  it("libère le créneau lorsque l'affectation est refusée", async () => {
    const first = await createBooking(
      "2026-09-01T07:00:00Z",
      "2026-09-01T09:00:00Z",
    );
    const second = await createBooking(
      "2026-09-01T07:30:00Z",
      "2026-09-01T09:30:00Z",
    );

    const proposed = await assign(
      first,
      "2026-09-01T07:00:00Z",
      "2026-09-01T09:00:00Z",
    );
    await forOrganization(organizationId).assignment.update({
      where: { id: proposed.id },
      data: { status: "DECLINED" },
    });

    // Une affectation refusée ne doit pas geler le créneau : la réattribution
    // en dépend.
    await expect(
      assign(second, "2026-09-01T07:30:00Z", "2026-09-01T09:30:00Z"),
    ).resolves.toBeDefined();
  });

  it("n'empêche pas deux intervenants différents de travailler en parallèle", async () => {
    const first = await createBooking(
      "2026-09-01T07:00:00Z",
      "2026-09-01T09:00:00Z",
    );
    const second = await createBooking(
      "2026-09-01T07:00:00Z",
      "2026-09-01T09:00:00Z",
    );
    const db = forOrganization(organizationId);

    const otherUser = await prisma.user.create({
      data: { email: "pro2@test.fr" },
    });
    const other = await db.cleanerProfile.create({
      data: {
        organizationId,
        userId: otherUser.id,
        displayName: "Karim",
        status: "ACTIVE",
      },
    });

    await assign(first, "2026-09-01T07:00:00Z", "2026-09-01T09:00:00Z");
    await expect(
      db.assignment.create({
        data: {
          organizationId,
          bookingId: second,
          cleanerProfileId: other.id,
          status: "ACCEPTED",
          startAt: new Date("2026-09-01T07:00:00Z"),
          endAt: new Date("2026-09-01T09:00:00Z"),
          blockStartAt: new Date("2026-09-01T07:00:00Z"),
          blockEndAt: new Date("2026-09-01T09:00:00Z"),
        },
      }),
    ).resolves.toBeDefined();
  });

  it("n'accepte qu'un seul intervenant par réservation", async () => {
    const booking = await createBooking(
      "2026-09-01T07:00:00Z",
      "2026-09-01T09:00:00Z",
    );
    const db = forOrganization(organizationId);

    const otherUser = await prisma.user.create({
      data: { email: "pro3@test.fr" },
    });
    const other = await db.cleanerProfile.create({
      data: {
        organizationId,
        userId: otherUser.id,
        displayName: "Nadia",
        status: "ACTIVE",
      },
    });

    await assign(booking, "2026-09-01T07:00:00Z", "2026-09-01T09:00:00Z");

    await expect(
      db.assignment.create({
        data: {
          organizationId,
          bookingId: booking,
          cleanerProfileId: other.id,
          status: "ACCEPTED",
          startAt: new Date("2026-09-01T12:00:00Z"),
          endAt: new Date("2026-09-01T14:00:00Z"),
          blockStartAt: new Date("2026-09-01T12:00:00Z"),
          blockEndAt: new Date("2026-09-01T14:00:00Z"),
        },
      }),
    ).rejects.toThrow();
  });
});

describe("cohérence des montants", () => {
  it("refuse un reste à charge qui ne découle pas du brut et du crédit d'impôt", async () => {
    await expect(
      forOrganization(organizationId).booking.create({
        data: {
          organizationId,
          clientProfileId,
          addressId,
          serviceId,
          scheduledStart: new Date("2026-09-02T07:00:00Z"),
          scheduledEnd: new Date("2026-09-02T09:00:00Z"),
          durationMinutes: 120,
          hourlyRateCents: 2900,
          grossAmountCents: 5800,
          taxCreditAmountCents: 2900,
          // Incohérent : devrait valoir 2900.
          netAmountCents: 5800,
          professionalAmountCents: 3600,
          platformFeeAmountCents: 2200,
          commissionRateBp: 3800,
        },
      }),
    ).rejects.toThrow();
  });

  it("refuse un total client qui ne recompose pas les deux factures", async () => {
    // Le client voit un prix ; il reçoit deux factures. Leur somme doit être
    // exactement ce prix, sans quoi l'écart devient un litige — et un rejet de
    // l'avance immédiate côté URSSAF.
    await expect(
      forOrganization(organizationId).booking.create({
        data: {
          organizationId,
          clientProfileId,
          addressId,
          serviceId,
          scheduledStart: new Date("2026-09-02T07:00:00Z"),
          scheduledEnd: new Date("2026-09-02T09:00:00Z"),
          durationMinutes: 120,
          hourlyRateCents: 2900,
          grossAmountCents: 5800,
          taxCreditAmountCents: 2900,
          netAmountCents: 2900,
          // 3600 + 2000 = 5600, et non 5800.
          professionalAmountCents: 3600,
          platformFeeAmountCents: 2000,
          commissionRateBp: 3800,
        },
      }),
    ).rejects.toThrow();
  });

  it("refuse une rémunération d'intervenant négative", async () => {
    await expect(
      forOrganization(organizationId).booking.create({
        data: {
          organizationId,
          clientProfileId,
          addressId,
          serviceId,
          scheduledStart: new Date("2026-09-03T07:00:00Z"),
          scheduledEnd: new Date("2026-09-03T09:00:00Z"),
          durationMinutes: 120,
          hourlyRateCents: 2900,
          grossAmountCents: 5800,
          taxCreditAmountCents: 2900,
          netAmountCents: 2900,
          professionalAmountCents: -200,
          platformFeeAmountCents: 6000,
          commissionRateBp: 10345,
        },
      }),
    ).rejects.toThrow();
  });

  it("refuse une réservation dont la fin précède le début", async () => {
    await expect(
      createBooking("2026-09-02T10:00:00Z", "2026-09-02T08:00:00Z"),
    ).rejects.toThrow();
  });
});

describe("géographie", () => {
  it("dérive automatiquement la géométrie de la latitude et de la longitude", async () => {
    const rows = await prisma.$queryRaw<{ lat: number; lng: number }[]>`
      SELECT ST_Y("geog"::geometry) AS lat, ST_X("geog"::geometry) AS lng
      FROM "Address" WHERE "id" = ${addressId}
    `;

    expect(rows[0]?.lat).toBeCloseTo(44.7236, 4);
    expect(rows[0]?.lng).toBeCloseTo(-0.6172, 4);
  });

  it("permet une recherche de proximité sur l'index géographique", async () => {
    // Depuis le centre de Léognan, l'adresse de test est à moins de 3 km.
    const rows = await prisma.$queryRaw<{ id: string; meters: number }[]>`
      SELECT "id", ST_Distance("geog", ST_MakePoint(-0.6172, 44.7236)::geography) AS meters
      FROM "Address"
      WHERE ST_DWithin("geog", ST_MakePoint(-0.6172, 44.7236)::geography, 3000)
    `;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(addressId);
  });
});
