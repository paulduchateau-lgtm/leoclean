"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { requireOrganization } from "@/lib/auth/session";
import { BusinessError } from "@/lib/booking/errors";
import { marketplaceOrganizationId } from "@/lib/organizations";
import { ouvrirLenregistrement, retirerLeMoyen } from "@/lib/paiement/moyen";
import { absoluteUrl } from "@/lib/site";

class ProfilIntrouvableError extends BusinessError {}

async function clientDeLaSession(userId: string) {
  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(organizationId, "booking:read:own");
  const profil = await db.clientProfile.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!profil) {
    throw new ProfilIntrouvableError(
      "Aucun espace client rattaché à ce compte.",
    );
  }
  return { db, profil };
}

/**
 * Ouvre une session Checkout chez Stripe et rend son adresse.
 *
 * La session est à usage unique et de courte durée. C'est le navigateur qui la
 * suit, par `location.assign` : une redirection depuis la server action
 * empêcherait l'écran d'afficher un message si Stripe n'est pas configuré, ce
 * qui est précisément l'état actuel en développement.
 */
export const enregistrerUneCarte = authedAction(
  z.object({}),
  async (_input, user) => {
    const { db, profil } = await clientDeLaSession(user.id);
    const { url } = await ouvrirLenregistrement(
      db,
      profil.id,
      absoluteUrl("/mon-espace/paiement"),
    );
    return { url };
  },
);

export const retirerUneCarte = authedAction(
  z.object({ moyenId: z.string().min(1) }),
  async ({ moyenId }, user) => {
    const { db, profil } = await clientDeLaSession(user.id);
    await retirerLeMoyen(db, profil.id, moyenId);
    revalidatePath("/mon-espace/paiement");
    return { retire: true };
  },
);
