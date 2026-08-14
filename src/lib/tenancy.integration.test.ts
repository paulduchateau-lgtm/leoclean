import { beforeEach, describe, expect, it } from "vitest";

import {
  GLOBAL_MODELS,
  TENANT_MODELS,
  forOrganization,
  prisma,
} from "@/lib/db";

/**
 * Cloisonnement multi-tenant.
 *
 * Ces tests sont la contrepartie exécutable de la promesse faite au schéma :
 * une organisation ne voit pas les données d'une autre, et ce n'est pas la
 * discipline de l'appelant qui le garantit mais le data layer.
 *
 * Le scénario monte deux organisations réellement concurrentes — Léo Clean et
 * une société de ménage locale — chacune avec son client, son adresse, son
 * intervenant et ses réservations.
 */

interface Fixture {
  organizationId: string;
  clientProfileId: string;
  addressId: string;
  cleanerProfileId: string;
  serviceId: string;
  bookingId: string;
}

async function createOrganization(
  slug: string,
  name: string,
  commune: {
    insee: string;
    postalCode: string;
    city: string;
    lat: number;
    lng: number;
  },
): Promise<Fixture> {
  const organization = await prisma.organization.create({
    data: { slug, name, type: "COMPANY", status: "ACTIVE" },
  });
  const db = forOrganization(organization.id);

  const clientUser = await prisma.user.create({
    data: { email: `client@${slug}.test` },
  });
  const cleanerUser = await prisma.user.create({
    data: { email: `pro@${slug}.test` },
  });

  // `organizationId` reste exigé par les types de Prisma à la création — une
  // extension ne peut pas modifier les types d'entrée. La valeur écrite ici
  // n'a toutefois aucune importance : l'extension l'écrase, ce que prouve le
  // test « écrase une organisation étrangère ». Sur les lectures et les
  // écritures ciblées, rien n'est à préciser.
  const clientProfile = await db.clientProfile.create({
    data: { organizationId: organization.id, userId: clientUser.id },
  });

  const address = await db.address.create({
    data: {
      organizationId: organization.id,
      clientProfileId: clientProfile.id,
      street: "12 rue des Vignes",
      postalCode: commune.postalCode,
      cityName: commune.city,
      inseeCode: commune.insee,
      lat: commune.lat,
      lng: commune.lng,
    },
  });

  const cleanerProfile = await db.cleanerProfile.create({
    data: {
      organizationId: organization.id,
      userId: cleanerUser.id,
      displayName: "Intervenant",
      status: "ACTIVE",
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

  const booking = await db.booking.create({
    data: {
      organizationId: organization.id,
      clientProfileId: clientProfile.id,
      addressId: address.id,
      serviceId: service.id,
      status: "CONFIRMED",
      scheduledStart: new Date("2026-09-01T07:00:00Z"),
      scheduledEnd: new Date("2026-09-01T10:00:00Z"),
      durationMinutes: 180,
      hourlyRateCents: 2900,
      grossAmountCents: 8700,
      taxCreditAmountCents: 4350,
      netAmountCents: 4350,
      professionalAmountCents: 5400,
      platformFeeAmountCents: 3300,
      commissionRateBp: 3800,
    },
  });

  return {
    organizationId: organization.id,
    clientProfileId: clientProfile.id,
    addressId: address.id,
    cleanerProfileId: cleanerProfile.id,
    serviceId: service.id,
    bookingId: booking.id,
  };
}

let leoclean: Fixture;
let concurrent: Fixture;

beforeEach(async () => {
  leoclean = await createOrganization("leoclean", "Léo Clean", {
    insee: "33238",
    postalCode: "33850",
    city: "Léognan",
    lat: 44.7236,
    lng: -0.6172,
  });
  concurrent = await createOrganization("net-des-graves", "Net des Graves", {
    insee: "33213",
    postalCode: "33650",
    city: "La Brède",
    lat: 44.6777,
    lng: -0.5396,
  });
});

describe("périmètre du cloisonnement", () => {
  it("cloisonne tout modèle métier, et justifie chaque exception", () => {
    // Un modèle sans `organizationId` doit figurer dans GLOBAL_MODELS avec sa
    // raison. C'est ce qui empêche d'introduire une fuite par simple oubli
    // lors de l'ajout d'une table.
    const unaccounted = Object.keys(GLOBAL_MODELS).filter((name) =>
      TENANT_MODELS.has(name),
    );
    expect(unaccounted).toEqual([]);

    for (const model of [
      "Booking",
      "Address",
      "Assignment",
      "Review",
      "Lead",
    ]) {
      expect(TENANT_MODELS.has(model)).toBe(true);
    }
  });
});

describe("lecture", () => {
  it("ne renvoie que les réservations de l'organisation courante", async () => {
    const found = await forOrganization(
      leoclean.organizationId,
    ).booking.findMany();

    expect(found).toHaveLength(1);
    expect(found[0]?.id).toBe(leoclean.bookingId);
  });

  it("renvoie null sur findUnique visant une autre organisation", async () => {
    // Le comportement attendu est l'absence, pas une erreur : lever
    // révélerait l'existence de la ressource visée.
    const found = await forOrganization(
      leoclean.organizationId,
    ).booking.findUnique({ where: { id: concurrent.bookingId } });

    expect(found).toBeNull();
  });

  it("ne compte pas les réservations d'une autre organisation", async () => {
    const total = await forOrganization(
      leoclean.organizationId,
    ).booking.count();

    expect(total).toBe(1);
  });

  it("cloisonne aussi les agrégats", async () => {
    const aggregate = await forOrganization(
      leoclean.organizationId,
    ).booking.aggregate({ _sum: { grossAmountCents: true } });

    expect(aggregate._sum.grossAmountCents).toBe(8700);
  });

  it("cloisonne les adresses, qui portent des données d'accès sensibles", async () => {
    const addresses = await forOrganization(
      leoclean.organizationId,
    ).address.findMany();

    expect(addresses).toHaveLength(1);
    expect(addresses[0]?.cityName).toBe("Léognan");
  });
});

describe("écriture", () => {
  it("refuse de modifier la réservation d'une autre organisation", async () => {
    await expect(
      forOrganization(leoclean.organizationId).booking.update({
        where: { id: concurrent.bookingId },
        data: { status: "CANCELLED_BY_CLIENT" },
      }),
    ).rejects.toThrow();

    const untouched = await prisma.booking.findUniqueOrThrow({
      where: { id: concurrent.bookingId },
    });
    expect(untouched.status).toBe("CONFIRMED");
  });

  it("refuse de supprimer la réservation d'une autre organisation", async () => {
    await expect(
      forOrganization(leoclean.organizationId).booking.delete({
        where: { id: concurrent.bookingId },
      }),
    ).rejects.toThrow();

    expect(
      await prisma.booking.count({ where: { id: concurrent.bookingId } }),
    ).toBe(1);
  });

  it("n'emporte pas les lignes voisines sur une suppression de masse", async () => {
    await forOrganization(leoclean.organizationId).booking.deleteMany({});

    expect(await prisma.booking.count()).toBe(1);
    expect(
      await prisma.booking.count({ where: { id: concurrent.bookingId } }),
    ).toBe(1);
  });

  it("n'emporte pas les lignes voisines sur une mise à jour de masse", async () => {
    await forOrganization(leoclean.organizationId).booking.updateMany({
      data: { internalNotes: "revue interne" },
    });

    const other = await prisma.booking.findUniqueOrThrow({
      where: { id: concurrent.bookingId },
    });
    expect(other.internalNotes).toBeNull();
  });

  it("écrase une organisation étrangère fournie à la création", async () => {
    // C'est la garantie qui compte : même si l'appelant écrit l'identifiant
    // d'une autre organisation — par erreur ou par malveillance — la donnée
    // atterrit dans la sienne.
    const lead = await forOrganization(leoclean.organizationId).lead.create({
      data: {
        organizationId: concurrent.organizationId,
        name: "Claire",
        phone: "0500000000",
        communeInsee: "33238",
      },
    });

    expect(lead.organizationId).toBe(leoclean.organizationId);
    expect(
      await prisma.lead.count({
        where: { organizationId: concurrent.organizationId },
      }),
    ).toBe(0);
  });

  it("renseigne l'organisation sur une création multiple", async () => {
    await forOrganization(leoclean.organizationId).lead.createMany({
      data: [
        {
          organizationId: concurrent.organizationId,
          name: "Claire",
          phone: "0500000001",
        },
        {
          organizationId: concurrent.organizationId,
          name: "Damien",
          phone: "0500000002",
        },
      ],
    });

    const leads = await prisma.lead.findMany({
      where: { organizationId: leoclean.organizationId },
    });
    expect(leads).toHaveLength(2);
  });
});

describe("garde-fous du client cloisonné", () => {
  it("refuse un identifiant d'organisation vide", () => {
    expect(() => forOrganization("")).toThrow(
      /sans identifiant d'organisation/,
    );
  });

  it("laisse passer les modèles globaux", async () => {
    // User n'est pas cloisonné : une même personne peut être cliente ici et
    // intervenante ailleurs.
    const users = await forOrganization(
      leoclean.organizationId,
    ).user.findMany();

    expect(users.length).toBeGreaterThanOrEqual(4);
  });
});
