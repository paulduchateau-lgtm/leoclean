import "server-only";

import { getCurrentUser } from "@/lib/auth/session";
import type { ClientBookings } from "@/lib/booking/client-bookings";
import { readClientBookings } from "@/lib/booking/client-bookings";
import { forOrganization } from "@/lib/db";
import { marketplaceOrganizationId } from "@/lib/organizations";

/**
 * Liant entre la session et la lecture des interventions d'un client.
 *
 * Il tient dans une fonction et vit pourtant dans son propre fichier, pour la
 * même raison que `known-client-session.ts` : dès qu'un module importe la
 * configuration Auth.js, il entraîne tout Next avec lui et cesse d'être
 * exécutable sous Vitest.
 */
export async function loadClientBookings(): Promise<ClientBookings | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  /*
   * L'organisation est résolue côté serveur : rien de ce que le navigateur
   * envoie ne doit décider dans quelle organisation on va lire.
   */
  const organizationId = await marketplaceOrganizationId();
  return readClientBookings(forOrganization(organizationId), user, new Date());
}
