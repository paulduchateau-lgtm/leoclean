"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import {
  definirLeMotDePasse,
  fermerToutesLesSessions,
  retirerLeMotDePasse,
} from "@/lib/auth/identifiants";
import { LONGUEUR_MAXIMALE } from "@/lib/auth/mot-de-passe";

/**
 * Ce qu'on fait de ses identifiants.
 *
 * Toutes exigent une session : c'est elle qui prouve qu'on reçoit les emails de
 * l'adresse, et c'est le niveau de preuve d'un lien magique. Il n'y a donc rien
 * de plus à demander pour poser un premier mot de passe — et l'ancien est exigé
 * pour en changer, parce qu'un poste laissé ouvert ne doit pas permettre de
 * verrouiller le compte de son propriétaire.
 */

export const definirMonMotDePasse = authedAction(
  z.object({
    /*
     * La longueur minimale n'est **pas** vérifiée ici : la politique vit dans
     * `mot-de-passe.ts` et rend un message qui dit quoi faire. La dupliquer en
     * Zod produirait deux règles concurrentes et un message générique.
     */
    nouveau: z.string().min(1).max(LONGUEUR_MAXIMALE),
    actuel: z.string().max(LONGUEUR_MAXIMALE).optional(),
  }),
  async ({ nouveau, actuel }, user) => {
    await definirLeMotDePasse(user.id, nouveau, actuel ?? null);
    revalidatePath("/mon-compte/connexion");
    return { defini: true };
  },
);

export const retirerMonMotDePasse = authedAction(
  z.object({ actuel: z.string().min(1).max(LONGUEUR_MAXIMALE) }),
  async ({ actuel }, user) => {
    await retirerLeMotDePasse(user.id, actuel);
    revalidatePath("/mon-compte/connexion");
    return { retire: true };
  },
);

/**
 * Ferme toutes les sessions, celle en cours comprise.
 *
 * C'est le geste qui donne son sens aux sessions en base. Il n'y a pas de
 * confirmation à l'écran au-delà du bouton lui-même : quelqu'un qui doute d'un
 * appareil doit pouvoir couper vite, et une boîte de dialogue de plus est une
 * seconde d'accès supplémentaire pour qui ne devrait pas l'avoir.
 */
export const fermerMesSessions = authedAction(
  z.object({}),
  async (_input, user) => {
    const fermees = await fermerToutesLesSessions(user.id);
    return { fermees };
  },
);
