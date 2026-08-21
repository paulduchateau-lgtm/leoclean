"use server";

import { z } from "zod";

import { AuthError } from "next-auth";

import { publicAction } from "@/lib/actions";
import { signIn } from "@/lib/auth/config";
import { FOURNISSEURS_ACTIFS } from "@/lib/auth/fournisseurs";
import { MESSAGE_ECHEC } from "@/lib/auth/identifiants";
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

/**
 * Connexion par mot de passe.
 *
 * Le message d'échec est **unique et vient du serveur** : il ne dit ni si
 * l'adresse existe, ni laquelle des deux valeurs est fausse. Le distinguer
 * transformerait ce formulaire en outil d'énumération de comptes, exactement ce
 * que la demande de lien magique s'interdit déjà.
 *
 * La limitation de débit n'est pas ici mais dans `authorize` : le point
 * d'entrée réel est la route d'Auth.js, qu'un script appelle sans passer par
 * cet écran. Un garde-fou posé sur le formulaire ne garde rien.
 */
export async function seConnecterAvecMotDePasse(
  _precedent: { erreur: string } | null,
  donnees: FormData,
): Promise<{ erreur: string } | null> {
  const email = donnees.get("email");
  const motDePasse = donnees.get("password");
  const retour = donnees.get("callbackUrl");

  if (typeof email !== "string" || typeof motDePasse !== "string") {
    return { erreur: MESSAGE_ECHEC };
  }

  try {
    await signIn("mot-de-passe", {
      email,
      password: motDePasse,
      redirectTo: cheminInterne(retour),
    });
  } catch (erreur) {
    /*
     * Une connexion réussie **lève** : `signIn` appelle `redirect`, qui
     * signale la navigation par une exception. La laisser remonter est donc
     * indispensable — l'attraper afficherait « identifiants invalides » sur une
     * connexion qui vient de réussir.
     */
    if (erreur instanceof AuthError) return { erreur: MESSAGE_ECHEC };
    throw erreur;
  }

  return null;
}

/**
 * Connexion par un fournisseur social.
 *
 * Le fournisseur est validé contre la liste de ceux qui sont **réellement
 * configurés** : accepter une valeur venue du navigateur ferait rendre à
 * Auth.js une erreur brute pour un fournisseur inconnu.
 */
export async function seConnecterAvec(
  fournisseur: string,
  callbackUrl?: string,
): Promise<void> {
  if (!FOURNISSEURS_ACTIFS.some((actif) => actif.id === fournisseur)) {
    throw new Error("Fournisseur de connexion inconnu.");
  }
  await signIn(fournisseur, { redirectTo: cheminInterne(callbackUrl) });
}

/**
 * Ramène un chemin de retour à quelque chose d'interne.
 *
 * Une URL absolue transformerait l'écran de connexion en redirection ouverte :
 * on enverrait quelqu'un vers un site tiers depuis notre propre domaine, ce
 * qui est le socle d'un hameçonnage crédible. `//` est écarté avec le reste —
 * il désigne un autre hôte, malgré son air de chemin relatif.
 */
function cheminInterne(valeur: unknown): string {
  return typeof valeur === "string" &&
    valeur.startsWith("/") &&
    !valeur.startsWith("//")
    ? valeur
    : "/";
}
