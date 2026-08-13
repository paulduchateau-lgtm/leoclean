import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/**
 * Extension du type de session.
 *
 * Les appartenances y sont transportées pour l'affichage — quelle
 * organisation, quel menu, quel tableau de bord. Elles ne font pas autorité :
 * toute lecture de donnée métier repasse par `requireOrganization`, qui relit
 * l'appartenance en base.
 */
declare module "next-auth" {
  interface SessionMembership {
    organizationId: string;
    organizationSlug: string;
    organizationName: string;
    role: Role;
  }

  interface Session {
    user: {
      id: string;
      memberships: SessionMembership[];
    } & DefaultSession["user"];
  }
}

export {};
