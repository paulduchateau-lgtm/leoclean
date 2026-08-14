import "server-only";

import { prisma } from "@/lib/db";

/**
 * Résolution de l'organisation marketplace.
 *
 * Les formulaires publics ne portent aucun identifiant d'organisation : ils
 * s'adressent à Léo Clean, pas à une société cliente du SaaS. Le rattachement se
 * fait donc côté serveur, ce qui évite qu'une valeur envoyée par le navigateur
 * ne détermine dans quelle organisation une donnée atterrit.
 */
let cachedId: string | undefined;

export async function marketplaceOrganizationId(): Promise<string> {
  if (cachedId) {
    return cachedId;
  }

  const organization = await prisma.organization.findFirst({
    where: { type: "MARKETPLACE" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (!organization) {
    throw new Error(
      "Aucune organisation de type MARKETPLACE en base. " +
        "Le seed doit avoir été exécuté avant de recevoir des demandes.",
    );
  }

  cachedId = organization.id;
  return cachedId;
}
