"use server";

import { z } from "zod";

import { publicAction } from "@/lib/actions";
import { sendMagicLink } from "@/lib/auth/magic-link";
import { exigerQuota } from "@/lib/securite/limitation";

/**
 * Demande d'un lien de connexion.
 *
 * L'action ne dit jamais si l'adresse est connue : répondre différemment
 * transformerait ce formulaire en outil d'énumération de comptes. Le message
 * de confirmation est le même dans tous les cas.
 */

const signInSchema = z.object({
  email: z
    .email("Cette adresse email ne semble pas valide.")
    .transform((value) => value.trim().toLowerCase()),
  /** Chemin de retour après connexion, validé pour rester interne au site. */
  callbackUrl: z
    .string()
    .optional()
    .transform((value) =>
      value && value.startsWith("/") && !value.startsWith("//") ? value : "/",
    ),
});

export const requestMagicLink = publicAction(
  signInSchema,
  async ({ email, callbackUrl }) => {
    /*
     * Le quota par adresse ne protège que le destinataire : un script qui
     * change d'adresse à chaque appel envoie autant de messages qu'il veut, et
     * c'est la réputation d'expéditeur du domaine qui en paie le prix. La
     * limitation par source complète la première, elle ne la remplace pas.
     */
    await exigerQuota("connexion");

    /*
     * Limitation du renvoi de liens : ce formulaire déclenche un email vers
     * une adresse fournie par l'internaute, donc sans garde-fou il sert à
     * inonder la boîte d'un tiers. La règle vit dans `magic-link.ts`, que la
     * confirmation de réservation appelle aussi.
     */
    return sendMagicLink({ email, callbackUrl });
  },
);
