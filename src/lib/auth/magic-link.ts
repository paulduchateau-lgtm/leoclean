import "server-only";

import { signIn } from "@/lib/auth/config";
import { prisma } from "@/lib/db";

/**
 * Envoi d'un lien de connexion, avec sa limitation de renvoi.
 *
 * Extrait du formulaire de connexion parce qu'il a désormais deux appelants :
 * ce formulaire, et la confirmation de réservation, qui ouvre l'espace client
 * au moment où le compte vient d'être créé. La limitation devait suivre —
 * dupliquée à deux endroits, elle aurait fini par ne plus protéger que l'un
 * des deux.
 *
 * **Pourquoi un lien plutôt qu'une session ouverte d'office.** Réserver ne
 * prouve pas qu'on possède l'adresse saisie. Ouvrir une session sur la seule
 * foi d'un email tapé dans un formulaire permettrait de réserver avec
 * l'adresse d'un tiers et d'atterrir dans son espace, avec son historique et
 * ses adresses. Le lien fait exactement le travail qui manque : il prouve la
 * possession de la boîte. C'est aussi le mécanisme que le dépôt a déjà choisi
 * partout ailleurs, donc aucune surface d'authentification supplémentaire.
 */

/** Fenêtre et quota d'envoi de liens pour une même adresse. */
export const THROTTLE_WINDOW_MINUTES = 10;
export const THROTTLE_MAX_LINKS = 3;

export interface MagicLinkOutcome {
  /** Le message est parti, ou l'était déjà. Toujours vrai côté appelant. */
  sent: true;
  /** Trop de liens récents : on n'en envoie pas un de plus. */
  throttled: boolean;
}

/**
 * Le compte se fait sur les jetons encore valides, donc en base : un compteur
 * en mémoire ne survivrait pas au caractère distribué du déploiement.
 */
export async function sendMagicLink({
  email,
  callbackUrl,
}: {
  email: string;
  callbackUrl: string;
}): Promise<MagicLinkOutcome> {
  const recent = await prisma.verificationToken.count({
    where: {
      identifier: email,
      expires: {
        gt: new Date(Date.now() - THROTTLE_WINDOW_MINUTES * 60_000),
      },
    },
  });

  if (recent >= THROTTLE_MAX_LINKS) {
    return { sent: true, throttled: true };
  }

  await signIn("resend", { email, redirectTo: callbackUrl, redirect: false });
  return { sent: true, throttled: false };
}
