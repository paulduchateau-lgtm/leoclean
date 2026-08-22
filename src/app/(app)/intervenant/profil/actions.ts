"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { requireOrganization } from "@/lib/auth/session";
import { deposerUneDemande } from "@/lib/cleaner/demande-rgpd";
import { mettreEnPause, reprendreLesMissions } from "@/lib/cleaner/suspension";
import { marketplaceOrganizationId } from "@/lib/organizations";

/**
 * Ce que l'intervenant décide de son propre compte.
 *
 * `assignment:respond:own` est la capacité exigée : c'est celle que porte un
 * intervenant, et aucun rôle de gestion ne la détient. Personne ne met donc en
 * pause le compte de quelqu'un d'autre depuis cette porte — la suspension
 * décidée par la plateforme passe par le back-office, et par lui seul.
 */
async function tenant() {
  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(
    organizationId,
    "assignment:respond:own",
  );
  return { db, organizationId };
}

export const mettreMonCompteEnPause = authedAction(
  z.object({}),
  async (_input, user) => {
    const { db } = await tenant();
    await mettreEnPause(db, user.id);
    revalidatePath("/intervenant/profil");
    revalidatePath("/intervenant");
    return { enPause: true };
  },
);

export const reprendreMesMissions = authedAction(
  z.object({}),
  async (_input, user) => {
    const { db } = await tenant();
    await reprendreLesMissions(db, user.id);
    revalidatePath("/intervenant/profil");
    revalidatePath("/intervenant");
    return { repris: true };
  },
);

export const deposerMaDemandeRgpd = authedAction(
  z.object({
    type: z.enum(["ACCES", "EFFACEMENT"]),
    message: z.string().trim().max(2000).nullable(),
  }),
  async ({ type, message }, user) => {
    const { organizationId } = await tenant();
    const resultat = await deposerUneDemande(
      organizationId,
      user.id,
      type,
      message,
    );
    revalidatePath("/intervenant/profil");
    return resultat;
  },
);
