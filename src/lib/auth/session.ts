import "server-only";

import type { Membership, Organization, User } from "@prisma/client";

import { type TenantClient, forOrganization, prisma } from "@/lib/db";

import { auth } from "./config";
import {
  ForbiddenError,
  type Permission,
  UnauthenticatedError,
  can,
} from "./permissions";

/**
 * Vérifications d'accès côté serveur.
 *
 * C'est ici que se décide qui voit quoi. La session, elle, ne fait jamais
 * autorité : elle est émise à un instant donné et peut être plus ancienne
 * qu'un changement de rôle, une suspension ou une exclusion. Chaque appel
 * relit donc l'appartenance en base.
 *
 * `import "server-only"` garantit qu'une erreur de compilation survient si ce
 * module est un jour importé depuis un composant client.
 */

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
}

/** Session courante, ou `null` si personne n'est connecté. */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return null;
  }
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
  };
}

/** Exige une session valide. Lève `UnauthenticatedError` sinon. */
export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthenticatedError();
  }
  return user;
}

export interface OrganizationContext {
  user: AuthenticatedUser;
  membership: Membership;
  organization: Pick<Organization, "id" | "slug" | "name" | "type" | "status">;
  /** Client Prisma déjà restreint à cette organisation. */
  db: TenantClient;
}

/**
 * Exige que l'utilisateur connecté appartienne à cette organisation, et
 * dispose éventuellement d'une capacité précise.
 *
 * Renvoie un client Prisma déjà cloisonné : l'appelant n'a plus l'occasion
 * d'interroger une autre organisation, même par mégarde.
 *
 * L'administrateur plateforme ne bénéficie ici d'aucun privilège. Franchir la
 * frontière d'une organisation passe par `asPlatformAdmin`, qui journalise.
 */
export async function requireOrganization(
  organizationId: string,
  permission?: Permission,
): Promise<OrganizationContext> {
  const user = await requireUser();

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: { userId: user.id, organizationId },
    },
    include: {
      organization: {
        select: { id: true, slug: true, name: true, type: true, status: true },
      },
    },
  });

  // Une appartenance simplement invitée ou suspendue ne donne aucun accès.
  if (!membership || membership.status !== "ACTIVE") {
    throw new ForbiddenError(permission);
  }

  // Une organisation suspendue ne rend plus ses données, quel que soit le rôle.
  if (membership.organization.status === "SUSPENDED") {
    throw new ForbiddenError(permission);
  }

  if (permission && !can(membership.role, permission)) {
    throw new ForbiddenError(permission);
  }

  const { organization, ...rest } = membership;
  return {
    user,
    membership: rest,
    organization,
    db: forOrganization(organizationId),
  };
}

/**
 * Résout une organisation par son slug avant d'en vérifier l'accès.
 * Utile pour les routes de la forme `/pro/[slug]/…`.
 */
export async function requireOrganizationBySlug(
  slug: string,
  permission?: Permission,
): Promise<OrganizationContext> {
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!organization) {
    // On ne distingue pas « n'existe pas » de « pas le droit » : répondre
    // différemment révélerait quelles organisations existent.
    throw new ForbiddenError(permission);
  }

  return requireOrganization(organization.id, permission);
}

export interface PlatformAdminContext {
  user: AuthenticatedUser;
  /**
   * Ouvre un client cloisonné sur n'importe quelle organisation, et journalise
   * l'accès. Chaque franchissement de frontière laisse une trace nominative.
   */
  scopeTo: (organizationId: string, reason: string) => Promise<TenantClient>;
}

/**
 * Exige les droits d'administration de la plateforme.
 *
 * C'est le seul chemin qui autorise à sortir de son organisation. Il est
 * délibérément distinct et verbeux : on doit voir, en lisant le code, qu'on
 * franchit une frontière, et l'audit doit pouvoir dire qui l'a fait et
 * pourquoi.
 */
export async function asPlatformAdmin(): Promise<PlatformAdminContext> {
  const user = await requireUser();

  const admin = await prisma.membership.findFirst({
    where: { userId: user.id, role: "PLATFORM_ADMIN", status: "ACTIVE" },
    select: { id: true },
  });

  if (!admin) {
    throw new ForbiddenError("platform:admin");
  }

  return {
    user,
    async scopeTo(organizationId: string, reason: string) {
      await prisma.auditLog.create({
        data: {
          organizationId,
          actorUserId: user.id,
          action: "platform.cross_organization_access",
          entityType: "Organization",
          entityId: organizationId,
          metadata: { reason },
        },
      });
      return forOrganization(organizationId);
    },
  };
}

/**
 * Restreint l'accès aux données d'un profil client.
 *
 * Un client ne voit que ses propres réservations ; un gestionnaire voit
 * l'ensemble. Cette fonction renvoie le filtre à appliquer, plutôt qu'un
 * booléen, pour que l'appelant ne puisse pas oublier de s'en servir.
 */
export async function bookingScopeFor(
  context: OrganizationContext,
): Promise<{ clientProfileId: string } | Record<string, never>> {
  if (can(context.membership.role, "booking:read:all")) {
    return {};
  }

  const profile = await context.db.clientProfile.findFirst({
    where: { userId: context.user.id },
    select: { id: true },
  });

  if (!profile) {
    throw new ForbiddenError("booking:read:own");
  }

  return { clientProfileId: profile.id };
}

export type { User };
