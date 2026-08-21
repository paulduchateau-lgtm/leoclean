"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { requireOrganization } from "@/lib/auth/session";
import { enregistrerLesConsignes } from "@/lib/logement/instructions";
import { marketplaceOrganizationId } from "@/lib/organizations";

async function espaceClient() {
  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(organizationId, "booking:read:own");
  return db;
}

/**
 * Enregistre les consignes d'un logement.
 *
 * **Zod ne valide ici que l'enveloppe**, pas les réponses. La forme d'une
 * réponse dépend du catalogue — un rythme, un booléen, un texte selon la
 * question — et la décrire une seconde fois en Zod créerait deux règles
 * concurrentes, dont c'est toujours la plus ancienne qui survit. Le tri se fait
 * dans `enregistrerLesConsignes`, question par question, contre le catalogue
 * qui fait foi.
 */
export const enregistrerMesConsignes = authedAction(
  z.object({
    addressId: z.string().min(1),
    actif: z.boolean(),
    reponses: z.record(z.string(), z.unknown()),
  }),
  async ({ addressId, actif, reponses }, user) => {
    const enregistre = await enregistrerLesConsignes(
      await espaceClient(),
      user.id,
      addressId,
      { actif, reponses },
      new Date(),
    );

    if (!enregistre) {
      // Le logement n'est pas le sien : même message que s'il n'existait pas,
      // pour ne pas confirmer un identifiant à un curieux.
      throw new Error("Ce logement est introuvable.");
    }

    revalidatePath("/mon-espace/consignes");
    revalidatePath("/mon-compte");
    return { enregistre: true };
  },
);
