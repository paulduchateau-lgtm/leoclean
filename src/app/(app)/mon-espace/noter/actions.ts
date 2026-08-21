"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { requireOrganization } from "@/lib/auth/session";
import { BusinessError } from "@/lib/booking/errors";
import { noter } from "@/lib/mission/avis";
import { TAGS_AVIS } from "@/lib/mission/notation";
import { marketplaceOrganizationId } from "@/lib/organizations";

class ProfilIntrouvableError extends BusinessError {}

const CATEGORIES = [
  "PROPRETE",
  "RETARD",
  "COMPORTEMENT",
  "CASSE",
  "AUTRE",
] as const;

export const noterIntervention = authedAction(
  z.object({
    bookingId: z.string().min(1),
    etoiles: z.number().int().min(1).max(5),
    tags: z.array(z.enum(TAGS_AVIS)).max(TAGS_AVIS.length),
    /*
     * Le commentaire est facultatif, et il le reste : un champ libre
     * obligatoire fait chuter le taux de réponse sans rien apprendre de plus
     * qu'une étoile.
     */
    commentaire: z.string().trim().max(2000).nullable(),
    categorie: z.enum(CATEGORIES).nullable(),
  }),
  async (input, user) => {
    const organizationId = await marketplaceOrganizationId();
    const { db } = await requireOrganization(
      organizationId,
      "booking:read:own",
    );

    const profil = await db.clientProfile.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!profil) {
      throw new ProfilIntrouvableError(
        "Aucun espace client rattaché à ce compte.",
      );
    }

    const resultat = await noter(db, profil.id, {
      bookingId: input.bookingId,
      etoiles: input.etoiles,
      tags: input.tags,
      commentaire: input.commentaire,
      categorie: input.categorie,
    });

    revalidatePath("/mon-espace/noter");
    revalidatePath("/mon-espace");
    return resultat;
  },
);
