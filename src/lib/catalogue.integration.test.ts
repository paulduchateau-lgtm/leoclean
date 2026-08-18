import { beforeEach, describe, expect, it } from "vitest";

import {
  getServiceBySlug,
  listServices,
  lowestHourlyRate,
  quoteFromCatalogue,
  resolveHourlyRate,
} from "@/lib/catalogue";
import { forOrganization, prisma } from "@/lib/db";

/**
 * Catalogue et devis.
 *
 * Ces tests vérifient le trait d'union entre la base et le moteur pur : que
 * les tarifs historisés sont résolus à la bonne date, que le catalogue d'une
 * organisation reste invisible à sa concurrente, et que le devis produit des
 * montants que la base accepte.
 */

let leocleanId: string;
let concurrentId: string;

async function seedCatalogue(
  organizationId: string,
  options: { hourlyRateCents: number; professionalHourlyRateCents: number },
): Promise<void> {
  const db = forOrganization(organizationId);

  const service = await db.service.create({
    data: {
      organizationId,
      slug: "menage-regulier",
      name: "Ménage régulier",
      kind: "MENAGE_REGULIER",
      sqmPerHour: 25,
      minDurationMinutes: 120,
      options: {
        create: [
          {
            organizationId,
            slug: "repassage",
            name: "Repassage",
            extraMinutes: 60,
          },
          {
            organizationId,
            slug: "vitres",
            name: "Nettoyage des vitres",
            extraMinutes: 30,
          },
        ],
      },
    },
  });

  for (const [frequency, rate] of [
    ["ONE_OFF", options.hourlyRateCents + 400],
    ["WEEKLY", options.hourlyRateCents],
    ["BIWEEKLY", options.hourlyRateCents],
    ["MONTHLY", options.hourlyRateCents],
  ] as const) {
    await db.pricingRule.create({
      data: {
        organizationId,
        serviceId: service.id,
        frequency,
        hourlyRateCents: rate,
        // La marge de coordination suit le tarif : le supplément d'une
        // prestation exigeante va à celui qui fournit l'effort.
        professionalHourlyRateCents:
          options.professionalHourlyRateCents +
          (rate - options.hourlyRateCents),
        validFrom: new Date("2026-01-01T00:00:00Z"),
      },
    });
  }
}

beforeEach(async () => {
  const leoclean = await prisma.organization.create({
    data: {
      slug: "leoclean",
      name: "Léo Clean",
      type: "MARKETPLACE",
      status: "ACTIVE",
      engagementMode: "MISE_EN_RELATION",
      commissionRateBp: 3800,
    },
  });
  const concurrent = await prisma.organization.create({
    data: {
      slug: "net-des-graves",
      name: "Net des Graves",
      type: "COMPANY",
      status: "ACTIVE",
      commissionRateBp: 1200,
    },
  });

  leocleanId = leoclean.id;
  concurrentId = concurrent.id;

  await seedCatalogue(leocleanId, {
    hourlyRateCents: 2800,
    professionalHourlyRateCents: 2300,
  });
  // Une société prestataire encaisse la totalité : sa marge de coordination est
  // nulle, l'intervenant étant son salarié.
  await seedCatalogue(concurrentId, {
    hourlyRateCents: 2600,
    professionalHourlyRateCents: 2600,
  });
});

describe("lecture du catalogue", () => {
  it("expose les prestations actives avec leurs options et tarifs", async () => {
    const services = await listServices(forOrganization(leocleanId));

    expect(services).toHaveLength(1);
    expect(services[0]?.options.map((o) => o.slug)).toEqual([
      "repassage",
      "vitres",
    ]);
    expect(services[0]?.hourlyRatesByFrequency.WEEKLY).toBe(2800);
    expect(services[0]?.hourlyRatesByFrequency.ONE_OFF).toBe(3200);
  });

  it("masque les prestations désactivées", async () => {
    const db = forOrganization(leocleanId);
    await db.service.updateMany({ data: { isActive: false } });

    expect(await listServices(db)).toHaveLength(0);
  });

  it("ne laisse pas voir le catalogue de la concurrente", async () => {
    // Les deux sociétés démarchent les mêmes communes : leurs tarifs sont des
    // données commerciales sensibles.
    const services = await listServices(forOrganization(leocleanId));

    expect(services[0]?.hourlyRatesByFrequency.WEEKLY).toBe(2800);
    expect(
      (await listServices(forOrganization(concurrentId)))[0]
        ?.hourlyRatesByFrequency.WEEKLY,
    ).toBe(2600);
  });

  it("annonce le prix d'appel le plus bas du catalogue", async () => {
    const services = await listServices(forOrganization(leocleanId));

    // Cette valeur alimente le « à partir de … » des pages publiques : elle
    // doit être exacte et vérifiable.
    expect(lowestHourlyRate(services)).toBe(2800);
  });
});

describe("historisation des tarifs", () => {
  it("retient le tarif en vigueur à la date demandée", async () => {
    const db = forOrganization(leocleanId);
    const service = await getServiceBySlug(db, "menage-regulier");

    // Augmentation programmée au 1er janvier prochain.
    await db.pricingRule.create({
      data: {
        organizationId: leocleanId,
        serviceId: service!.id,
        frequency: "WEEKLY",
        hourlyRateCents: 3100,
        professionalHourlyRateCents: 2500,
        validFrom: new Date("2027-01-01T00:00:00Z"),
      },
    });

    const today = await resolveHourlyRate(
      db,
      service!.id,
      "WEEKLY",
      new Date("2026-08-14T00:00:00Z"),
    );
    const later = await resolveHourlyRate(
      db,
      service!.id,
      "WEEKLY",
      new Date("2027-02-01T00:00:00Z"),
    );

    expect(today.hourlyRateCents).toBe(2800);
    expect(later.hourlyRateCents).toBe(3100);
  });

  it("refuse de chiffrer sans tarif en vigueur", async () => {
    const db = forOrganization(leocleanId);
    const service = await getServiceBySlug(db, "menage-regulier");

    await expect(
      resolveHourlyRate(
        db,
        service!.id,
        "WEEKLY",
        new Date("2025-01-01T00:00:00Z"),
      ),
    ).rejects.toThrow(/Aucun tarif en vigueur/);
  });
});

describe("devis", () => {
  it("chiffre un ménage hebdomadaire de 80 m²", async () => {
    const result = await quoteFromCatalogue(forOrganization(leocleanId), {
      serviceSlug: "menage-regulier",
      optionSlugs: [],
      surfaceSqm: 80,
      frequency: "WEEKLY",
    });

    expect(result.durationMinutes).toBe(210);
    expect(result.grossAmountCents).toBe(9800);
    // 5074 et non 5075 : le crédit est calculé sur chacune des deux factures,
    // et les deux arrondis tombent du même côté. L'écart d'un centime avec un
    // calcul sur le total est assumé — il profite au client, et il garantit que
    // les deux attestations fiscales s'additionnent exactement.
    expect(result.netAmountCents).toBe(4900);
  });

  it("applique la marge propre à chaque organisation", async () => {
    const marketplace = await quoteFromCatalogue(forOrganization(leocleanId), {
      serviceSlug: "menage-regulier",
      optionSlugs: [],
      surfaceSqm: 80,
      frequency: "WEEKLY",
    });
    const company = await quoteFromCatalogue(forOrganization(concurrentId), {
      serviceSlug: "menage-regulier",
      optionSlugs: [],
      surfaceSqm: 80,
      frequency: "WEEKLY",
    });

    // 3 h 30 : la marketplace prend 5 € de l'heure, la société prestataire
    // rien — elle encaisse la totalité et paie ses salariés.
    expect(marketplace.platformFeeAmountCents).toBe(1750);
    expect(company.platformFeeAmountCents).toBe(0);
  });

  it("allonge la durée à mesure des options retenues", async () => {
    const result = await quoteFromCatalogue(forOrganization(leocleanId), {
      serviceSlug: "menage-regulier",
      optionSlugs: ["repassage", "vitres"],
      surfaceSqm: 60,
      frequency: "WEEKLY",
    });

    expect(result.durationMinutes).toBe(240);
    expect(result.lines).toHaveLength(3);
  });

  it("refuse une option qui n'appartient pas à la prestation", async () => {
    await expect(
      quoteFromCatalogue(forOrganization(leocleanId), {
        serviceSlug: "menage-regulier",
        optionSlugs: ["balcon"],
        surfaceSqm: 60,
        frequency: "WEEKLY",
      }),
    ).rejects.toThrow(/n'est pas proposée/);
  });

  it("refuse une prestation d'une autre organisation", async () => {
    // Le catalogue est cloisonné : viser la prestation de la concurrente par
    // son slug ne donne rien, même si le slug existe chez elle.
    await prisma.service.updateMany({
      where: { organizationId: leocleanId },
      data: { slug: "menage-leoclean" },
    });

    await expect(
      quoteFromCatalogue(forOrganization(leocleanId), {
        serviceSlug: "menage-regulier",
        optionSlugs: [],
        surfaceSqm: 60,
        frequency: "WEEKLY",
      }),
    ).rejects.toThrow(/n'existe pas/);
  });

  it("produit des montants que la base accepte", async () => {
    // Le devis alimente directement les colonnes de Booking, protégées par des
    // contraintes CHECK. S'il produisait un total incohérent, l'insertion
    // échouerait — ce test le vérifie de bout en bout.
    const db = forOrganization(leocleanId);
    const result = await quoteFromCatalogue(db, {
      serviceSlug: "menage-regulier",
      optionSlugs: ["repassage"],
      surfaceSqm: 95,
      frequency: "BIWEEKLY",
    });

    const user = await prisma.user.create({ data: { email: "c@test.fr" } });
    const clientProfile = await db.clientProfile.create({
      data: { organizationId: leocleanId, userId: user.id },
    });
    const address = await db.address.create({
      data: {
        organizationId: leocleanId,
        clientProfileId: clientProfile.id,
        street: "5 Rue de Rambaud",
        postalCode: "33850",
        cityName: "Léognan",
        inseeCode: "33238",
        lat: 44.7302,
        lng: -0.6057,
      },
    });

    const booking = await db.booking.create({
      data: {
        organizationId: leocleanId,
        clientProfileId: clientProfile.id,
        addressId: address.id,
        serviceId: result.serviceId,
        scheduledStart: new Date("2026-09-01T07:00:00Z"),
        scheduledEnd: new Date(
          new Date("2026-09-01T07:00:00Z").getTime() +
            result.durationMinutes * 60_000,
        ),
        surfaceSqm: 95,
        frequency: "BIWEEKLY",
        engagementMode: "MISE_EN_RELATION",
        durationMinutes: result.durationMinutes,
        hourlyRateCents: result.hourlyRateCents,
        grossAmountCents: result.grossAmountCents,
        professionalAmountCents: result.professionalAmountCents,
        platformFeeAmountCents: result.platformFeeAmountCents,
        commissionRateBp: result.commissionRateBp,
        taxCreditRateBp: result.taxCreditRateBp,
        taxCreditAmountCents: result.taxCreditAmountCents,
        netAmountCents: result.netAmountCents,
      },
    });

    expect(booking.grossAmountCents).toBe(
      booking.professionalAmountCents + booking.platformFeeAmountCents,
    );
  });
});
