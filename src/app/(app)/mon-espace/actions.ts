"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import {
  cancelClientBooking,
  readBookingMessages,
  sendBookingMessage,
} from "@/lib/booking/client-space";
import { forOrganization } from "@/lib/db";
import { marketplaceOrganizationId } from "@/lib/organizations";

/**
 * Mutations de l'espace client.
 *
 * `authedAction` et non `organizationAction` : un client de la marketplace n'a
 * pas de `Membership`, et exiger une appartenance rendrait ces actions
 * impossibles pour tout le monde. L'appartenance réelle — cette réservation
 * est-elle la sienne ? — est vérifiée dans `client-space.ts`, à partir de la
 * session et jamais de l'entrée.
 *
 * L'organisation est résolue côté serveur, comme partout : rien de ce que le
 * navigateur envoie ne décide dans quelle organisation on écrit.
 */

async function tenant() {
  return forOrganization(await marketplaceOrganizationId());
}

export const annulerIntervention = authedAction(
  z.object({
    bookingId: z.string().min(1),
    /** Motif libre, facultatif : le client ne doit aucune justification. */
    reason: z.string().trim().max(500).optional(),
  }),
  async (input, user) => {
    const receipt = await cancelClientBooking(
      await tenant(),
      user,
      input,
      new Date(),
    );

    // La liste des interventions est rendue côté serveur : sans cette purge,
    // le client verrait encore le rendez-vous qu'il vient d'annuler.
    revalidatePath("/mon-espace");
    return receipt;
  },
);

export const listerMessages = authedAction(
  z.object({ bookingId: z.string().min(1) }),
  async (input, user) =>
    readBookingMessages(await tenant(), user, input.bookingId),
);

export const envoyerMessage = authedAction(
  z.object({
    bookingId: z.string().min(1),
    body: z.string().trim().min(1, "Écrivez votre message.").max(2000),
  }),
  async (input, user) => sendBookingMessage(await tenant(), user, input),
);
