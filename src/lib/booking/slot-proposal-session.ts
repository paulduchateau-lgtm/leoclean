import "server-only";

import { getCurrentUser } from "@/lib/auth/session";
import type { ClientProposalView } from "@/lib/booking/slot-proposal-store";
import { readClientProposals } from "@/lib/booking/slot-proposal-store";
import { forOrganization } from "@/lib/db";
import { marketplaceOrganizationId } from "@/lib/organizations";

/**
 * Liant entre la session et la lecture des contre-propositions.
 *
 * Même raison d'être que `client-bookings-session.ts` : dès qu'un module
 * importe la configuration Auth.js, il entraîne tout Next avec lui et cesse
 * d'être exécutable sous Vitest. Le module de lecture reste donc pur de toute
 * session, et c'est ici que les deux se rencontrent.
 */
export async function loadClientProposals(): Promise<ClientProposalView[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const organizationId = await marketplaceOrganizationId();
  return readClientProposals(forOrganization(organizationId), user, new Date());
}
