import { describe, expect, it } from "vitest";

import { readKnownClient } from "@/lib/booking/known-client";
import { forOrganization, prisma } from "@/lib/db";
import { getCommuneBySlug } from "@/lib/territory";

/**
 * Ce que le tunnel sait d'un client qui revient.
 *
 * Trois choses s'y vérifient et ne peuvent pas l'être sans base : le
 * dédoublonnage des adresses — chaque réservation crée sa propre ligne, donc
 * un client fidèle en accumule —, le cloisonnement, et le fait qu'un compte
 * sans réservation reste traité comme un inconnu.
 */

const LEOGNAN = getCommuneBySlug("leognan")!;
const GRADIGNAN = getCommuneBySlug("gradignan")!;

interface Fixture {
  organizationId: string;
  userId: string;
  clientProfileId: string;
  serviceId: string;
}

async function seed(slug = "leoclean"): Promise<Fixture> {
  const organization = await prisma.organization.create({
    data: {
      slug,
      name: "Léo Clean",
      type: "MARKETPLACE",
      status: "ACTIVE",
      commissionRateBp: 3800,
    },
  });
  const db = forOrganization(organization.id);

  const user = await prisma.user.create({
    data: { email: `${slug}@exemple.test`, name: "Camille Durand" },
  });

  const profile = await db.clientProfile.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      phone: "0612345678",
    },
  });

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

  return {
    organizationId: organization.id,
    userId: user.id,
    clientProfileId: profile.id,
    serviceId: service.id,
  };
}

/**
 * `createdAt` est fourni explicitement, une seconde d'écart par appel.
 *
 * Sans cela, quatre adresses créées dans la même milliseconde rendent l'ordre
 * de la liste dépendant du plan d'exécution — et le test échoue une fois sur
 * deux pour une raison qui n'a rien à voir avec ce qu'il vérifie.
 */
let clock = 0;

async function addAddress(
  fixture: Fixture,
  street: string,
  commune = LEOGNAN,
  accessNotes: string | null = null,
) {
  const db = forOrganization(fixture.organizationId);
  clock += 1;
  return db.address.create({
    data: {
      organizationId: fixture.organizationId,
      clientProfileId: fixture.clientProfileId,
      street,
      postalCode: commune.postalCode,
      cityName: commune.name,
      inseeCode: commune.insee,
      lat: commune.lat,
      lng: commune.lng,
      accessNotes,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, clock)),
    },
  });
}

const USER = (fixture: Fixture) => ({
  id: fixture.userId,
  email: "camille@exemple.test",
  name: "Camille Durand",
});

describe("profil d'un client connu", () => {
  it("ne connaît pas un compte qui n'a jamais réservé", async () => {
    const fixture = await seed();
    const user = await prisma.user.create({
      data: { email: "inconnu@exemple.test", name: "Sans Réservation" },
    });

    const known = await readKnownClient(
      forOrganization(fixture.organizationId),
      { id: user.id, email: "inconnu@exemple.test", name: "Sans Réservation" },
    );

    // Aucun profil client : le tunnel doit se comporter comme pour un anonyme.
    expect(known).toBeNull();
  });

  it("rend le nom, le téléphone et les adresses déjà employées", async () => {
    const fixture = await seed();
    await addAddress(fixture, "12 rue des Vignes", LEOGNAN, "Digicode 1234");

    const known = await readKnownClient(
      forOrganization(fixture.organizationId),
      USER(fixture),
    );

    expect(known).not.toBeNull();
    expect(known!.firstName).toBe("Camille");
    expect(known!.lastName).toBe("Durand");
    expect(known!.phone).toBe("0612345678");
    expect(known!.addresses).toHaveLength(1);
    expect(known!.addresses[0]!.label).toBe("12 rue des Vignes, 33850 Léognan");
    expect(known!.addresses[0]!.accessNotes).toBe("Digicode 1234");
  });

  it("dédoublonne les adresses répétées à chaque réservation", async () => {
    const fixture = await seed();
    // Trois réservations à la même adresse, trois lignes en base : c'est voulu,
    // une réservation passée garde l'adresse telle qu'elle était.
    await addAddress(fixture, "12 rue des Vignes");
    await addAddress(fixture, "12 Rue des Vignes");
    await addAddress(fixture, "12 rue des vignes ");
    await addAddress(fixture, "8 avenue de Gradignan", GRADIGNAN);

    const known = await readKnownClient(
      forOrganization(fixture.organizationId),
      USER(fixture),
    );

    expect(known!.addresses).toHaveLength(2);
    expect(known!.addresses.map((address) => address.cityName)).toEqual([
      "Gradignan",
      "Léognan",
    ]);
  });

  it("ne propose jamais plus de trois adresses", async () => {
    const fixture = await seed();
    for (let index = 0; index < 6; index++) {
      await addAddress(fixture, `${index} rue de la Liste`);
    }

    const known = await readKnownClient(
      forOrganization(fixture.organizationId),
      USER(fixture),
    );

    expect(known!.addresses).toHaveLength(3);
  });

  it("reprend le dernier logement et le dernier rythme réservés", async () => {
    const fixture = await seed();
    const address = await addAddress(fixture, "12 rue des Vignes");
    const db = forOrganization(fixture.organizationId);

    const base = {
      organizationId: fixture.organizationId,
      clientProfileId: fixture.clientProfileId,
      addressId: address.id,
      serviceId: fixture.serviceId,
      scheduledStart: new Date("2026-08-10T08:00:00Z"),
      scheduledEnd: new Date("2026-08-10T11:00:00Z"),
      durationMinutes: 180,
      hourlyRateCents: 2900,
      grossAmountCents: 8700,
      professionalAmountCents: 5400,
      platformFeeAmountCents: 3300,
      commissionRateBp: 3800,
      taxCreditAmountCents: 4350,
      netAmountCents: 4350,
    };

    await db.booking.create({
      data: {
        ...base,
        surfaceSqm: 40,
        frequency: "ONE_OFF",
        createdAt: new Date("2026-07-01T10:00:00Z"),
      },
    });
    await db.booking.create({
      data: {
        ...base,
        surfaceSqm: 100,
        frequency: "BIWEEKLY",
        createdAt: new Date("2026-08-01T10:00:00Z"),
      },
    });

    const known = await readKnownClient(db, USER(fixture));

    expect(known!.lastChoice).toEqual({
      surfaceSqm: 100,
      frequency: "BIWEEKLY",
    });
  });

  it("ne voit pas le profil d'une autre organisation", async () => {
    const mine = await seed("leoclean");
    const other = await seed("societe-tierce");
    await addAddress(other, "1 rue Ailleurs");

    // Le client de l'autre organisation, lu depuis la nôtre : rien.
    const known = await readKnownClient(forOrganization(mine.organizationId), {
      id: other.userId,
      email: "ailleurs@exemple.test",
      name: "Ailleurs",
    });

    expect(known).toBeNull();
  });
});
