import "server-only";

import Stripe from "stripe";

import { serverEnv } from "@/lib/env";

/**
 * Le client Stripe, et rien d'autre.
 *
 * Isolé pour une raison précise : c'est le seul module du dépôt qui parle à un
 * tiers avec de l'argent au bout. Tout ce qui décide vit dans `calendrier.ts`,
 * qui est pur et testé ; ce fichier-ci ne fait qu'exécuter.
 *
 * **Sans clé, on échoue net.** Même direction que le stockage et que le
 * chiffrement des consignes, et l'inverse de `TRAVEL_TIME_PROVIDER` : un repli
 * silencieux sur « pas de paiement » ferait tourner le service en offrant les
 * prestations, ce que personne ne remarquerait avant la fin du mois.
 */

export class StripeNonConfigureError extends Error {
  constructor() {
    super(
      "STRIPE_SECRET_KEY n'est pas configurée : aucun paiement ne peut être " +
        "préparé, autorisé ni prélevé.",
    );
    this.name = "StripeNonConfigureError";
  }
}

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (client) return client;

  const cle = serverEnv.STRIPE_SECRET_KEY;
  if (!cle) throw new StripeNonConfigureError();

  client = new Stripe(cle, {
    /*
     * La version d'API est figée dans le code plutôt que laissée au compte :
     * une montée de version décidée depuis le tableau de bord changerait le
     * comportement du paiement sans qu'aucun déploiement n'ait eu lieu, et sans
     * qu'aucun test ne s'en aperçoive.
     */
    apiVersion: "2026-07-29.dahlia",
    /* Le nom apparaît dans les journaux Stripe : savoir qui appelle aide. */
    appInfo: { name: "Léo Clean", url: "https://leoclean.fr" },
    maxNetworkRetries: 2,
  });

  return client;
}

export function stripeEstConfigure(): boolean {
  return Boolean(serverEnv.STRIPE_SECRET_KEY);
}

/**
 * Clé d'idempotence d'une opération.
 *
 * Stripe rejoue une requête portant la même clé au lieu de la refaire. C'est ce
 * qui empêche un ordonnanceur relancé deux fois — ou une reprise après une
 * coupure réseau — de poser deux autorisations sur la même réservation, donc de
 * bloquer deux fois le plafond de la carte du client.
 *
 * La clé est **dérivée de la réservation et de l'étape**, jamais tirée au
 * hasard : une clé aléatoire ne protège de rien, puisque la seconde tentative
 * en produirait une autre.
 */
export function cleDIdempotence(
  bookingId: string,
  etape: "preautorisation" | "prelevement" | "liberation" | "reversement",
): string {
  return `leoclean:${etape}:${bookingId}`;
}
