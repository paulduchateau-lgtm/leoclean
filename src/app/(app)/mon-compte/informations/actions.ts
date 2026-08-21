"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { requireOrganization } from "@/lib/auth/session";
import {
  enregistrerLesInformations,
  retirerUneAdresse,
} from "@/lib/compte/informations";
import { marketplaceOrganizationId } from "@/lib/organizations";

async function espaceClient() {
  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(organizationId, "booking:read:own");
  return db;
}

export const enregistrerMesInformations = authedAction(
  z.object({
    nom: z.string().trim().min(1).max(120),
    /*
     * Le numéro n'est ni normalisé ni validé ici : la règle vit dans
     * `compte/informations.ts`, qui normalise **avant** de valider. La dupliquer
     * en Zod produirait deux règles concurrentes, et c'est en les inversant
     * qu'on refuserait « 06 84 36 38 62 ».
     */
    telephone: z.string().trim().max(30).nullable(),
  }),
  async ({ nom, telephone }, user) => {
    await enregistrerLesInformations(await espaceClient(), user.id, {
      nom,
      telephone,
    });
    revalidatePath("/mon-compte/informations");
    revalidatePath("/mon-compte");
    return { enregistre: true };
  },
);

export const retirerMonAdresse = authedAction(
  z.object({ addressId: z.string().min(1) }),
  async ({ addressId }, user) => {
    await retirerUneAdresse(await espaceClient(), user.id, addressId);
    revalidatePath("/mon-compte/informations");
    return { retiree: true };
  },
);
