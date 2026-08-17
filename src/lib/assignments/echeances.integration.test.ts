import { describe, expect, it } from "vitest";

import { traiterLesEcheances } from "@/lib/assignments/echeances";
import { forOrganization, prisma } from "@/lib/db";
import { getCommuneBySlug } from "@/lib/territory";
import { parisWallClockToUtc } from "@/lib/time";

/**
 * Ce qui arrive à une demande quand personne ne fait rien.
 *
 * C'est le seul endroit où les quatre minuteries se vérifient en conditions
 * réelles : la règle est testée à la milliseconde dans `diffusion.test.ts`,
 * mais rien ne garantissait jusqu'ici qu'elle soit *appliquée*. Une demande
 * dont le lot expire en silence est le défaut le plus coûteux du produit —
 * tout paraît normal jusqu'au jour du ménage.
 */

const LEOGNAN = getCommuneBySlug("leognan")!;
const CESTAS = getCommuneBySlug("cestas")!;

const paris = (day: number, hour: number, minute = 0) =>
  parisWallClockToUtc({ year: 2026, month: 1, day, hour, minute });

const JOUR = 86_400_000;
const HEURE = 3_600_000;

interface Fixture {
  organizationId: string;
  clientProfileId: string;
  addressId: string;
  serviceId: string;
  cleanerProfileIds: string[];
}

async function seed(cleaners = 2): Promise<Fixture> {
  const organization = await prisma.organization.create({
    data: {
      slug: "leoclean",
      name: "Léo Clean",
      type: "MARKETPLACE",
      status: "ACTIVE",
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
      data: { email: `pro${index}@echeances.test` },
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

  const clientUser = await prisma.user.create({
    data: { email: "client@echeances.test" },
  });
  const clientProfile = await db.clientProfile.create({
    data: { organizationId: organization.id, userId: clientUser.id },
  });
  const address = await db.address.create({
    data: {
      organizationId: organization.id,
      clientProfileId: clientProfile.id,
      street: "1 rue de Gazinet",
      postalCode: CESTAS.postalCode,
      cityName: CESTAS.name,
      inseeCode: CESTAS.insee,
      lat: CESTAS.lat,
      lng: CESTAS.lng,
    },
  });

  return {
    organizationId: organization.id,
    clientProfileId: clientProfile.id,
    addressId: address.id,
    serviceId: service.id,
    cleanerProfileIds,
  };
}

/** Une demande en recherche, dont on choisit l'âge et l'échéance. */
async function demandeEnRecherche(
  fixture: Fixture,
  options: {
    creeeA: Date;
    echeance: Date;
    lot?: number;
    proposeA?: string[];
  },
) {
  const db = forOrganization(fixture.organizationId);
  const start = paris(13, 10);
  const end = paris(13, 13);

  const booking = await db.booking.create({
    data: {
      organizationId: fixture.organizationId,
      clientProfileId: fixture.clientProfileId,
      addressId: fixture.addressId,
      serviceId: fixture.serviceId,
      status: "PENDING_ASSIGNMENT",
      scheduledStart: start,
      scheduledEnd: end,
      durationMinutes: 180,
      surfaceSqm: 75,
      hourlyRateCents: 2900,
      grossAmountCents: 8700,
      taxCreditAmountCents: 4350,
      netAmountCents: 4350,
      professionalAmountCents: 5400,
      platformFeeAmountCents: 3300,
      commissionRateBp: 3800,
      diffusionLot: options.lot ?? 1,
      diffusionLotSentAt: options.creeeA,
      diffusionDeadlineAt: options.echeance,
    },
  });

  // `createdAt` est posé par la base : on le ramène à l'âge voulu, faute de
  // quoi toutes les demandes auraient une seconde d'existence.
  await prisma.$executeRaw`UPDATE "Booking" SET "createdAt" = ${options.creeeA} WHERE id = ${booking.id}`;

  for (const cleanerProfileId of options.proposeA ?? []) {
    await db.assignment.create({
      data: {
        organizationId: fixture.organizationId,
        bookingId: booking.id,
        cleanerProfileId,
        status: "PROPOSED",
        lot: options.lot ?? 1,
        startAt: start,
        endAt: end,
        blockStartAt: start,
        blockEndAt: end,
        proposedAt: options.creeeA,
        respondBy: options.echeance,
      },
    });
  }

  return booking.id;
}

describe("échéances de diffusion", () => {
  it("élargit au secteur quand le premier lot n'a rien donné", async () => {
    const fixture = await seed(2);
    const creeeA = paris(12, 9);
    const maintenant = new Date(creeeA.getTime() + 25 * HEURE);

    // Seule la première a été sollicitée : la seconde doit l'être maintenant.
    const bookingId = await demandeEnRecherche(fixture, {
      creeeA,
      echeance: new Date(creeeA.getTime() + 24 * HEURE),
      proposeA: [fixture.cleanerProfileIds[0]!],
    });

    const rapport = await traiterLesEcheances(maintenant);
    expect(rapport.lotsElargis).toBe(1);

    const db = forOrganization(fixture.organizationId);
    const booking = await db.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { assignments: true },
    });

    expect(booking.diffusionLot).toBe(2);
    expect(booking.status).toBe("PENDING_ASSIGNMENT");

    const secondLot = booking.assignments.filter((a) => a.lot === 2);
    expect(secondLot).toHaveLength(1);
    expect(secondLot[0]!.cleanerProfileId).toBe(fixture.cleanerProfileIds[1]);
    expect(secondLot[0]!.status).toBe("PROPOSED");

    // La proposition du premier lot est périmée, pas laissée ouverte : sinon
    // deux personnes répondraient à des lots différents de la même mission.
    const premierLot = booking.assignments.filter((a) => a.lot === 1);
    expect(premierLot[0]!.status).toBe("EXPIRED");
  });

  it("rend la main au client plutôt que d'élargir, s'il a des alternatives", async () => {
    const fixture = await seed(2);
    const creeeA = paris(12, 9);
    const maintenant = new Date(creeeA.getTime() + 25 * HEURE);

    const bookingId = await demandeEnRecherche(fixture, {
      creeeA,
      echeance: new Date(creeeA.getTime() + 24 * HEURE),
      proposeA: [fixture.cleanerProfileIds[0]!],
    });

    const db = forOrganization(fixture.organizationId);
    await db.slotProposal.create({
      data: {
        organizationId: fixture.organizationId,
        bookingId,
        cleanerProfileId: fixture.cleanerProfileIds[0]!,
        status: "PENDING",
        proposedStart: paris(13, 14),
        proposedEnd: paris(13, 17),
        respondBy: new Date(creeeA.getTime() + 14 * JOUR),
      },
    });

    const rapport = await traiterLesEcheances(maintenant);
    expect(rapport.alternativesSoumises).toBe(1);
    expect(rapport.lotsElargis).toBe(0);

    const booking = await db.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { assignments: true },
    });

    // Aucun élargissement, et plus d'échéance : rien n'est dû tant que le
    // client n'a pas tranché.
    expect(booking.diffusionLot).toBe(1);
    expect(booking.diffusionDeadlineAt).toBeNull();
    expect(booking.assignments.filter((a) => a.lot === 2)).toHaveLength(0);
  });

  it("cesse de chercher au bout d'une semaine, sans clore la demande", async () => {
    const fixture = await seed(2);
    const creeeA = paris(5, 9);
    const maintenant = new Date(creeeA.getTime() + 8 * JOUR);

    const bookingId = await demandeEnRecherche(fixture, {
      creeeA,
      echeance: new Date(creeeA.getTime() + 7 * JOUR),
      lot: 2,
      proposeA: [fixture.cleanerProfileIds[0]!],
    });

    const db = forOrganization(fixture.organizationId);
    const contreProposition = await db.slotProposal.create({
      data: {
        organizationId: fixture.organizationId,
        bookingId,
        cleanerProfileId: fixture.cleanerProfileIds[0]!,
        status: "PENDING",
        proposedStart: paris(20, 14),
        proposedEnd: paris(20, 17),
        // Émise la veille : encore valable une semaine.
        respondBy: new Date(maintenant.getTime() + 6 * JOUR),
      },
    });

    const rapport = await traiterLesEcheances(maintenant);
    expect(rapport.recherchesAbandonnees).toBe(1);

    const booking = await db.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { assignments: true },
    });

    // La demande reste listée par le back-office : quelqu'un doit appeler ce
    // client. Cesser de chercher n'est pas clore.
    expect(booking.status).toBe("PENDING_ASSIGNMENT");
    expect(booking.diffusionDeadlineAt).toBeNull();
    expect(booking.assignments.every((a) => a.status === "EXPIRED")).toBe(true);

    // Et l'alternative survit à l'arrêt de la recherche.
    const apres = await db.slotProposal.findUniqueOrThrow({
      where: { id: contreProposition.id },
    });
    expect(apres.status).toBe("PENDING");
  });

  it("périme les réponses que personne n'a données", async () => {
    const fixture = await seed(1);
    const creeeA = paris(12, 9);
    const maintenant = new Date(creeeA.getTime() + 25 * HEURE);

    const bookingId = await demandeEnRecherche(fixture, {
      creeeA,
      echeance: new Date(creeeA.getTime() + 24 * HEURE),
      proposeA: [fixture.cleanerProfileIds[0]!],
    });

    const db = forOrganization(fixture.organizationId);
    const contreProposition = await db.slotProposal.create({
      data: {
        organizationId: fixture.organizationId,
        bookingId,
        cleanerProfileId: fixture.cleanerProfileIds[0]!,
        status: "PENDING",
        proposedStart: paris(13, 14),
        proposedEnd: paris(13, 17),
        respondBy: new Date(creeeA.getTime() + 2 * HEURE),
      },
    });

    const rapport = await traiterLesEcheances(maintenant);

    expect(rapport.propositionsPerimees).toBe(1);
    expect(rapport.contrePropositionsPerimees).toBe(1);

    const apres = await db.slotProposal.findUniqueOrThrow({
      where: { id: contreProposition.id },
    });
    expect(apres.status).toBe("EXPIRED");
    expect(apres.respondedAt).toEqual(maintenant);
  });

  it("ne touche pas à une demande dont l'échéance court encore", async () => {
    const fixture = await seed(2);
    const creeeA = paris(12, 9);

    const bookingId = await demandeEnRecherche(fixture, {
      creeeA,
      echeance: new Date(creeeA.getTime() + 24 * HEURE),
      proposeA: [fixture.cleanerProfileIds[0]!],
    });

    const rapport = await traiterLesEcheances(
      new Date(creeeA.getTime() + 23 * HEURE),
    );

    expect(rapport).toMatchObject({
      lotsElargis: 0,
      alternativesSoumises: 0,
      recherchesAbandonnees: 0,
      propositionsPerimees: 0,
      echecs: 0,
    });

    const booking = await forOrganization(
      fixture.organizationId,
    ).booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking.diffusionLot).toBe(1);
  });
});
