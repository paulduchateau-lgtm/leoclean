"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { espaceClient } from "@/lib/auth/espaces";
import { ecrireDansLeFil, lireLeFilDuClient } from "@/lib/messagerie/client";

/**
 * Écrire et relire un fil, côté client.
 *
 * **`relireLeFil` existe pour le rafraîchissement**, pas pour le premier
 * rendu : la page charge ses messages côté serveur. Elle est appelée pendant
 * que le fil est ouvert, et rend tout le fil plutôt qu'un delta — deux cents
 * messages au plus, ce qui coûte moins qu'un curseur à tenir juste des deux
 * côtés.
 */

export const envoyerAuFil = authedAction(
  z.object({
    conversationId: z.string().min(1),
    corps: z.string().trim().min(1).max(2000),
  }),
  async ({ conversationId, corps }) => {
    const espace = await espaceClient();
    if (!espace.ouvert) throw new Error("Ce fil est introuvable.");

    const message = await ecrireDansLeFil(
      espace.db,
      espace.profil.id,
      espace.user.id,
      conversationId,
      corps,
    );

    revalidatePath(`/mon-espace/messages/${conversationId}`);
    revalidatePath("/mon-espace/messages");
    return { message };
  },
);

export const relireLeFil = authedAction(
  z.object({ conversationId: z.string().min(1) }),
  async ({ conversationId }) => {
    const espace = await espaceClient();
    if (!espace.ouvert) return { messages: [] };

    const fil = await lireLeFilDuClient(
      espace.db,
      espace.profil.id,
      espace.user.id,
      conversationId,
    );

    return { messages: fil?.messages ?? [] };
  },
);
