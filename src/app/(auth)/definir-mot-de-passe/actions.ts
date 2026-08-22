"use server";

import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { definirLeMotDePasse } from "@/lib/auth/identifiants";
import { LONGUEUR_MINIMALE } from "@/lib/auth/mot-de-passe";

/**
 * Définit un premier mot de passe, juste après un lien magique.
 *
 * `actuel` vaut toujours `null` : cet écran ne sert qu'aux comptes qui n'en ont
 * pas — la page redirige les autres avant de s'afficher. Changer un mot de
 * passe existant exige l'ancien, et cela se fait dans les réglages du compte,
 * où le dépôt l'a déjà écrit.
 */
export const definirMonPremierMotDePasse = authedAction(
  z.object({
    motDePasse: z.string().min(LONGUEUR_MINIMALE),
  }),
  async ({ motDePasse }, user) => {
    await definirLeMotDePasse(user.id, motDePasse, null);
    return { defini: true };
  },
);
