import "server-only";

import { serverEnv } from "@/lib/env";

import {
  type Stockage,
  stockageDistantIndisponible,
  stockageEnMemoire,
} from "./index";
import { stockageS3 } from "./s3";

/**
 * Choix du stockage, une fois pour toutes.
 *
 * Même construction que `scheduling/travel.ts` : le produit parle à
 * l'interface, l'implémentation se choisit à la configuration.
 *
 * **`memoire` ne survit pas à un redémarrage**, et le processus sans serveur
 * en démarre un par requête. Il est donc réservé au développement — un dépôt
 * volatil en production perdrait des preuves de réalisation et des pièces
 * d'identité, sans qu'aucune erreur ne remonte : le fichier serait accepté,
 * puis introuvable.
 */

let instance: Stockage | null = null;

/**
 * Y a-t-il un stockage **complet** ? Les écrans le demandent avant d'offrir un
 * dépôt.
 *
 * On vérifie le fournisseur **et ses clés**, pas seulement le fournisseur : une
 * configuration à moitié faite afficherait un bouton de dépôt qui échoue au
 * clic, devant quelqu'un qui téléverse sa pièce d'identité. Mieux vaut dire
 * « pas encore ouvert » et donner le téléphone.
 */
export function stockageConfigure(): boolean {
  if (serverEnv.STOCKAGE_PROVIDER === "memoire") return true;
  if (serverEnv.STOCKAGE_PROVIDER !== "scaleway") return false;

  return Boolean(
    serverEnv.SCALEWAY_S3_ENDPOINT &&
    serverEnv.SCALEWAY_S3_BUCKET &&
    serverEnv.SCALEWAY_ACCESS_KEY &&
    serverEnv.SCALEWAY_SECRET_KEY,
  );
}

export function stockage(): Stockage {
  if (instance) return instance;

  if (serverEnv.STOCKAGE_PROVIDER === "scaleway") {
    const {
      SCALEWAY_S3_ENDPOINT: endpoint,
      SCALEWAY_S3_REGION: region,
      SCALEWAY_S3_BUCKET: bucket,
      SCALEWAY_ACCESS_KEY: accessKeyId,
      SCALEWAY_SECRET_KEY: secretAccessKey,
    } = serverEnv;

    /*
     * Zod ne peut pas exprimer « ces quatre-là ensemble ou aucune » sans
     * alourdir le schéma pour tout le reste : la vérification est faite ici, à
     * l'unique endroit qui les emploie, et elle **nomme ce qui manque**. Une
     * configuration à moitié faite échouerait sinon à la première pièce
     * déposée, c'est-à-dire devant quelqu'un.
     */
    const manquantes = Object.entries({
      SCALEWAY_S3_ENDPOINT: endpoint,
      SCALEWAY_S3_BUCKET: bucket,
      SCALEWAY_ACCESS_KEY: accessKeyId,
      SCALEWAY_SECRET_KEY: secretAccessKey,
    })
      .filter(([, valeur]) => !valeur)
      .map(([nom]) => nom);

    if (manquantes.length > 0) {
      throw new Error(
        `Stockage Scaleway incomplet : ${manquantes.join(", ")} manque${
          manquantes.length > 1 ? "nt" : ""
        }.`,
      );
    }

    const cree = stockageS3({
      endpoint: endpoint!,
      region,
      bucket: bucket!,
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    });
    instance = cree;
    return cree;
  }

  if (serverEnv.STOCKAGE_PROVIDER === "memoire") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Le stockage `memoire` est refusé en production : il perdrait les " +
          "pièces déposées sans qu'aucune erreur ne remonte.",
      );
    }
    const cree = stockageEnMemoire();
    instance = cree;
    return cree;
  }

  /*
   * Direction inverse de `TRAVEL_TIME_PROVIDER`, qui annonce deux fournisseurs
   * qu'il n'a pas : ici, demander ce qui n'existe pas échoue immédiatement,
   * avec le nom de ce qui manque.
   */
  return stockageDistantIndisponible();
}
