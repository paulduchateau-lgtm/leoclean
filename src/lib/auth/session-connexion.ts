import "server-only";

import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/db";

/**
 * La session d'une connexion par mot de passe.
 *
 * **Auth.js n'écrit pas de session en base pour le fournisseur `Credentials`.**
 * Il bascule sur un jeton signé, quelle que soit la stratégie déclarée. Accepter
 * ce comportement donnerait deux régimes de session — révocable pour le lien
 * magique, non révocable pour le mot de passe — et ferait tomber la garantie sur
 * laquelle repose tout le reste du dépôt : suspendre un intervenant, supprimer
 * un compte au titre du RGPD, fermer les connexions d'un appareil perdu.
 *
 * `authConfig.jwt.encode` intercepte donc l'encodage et appelle cette fonction :
 * le cookie porte un identifiant de session ordinaire, que le reste du système
 * lit sans savoir d'où il vient.
 *
 * **Le module est séparé de `config.ts` pour être testable.** Charger la
 * configuration d'Auth.js hors de Next tire `next/server`, que la résolution
 * ESM refuse ; l'écriture, elle, se vérifie sans rien de tout cela — et c'est
 * l'écriture qui porte la garantie.
 */

/** Trente jours, comme la session ordinaire : les deux chemins se valent. */
export const DUREE_SESSION_SECONDES = 30 * 24 * 60 * 60;

export async function creerSessionDeConnexion(
  userId: string,
  maintenant: Date = new Date(),
): Promise<string> {
  const jeton = randomUUID();

  await prisma.session.create({
    data: {
      sessionToken: jeton,
      userId,
      expires: new Date(maintenant.getTime() + DUREE_SESSION_SECONDES * 1000),
    },
  });

  return jeton;
}
