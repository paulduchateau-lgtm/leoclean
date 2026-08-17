"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { requireOrganization } from "@/lib/auth/session";
import { enregistrerIdentifiants, rattacherParrain } from "@/lib/cleaner/space";
import { marketplaceOrganizationId } from "@/lib/organizations";

/**
 * Mutations du dossier d'intervenant.
 *
 * `assignment:respond:own` est la capacité exigée : c'est celle que porte un
 * intervenant, et aucun rôle de gestion ne la détient. Personne ne remplit
 * donc le dossier de quelqu'un d'autre depuis cette porte.
 */
async function tenant() {
  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(
    organizationId,
    "assignment:respond:own",
  );
  return db;
}

export const enregistrerMesIdentifiants = authedAction(
  z.object({
    siret: z.string().trim().min(1, "Indiquez votre SIRET."),
    sapDeclarationNumber: z.string().trim().max(20).optional(),
    insuranceExpiresAt: z.string().optional(),
  }),
  async (input, user) => {
    const result = await enregistrerIdentifiants(await tenant(), user, {
      siret: input.siret,
      sapDeclarationNumber: input.sapDeclarationNumber ?? null,
      insuranceExpiresAt:
        input.insuranceExpiresAt && input.insuranceExpiresAt !== ""
          ? new Date(input.insuranceExpiresAt)
          : null,
    });

    revalidatePath("/intervenant/dossier");
    return result;
  },
);

export const saisirCodeParrain = authedAction(
  z.object({ code: z.string().trim().min(4, "Ce code semble trop court.") }),
  async (input, user) => {
    const result = await rattacherParrain(await tenant(), user, input.code);
    revalidatePath("/intervenant/dossier");
    return result;
  },
);
