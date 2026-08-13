"use server";

import { z } from "zod";

import { publicAction } from "@/lib/actions";
import { signIn } from "@/lib/auth/config";
import { prisma } from "@/lib/db";

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

/** Fenêtre et quota d'envoi de liens de connexion pour une même adresse. */
const THROTTLE_WINDOW_MINUTES = 10;
const THROTTLE_MAX_LINKS = 3;

export const requestMagicLink = publicAction(
  signInSchema,
  async ({ email, callbackUrl }) => {
    /**
     * Limitation du renvoi de liens.
     *
     * Ce formulaire déclenche l'envoi d'un email à une adresse fournie par
     * l'internaute : sans garde-fou, il sert à inonder la boîte d'un tiers.
     * Le compte se fait sur les jetons encore valides, donc en base — un
     * compteur en mémoire ne survivrait pas au caractère distribué du
     * déploiement.
     */
    const recent = await prisma.verificationToken.count({
      where: {
        identifier: email,
        expires: {
          gt: new Date(Date.now() - THROTTLE_WINDOW_MINUTES * 60_000),
        },
      },
    });

    if (recent >= THROTTLE_MAX_LINKS) {
      return {
        sent: true as const,
        throttled: true as const,
      };
    }

    await signIn("resend", {
      email,
      redirectTo: callbackUrl,
      redirect: false,
    });

    return { sent: true as const, throttled: false as const };
  },
);
