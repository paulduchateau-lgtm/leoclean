import "server-only";

import { getCurrentUser } from "@/lib/auth/session";
import type { KnownClient } from "@/lib/booking/backend";
import { readKnownClient } from "@/lib/booking/known-client";
import { forOrganization } from "@/lib/db";
import { marketplaceOrganizationId } from "@/lib/organizations";

/**
 * Liant entre la session et la lecture du profil client.
 *
 * Il tient dans une fonction, et vit pourtant dans son propre fichier : dès
 * qu'un module importe la configuration Auth.js, il entraîne tout Next avec
 * lui et cesse d'être exécutable sous Vitest. `known-client.ts` reste donc
 * testable contre une vraie base, et c'est ici seulement qu'on paie le prix de
 * la session.
 */
export async function loadKnownClient(): Promise<KnownClient | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  /*
   * L'organisation est résolue côté serveur, comme partout ailleurs dans le
   * tunnel : rien de ce que le navigateur envoie ne doit décider dans quelle
   * organisation on va lire.
   */
  const organizationId = await marketplaceOrganizationId();
  return readKnownClient(forOrganization(organizationId), user);
}
