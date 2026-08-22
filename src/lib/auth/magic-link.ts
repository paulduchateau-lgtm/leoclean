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

  /*
   * **Le lien mène d'abord à la création d'un mot de passe**, puis à la
   * destination demandée — arbitrage du porteur du projet.
   *
   * Le raisonnement : quelqu'un qui vient d'ouvrir un lien à usage unique est
   * exactement au moment où il a prouvé qu'il reçoit les emails de cette
   * adresse, donc le seul moment où le dépôt autorise à définir un mot de
   * passe. Le lui proposer plus tard, dans un écran de réglages, revient à ne
   * jamais le lui proposer — et à lui faire refaire un aller-retour par sa
   * boîte mail à chaque connexion.
   *
   * **La page reste facultative**, et c'est ce qui la rend acceptable : elle
   * offre de passer, et un compte sans mot de passe continue de se connecter
   * par lien. Le dépôt a choisi que le mot de passe s'ajoute et ne remplace
   * rien ; en faire un passage obligé contredirait cette règle.
   *
   * L'enveloppement se fait **ici et nulle part ailleurs** : chaque appelant
   * qui composerait l'URL lui-même finirait par en oublier un, et ce lien-là
   * serait le seul à ne rien proposer.
   */
  const destination = `/definir-mot-de-passe?suite=${encodeURIComponent(callbackUrl)}`;

  await signIn("resend", { email, redirectTo: destination, redirect: false });
  return { sent: true, throttled: false };
}
