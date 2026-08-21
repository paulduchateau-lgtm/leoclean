"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { requireOrganization } from "@/lib/auth/session";
import { BusinessError } from "@/lib/booking/errors";
import { repondre } from "@/lib/messagerie/intervenant";
import { marketplaceOrganizationId } from "@/lib/organizations";

class ProfilIntrouvableError extends BusinessError {}

export const repondreAuClient = authedAction(
  z.object({
    conversationId: z.string().min(1),
    corps: z.string().trim().min(1).max(4000),
  }),
  async ({ conversationId, corps }, user) => {
    const organizationId = await marketplaceOrganizationId();
    const { db } = await requireOrganization(
      organizationId,
      "assignment:read:own",
    );

    const profil = await db.cleanerProfile.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!profil) {
      throw new ProfilIntrouvableError(
        "Votre compte n'est pas rattaché à un profil d'intervenant.",
      );
    }

    const message = await repondre(
      db,
      profil.id,
      user.id,
      conversationId,
      corps,
    );

    revalidatePath(`/intervenant/messages/${conversationId}`);
    revalidatePath("/intervenant/messages");
    return message;
  },
);
