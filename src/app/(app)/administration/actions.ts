"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  marquerLeRappelTraite,
  relancerLaProposition,
  relancerLaRecherche,
} from "@/lib/administration/actions-exploitation";
import { authedAction } from "@/lib/actions";

/**
 * Les gestes d'exploitation.
 *
 * Chacun vérifie `asPlatformAdmin()` dans le module qu'il appelle — la
 * vérification vit au contact des données, jamais dans l'enveloppe.
 */

export const relancerUneRecherche = authedAction(
  z.object({ bookingId: z.string().min(1) }),
  async ({ bookingId }) => {
    const resultat = await relancerLaRecherche(bookingId);
    revalidatePath("/administration");
    revalidatePath("/administration/radar");
    return resultat;
  },
);

export const relancerUneProposition = authedAction(
  z.object({ assignmentId: z.string().min(1) }),
  async ({ assignmentId }) => {
    const resultat = await relancerLaProposition(assignmentId);
    revalidatePath("/administration");
    revalidatePath("/administration/radar");
    return resultat;
  },
);

export const traiterUnRappel = authedAction(
  z.object({ leadId: z.string().min(1) }),
  async ({ leadId }) => {
    await marquerLeRappelTraite(leadId);
    revalidatePath("/administration");
    revalidatePath("/administration/radar");
    return { traite: true };
  },
);
