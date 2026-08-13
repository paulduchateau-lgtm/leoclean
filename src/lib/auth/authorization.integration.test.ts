import type { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { forOrganization, prisma } from "@/lib/db";

import { ForbiddenError, UnauthenticatedError } from "./permissions";

/**
 * Autorisation.
 *
 * La couche `session.ts` dépend d'Auth.js pour connaître l'utilisateur
 * courant. On simule uniquement cette lecture de session — tout le reste, à
 * commencer par les appartenances, est lu en base : c'est précisément ce que
 * ces tests doivent vérifier, une session pouvant être plus ancienne qu'un
 * changement de rôle.
 */

const currentSession = vi.hoisted(() => ({
  value: null as { user: { id: string; email: string; name?: string } } | null,
}));

vi.mock("./config", () => ({
  auth: () => Promise.resolve(currentSession.value),
}));

const { asPlatformAdmin, bookingScopeFor, requireOrganization, requireUser } =
  await import("./session");

function signIn(user: { id: string; email: string }): void {
  currentSession.value = { user };
}

function signOut(): void {
  currentSession.value = null;
}

interface Org {
  id: string;
  ownerId: string;
  managerId: string;
  cleanerId: string;
  clientUserId: string;
  clientProfileId: string;
  bookingId: string;
}

async function createOrg(slug: string, name: string): Promise<Org> {
  const organization = await prisma.organization.create({
    data: { slug, name, type: "COMPANY", status: "ACTIVE" },
  });
  const db = forOrganization(organization.id);

  const makeMember = async (role: Role, email: string): Promise<string> => {
    const user = await prisma.user.create({ data: { email } });
    await prisma.membership.create({
      data: { userId: user.id, organizationId: organization.id, role },
    });
    return user.id;
  };

  const ownerId = await makeMember("ORG_OWNER", `owner@${slug}.test`);
  const managerId = await makeMember("ORG_MANAGER", `manager@${slug}.test`);
  const cleanerId = await makeMember("CLEANER", `cleaner@${slug}.test`);
  const clientUserId = await makeMember("CLIENT", `client@${slug}.test`);

  const clientProfile = await db.clientProfile.create({
    data: { organizationId: organization.id, userId: clientUserId },
  });
  const address = await db.address.create({
    data: {
      organizationId: organization.id,
      clientProfileId: clientProfile.id,
      street: "3 Rue de la Demi-Lune",
      postalCode: "33850",
      cityName: "Léognan",
      inseeCode: "33238",
      lat: 44.7432,
      lng: -0.5919,
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
      scheduledEnd: new Date("2026-09-01T09:00:00Z"),
      durationMinutes: 120,
      hourlyRateCents: 2900,
      grossAmountCents: 5800,
      taxCreditAmountCents: 2900,
      netAmountCents: 2900,
      commissionRateBp: 1200,
      commissionAmountCents: 696,
    },
  });

  return {
    id: organization.id,
    ownerId,
    managerId,
    cleanerId,
    clientUserId,
    clientProfileId: clientProfile.id,
    bookingId: booking.id,
  };
}

let alpha: Org;
let beta: Org;

beforeEach(async () => {
  signOut();
  alpha = await createOrg("net-des-graves", "Net des Graves");
  beta = await createOrg("ateliers-du-propre", "Les Ateliers du Propre");
});

describe("authentification", () => {
  it("refuse l'accès sans session", async () => {
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("accepte une session valide", async () => {
    signIn({ id: alpha.ownerId, email: "owner@net-des-graves.test" });
    await expect(requireUser()).resolves.toMatchObject({ id: alpha.ownerId });
  });
});

describe("appartenance à une organisation", () => {
  it("ouvre l'accès à un membre de l'organisation", async () => {
    signIn({ id: alpha.ownerId, email: "owner@net-des-graves.test" });

    const context = await requireOrganization(alpha.id);

    expect(context.membership.role).toBe("ORG_OWNER");
    expect(context.organization.slug).toBe("net-des-graves");
  });

  it("refuse l'accès à l'organisation voisine", async () => {
    // Le scénario central : le propriétaire d'une société de ménage tente de
    // lire les données de sa concurrente.
    signIn({ id: alpha.ownerId, email: "owner@net-des-graves.test" });

    await expect(requireOrganization(beta.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("renvoie un client déjà cloisonné", async () => {
    signIn({ id: alpha.ownerId, email: "owner@net-des-graves.test" });
    const context = await requireOrganization(alpha.id);

    const bookings = await context.db.booking.findMany();

    expect(bookings).toHaveLength(1);
    expect(bookings[0]?.id).toBe(alpha.bookingId);
    // Même en visant explicitement la réservation voisine, rien ne remonte.
    expect(
      await context.db.booking.findUnique({ where: { id: beta.bookingId } }),
    ).toBeNull();
  });

  it("refuse une appartenance seulement invitée", async () => {
    const invited = await prisma.user.create({
      data: { email: "invite@net-des-graves.test" },
    });
    await prisma.membership.create({
      data: {
        userId: invited.id,
        organizationId: alpha.id,
        role: "ORG_MANAGER",
        status: "INVITED",
      },
    });
    signIn({ id: invited.id, email: "invite@net-des-graves.test" });

    await expect(requireOrganization(alpha.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("refuse une appartenance suspendue, même si la session est antérieure", async () => {
    // La session a été émise alors que la personne était active. Comme
    // l'appartenance est relue à chaque appel, la suspension prend effet
    // immédiatement.
    signIn({ id: alpha.managerId, email: "manager@net-des-graves.test" });
    await expect(requireOrganization(alpha.id)).resolves.toBeDefined();

    await prisma.membership.updateMany({
      where: { userId: alpha.managerId, organizationId: alpha.id },
      data: { status: "SUSPENDED" },
    });

    await expect(requireOrganization(alpha.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("ferme l'accès à une organisation suspendue", async () => {
    await prisma.organization.update({
      where: { id: alpha.id },
      data: { status: "SUSPENDED" },
    });
    signIn({ id: alpha.ownerId, email: "owner@net-des-graves.test" });

    await expect(requireOrganization(alpha.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("capacités", () => {
  it("laisse le gestionnaire tenir le catalogue", async () => {
    signIn({ id: alpha.managerId, email: "manager@net-des-graves.test" });

    await expect(
      requireOrganization(alpha.id, "catalog:manage"),
    ).resolves.toBeDefined();
  });

  it("refuse au gestionnaire la gestion des membres", async () => {
    signIn({ id: alpha.managerId, email: "manager@net-des-graves.test" });

    await expect(
      requireOrganization(alpha.id, "org:members:manage"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuse à l'intervenant la lecture de toutes les réservations", async () => {
    signIn({ id: alpha.cleanerId, email: "cleaner@net-des-graves.test" });

    await expect(
      requireOrganization(alpha.id, "booking:read:all"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("portée des réservations", () => {
  it("ne filtre pas pour qui peut tout lire", async () => {
    signIn({ id: alpha.ownerId, email: "owner@net-des-graves.test" });
    const context = await requireOrganization(alpha.id);

    expect(await bookingScopeFor(context)).toEqual({});
  });

  it("restreint le client à ses propres réservations", async () => {
    signIn({ id: alpha.clientUserId, email: "client@net-des-graves.test" });
    const context = await requireOrganization(alpha.id);

    expect(await bookingScopeFor(context)).toEqual({
      clientProfileId: alpha.clientProfileId,
    });
  });
});

describe("administration de la plateforme", () => {
  it("refuse à un simple propriétaire d'organisation", async () => {
    signIn({ id: alpha.ownerId, email: "owner@net-des-graves.test" });

    await expect(asPlatformAdmin()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("autorise le franchissement de frontière, et le journalise", async () => {
    const admin = await prisma.user.create({
      data: { email: "admin@leoclean.fr" },
    });
    const platform = await prisma.organization.create({
      data: {
        slug: "leoclean",
        name: "LéoClean",
        type: "MARKETPLACE",
        status: "ACTIVE",
      },
    });
    await prisma.membership.create({
      data: {
        userId: admin.id,
        organizationId: platform.id,
        role: "PLATFORM_ADMIN",
      },
    });
    signIn({ id: admin.id, email: "admin@leoclean.fr" });

    const context = await asPlatformAdmin();
    const db = await context.scopeTo(beta.id, "Litige n° 412, remboursement");

    expect(await db.booking.count()).toBe(1);

    // Toute intrusion dans une organisation tierce laisse une trace nominative
    // et motivée : c'est ce qui rend le privilège acceptable.
    const trace = await prisma.auditLog.findFirst({
      where: {
        action: "platform.cross_organization_access",
        organizationId: beta.id,
      },
    });
    expect(trace?.actorUserId).toBe(admin.id);
    expect(trace?.metadata).toMatchObject({
      reason: "Litige n° 412, remboursement",
    });
  });
});
