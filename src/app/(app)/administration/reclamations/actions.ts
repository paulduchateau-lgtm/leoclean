"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { clore, prendreEnCharge } from "@/lib/administration/reclamations";
import { asPlatformAdmin } from "@/lib/auth/session";
import { RESOLUTION_MINIMUM } from "@/lib/reclamation/vocabulaire";

export const prendreEnChargeLaReclamation = authedAction(
  z.object({ id: z.string().min(1) }),
  async ({ id }) => {
    await asPlatformAdmin();
    await prendreEnCharge(id);
    revalidatePath("/administration/reclamations");
    return { prise: true };
  },
);

export const cloreLaReclamation = authedAction(
  z.object({
    id: z.string().min(1),
    statut: z.enum(["RESOLUE", "CLASSEE"]),
    /*
     * Le minimum vaut aussi pour un classement sans suite : « on n'a rien
     * fait » est une décision qui se justifie, et qui se relit quand la même
     * personne rappelle. Le seuil est lu, pas recopié — l'écran et le serveur
     * refusent au même endroit.
     */
    resolution: z.string().trim().min(RESOLUTION_MINIMUM).max(2000),
  }),
  async ({ id, statut, resolution }) => {
    await asPlatformAdmin();
    await clore(id, statut, resolution);
    revalidatePath("/administration/reclamations");
    revalidatePath("/administration");
    return { close: true };
  },
);
