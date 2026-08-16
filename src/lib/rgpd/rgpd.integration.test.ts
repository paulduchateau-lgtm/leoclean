import { describe, expect, it } from "vitest";

import { forOrganization, prisma } from "@/lib/db";
import { rassemblerDonnees } from "@/lib/rgpd/donnees";
import { effacerDonnees, emailNeutralise } from "@/lib/rgpd/effacement";
import { getCommuneBySlug } from "@/lib/territory";

/**
 * Droits d'accès et d'effacement.
 *
 * Ce qui se vérifie ici n'est pas qu'un bouton fonctionne, mais que la
 * promesse faite à l'écran correspond à l'état de la base : ce qu'on dit
 * effacer l'est réellement, et ce qu'on dit conserver l'est aussi.
 */

const LEOGNAN = getCommuneBySlug("leognan")!;

interface Fixture {
  organizationId: string;
  userId: string;
  email: string;
  clientProfileId: string;
  bookingId: string;
}

async function seed(): Promise<Fixture> {
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
  const email = "claire@exemple.test";

  const user = await prisma.user.create({
    data: { email, name: "Claire Dubourg", emailVerified: new Date() },
  });
  await prisma.session.create({
    data: {
      sessionToken: "jeton-de-test",
      userId: user.id,
      expires: new Date(Date.now() + 86_400_000),
    },
  });

  const profile = await db.clientProfile.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      phone: "0612345678",
      accessNotes: "Digicode 1234",
    },
  });

  const address = await db.address.create({
    data: {
      organizationId: organization.id,
      clientProfileId: profile.id,
      street: "12 rue des Vignes",
      postalCode: LEOGNAN.postalCode,
      cityName: LEOGNAN.name,
      inseeCode: LEOGNAN.insee,
      lat: LEOGNAN.lat,
      lng: LEOGNAN.lng,
      accessNotes: "Portail vert, clé sous le pot",
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

  const booking = await db.booking.create({
    data: {
      organizationId: organization.id,
      clientProfileId: profile.id,
      addressId: address.id,
      serviceId: service.id,
      status: "COMPLETED",
      scheduledStart: new Date("2026-07-01T08:00:00Z"),
      scheduledEnd: new Date("2026-07-01T11:00:00Z"),
      durationMinutes: 180,
      hourlyRateCents: 2900,
      grossAmountCents: 8700,
      professionalAmountCents: 5400,
      platformFeeAmountCents: 3300,
      commissionRateBp: 3800,
      taxCreditAmountCents: 4350,
      netAmountCents: 4350,
      clientNotes: "Insister sur la salle de bain",
    },
  });

  await db.invoice.create({
    data: {
      organizationId: organization.id,
      bookingId: booking.id,
      type: "CLIENT_COORDINATION",
      number: "F-2026-0001",
      totalCents: 3300,
    },
  });

  await db.lead.create({
    data: {
      organizationId: organization.id,
      name: "Claire Dubourg",
      phone: "0612345678",
      email,
      message: "Une maison de 110 m²",
    },
  });

  return {
    organizationId: organization.id,
    userId: user.id,
    email,
    clientProfileId: profile.id,
    bookingId: booking.id,
  };
}

describe("droit d'accès", () => {
  it("rend tout ce que la plateforme détient, demandes de rappel comprises", async () => {
    const fixture = await seed();
    const db = forOrganization(fixture.organizationId);

    const donnees = await rassemblerDonnees(db, {
      id: fixture.userId,
      email: fixture.email,
    });

    expect(donnees.compte.email).toBe(fixture.email);
    expect(donnees.profil?.telephone).toBe("0612345678");
    expect(donnees.profil?.consignesAcces).toBe("Digicode 1234");
    expect(donnees.adresses).toHaveLength(1);
    expect(donnees.adresses[0]!.consignesAcces).toBe(
      "Portail vert, clé sous le pot",
    );
    expect(donnees.reservations).toHaveLength(1);
    expect(donnees.reservations[0]!.vosNotes).toBe(
      "Insister sur la salle de bain",
    );
    // Les demandes de rappel précèdent le compte et n'ont aucun lien
    // d'utilisateur : les omettre cacherait les données les plus anciennes.
    expect(donnees.demandesDeRappel).toHaveLength(1);
  });
});

describe("droit à l'effacement", () => {
  it("efface ce qui identifie, conserve ce que la loi impose", async () => {
    const fixture = await seed();
    const db = forOrganization(fixture.organizationId);

    const resultat = await effacerDonnees(db, fixture.organizationId, {
      id: fixture.userId,
      email: fixture.email,
    });

    expect(resultat.sessionsRevoquees).toBe(1);
    expect(resultat.reservationsConservees).toBe(1);
    expect(resultat.facturesConservees).toBe(1);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: fixture.userId },
    });
    expect(user.email).toBe(emailNeutralise(fixture.userId));
    expect(user.name).toBeNull();

    const profil = await db.clientProfile.findUniqueOrThrow({
      where: { id: fixture.clientProfileId },
    });
    expect(profil.phone).toBeNull();
    expect(profil.accessNotes).toBeNull();

    const adresse = await db.address.findFirstOrThrow({
      where: { clientProfileId: fixture.clientProfileId },
    });
    expect(adresse.street).toBe("Adresse effacée");
    expect(adresse.accessNotes).toBeNull();
    // La commune reste : elle ne désigne personne et justifie la territorialité.
    expect(adresse.cityName).toBe(LEOGNAN.name);

    const reservation = await db.booking.findUniqueOrThrow({
      where: { id: fixture.bookingId },
    });
    expect(reservation.clientNotes).toBeNull();
    // Les montants demeurent : ils relèvent de la comptabilité, pas du
    // consentement.
    expect(reservation.grossAmountCents).toBe(8700);

    expect(await db.invoice.count()).toBe(1);
    expect(await db.lead.count()).toBe(0);
    expect(
      await prisma.session.count({ where: { userId: fixture.userId } }),
    ).toBe(0);
  });

  it("révoque la session sur-le-champ", async () => {
    // Les sessions vivent en base pour cette raison précise : une suppression
    // de compte qui laisserait la personne connectée n'en serait pas une.
    const fixture = await seed();
    const db = forOrganization(fixture.organizationId);

    expect(
      await prisma.session.count({ where: { userId: fixture.userId } }),
    ).toBe(1);

    await effacerDonnees(db, fixture.organizationId, {
      id: fixture.userId,
      email: fixture.email,
    });

    expect(
      await prisma.session.count({ where: { userId: fixture.userId } }),
    ).toBe(0);
  });

  it("laisse une trace de l'effacement, sans donnée personnelle", async () => {
    const fixture = await seed();
    const db = forOrganization(fixture.organizationId);

    await effacerDonnees(db, fixture.organizationId, {
      id: fixture.userId,
      email: fixture.email,
    });

    const trace = await db.auditLog.findFirstOrThrow({
      where: { action: "rgpd.effacement" },
    });
    expect(trace.entityId).toBe(fixture.userId);
    // Prouver que l'effacement a eu lieu est une obligation ; le journal ne
    // doit pas pour autant reconstituer ce qu'on vient d'effacer.
    expect(JSON.stringify(trace.metadata)).not.toContain(fixture.email);
  });
});
