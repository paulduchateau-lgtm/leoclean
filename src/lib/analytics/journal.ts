import "server-only";

import { prisma } from "@/lib/db";

import {
  CHAMPS_INTERDITS,
  type Evenement,
  decomposer,
  parcoursValide,
} from "./evenements";

/**
 * Écriture du journal des événements.
 *
 * Séparé de la taxonomie pour la même raison que partout ailleurs dans le
 * dépôt : `evenements.ts` est pur et se teste en quelques millisecondes, ce
 * module-ci touche la base et porte `server-only`.
 *
 * Deux règles gouvernent ce fichier, et toutes deux disent la même chose —
 * **une mesure ne doit jamais coûter quelque chose au produit.**
 */

/**
 * Le client non cloisonné est employé volontairement.
 *
 * L'organisation est résolue par l'appelant et écrite en dur dans la ligne ;
 * passer par `forOrganization` exigerait une session, or la moitié des
 * événements du tunnel surviennent avant toute authentification. Le risque de
 * fuite est nul dans ce sens-là : on écrit, on ne lit pas. La lecture, elle,
 * viendra du back-office et passera par `asPlatformAdmin()`.
 */

/**
 * Enregistre un événement, et n'échoue jamais bruyamment.
 *
 * C'est le second endroit du dépôt où une erreur est volontairement avalée,
 * après l'envoi des notifications, et pour la même raison : une panne de la
 * mesure ne doit pas faire échouer une réservation. Un tunnel qui refuserait de
 * confirmer parce que le journal est plein serait un défaut bien plus grave que
 * l'absence de la mesure elle-même.
 */
export async function tracer(
  evenement: Evenement,
  contexte: {
    organizationId: string;
    journeyId?: string | null;
    userId?: string | null;
  },
): Promise<void> {
  try {
    const { nom, proprietes } = decomposer(evenement);

    /*
     * Dernier filet avant l'écriture. La liste est déjà imposée à la définition
     * par un test, mais un événement composé dynamiquement pourrait porter une
     * clé inattendue — et une donnée personnelle entrée ici échapperait à la
     * purge des comptes, où elle deviendrait le dernier endroit où une identité
     * survit. On préfère perdre la mesure.
     */
    for (const cle of Object.keys(proprietes)) {
      if ((CHAMPS_INTERDITS as readonly string[]).includes(cle)) {
        console.error(
          `[analytics] événement « ${nom} » rejeté : le champ « ${cle} » ne peut pas être mesuré.`,
        );
        return;
      }
    }

    await prisma.analyticsEvent.create({
      data: {
        organizationId: contexte.organizationId,
        name: nom,
        journeyId:
          contexte.journeyId && parcoursValide(contexte.journeyId)
            ? contexte.journeyId
            : null,
        userId: contexte.userId ?? null,
        properties: proprietes as object,
      },
    });
  } catch (erreur) {
    // Journalisé, jamais propagé : voir l'en-tête.
    console.error("[analytics] écriture impossible", erreur);
  }
}

/**
 * Purge de rétention.
 *
 * Treize mois, la même durée que les photos et les positions du corpus. Écrite
 * ici pour que l'ordonnanceur n'ait qu'à l'appeler — une table de mesure qui
 * grossit sans fin finit par coûter plus cher que ce qu'elle apprend.
 */
export const RETENTION_MOIS = 13;

export async function purgerLesEvenements(maintenant: Date): Promise<number> {
  const limite = new Date(maintenant);
  limite.setMonth(limite.getMonth() - RETENTION_MOIS);

  const { count } = await prisma.analyticsEvent.deleteMany({
    where: { occurredAt: { lt: limite } },
  });

  return count;
}
