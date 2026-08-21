import "server-only";

import { purgerLesEvenements } from "@/lib/analytics/journal";
import { prisma } from "@/lib/db";

/**
 * La purge de rétention.
 *
 * Le dépôt tenait déjà les droits d'accès et d'effacement **à la demande** ;
 * il ne tenait pas la rétention **d'office**, qui est pourtant l'obligation la
 * plus simple à oublier : personne ne se plaint qu'on garde ses données trop
 * longtemps, et c'est précisément pour cela qu'il faut une horloge.
 *
 * Chaque durée est celle du registre, et chacune a une raison qui n'est pas
 * « c'est ce qu'on fait d'habitude » :
 *
 * - **Photos de mission et positions : treize mois.** Elles servent de preuve
 *   de réalisation ; au-delà d'un exercice comptable plus un mois, plus aucun
 *   litige ne s'ouvre sur cette base, et un point de géolocalisation qui traîne
 *   désigne encore le domicile de quelqu'un.
 * - **Événements de mesure : treize mois.** Même durée, autre raison — une
 *   comparaison d'une année sur l'autre a besoin de treize mois, pas de trois
 *   ans.
 * - **Comptes clients : trois ans après la dernière mission.** C'est la
 *   prescription commerciale ordinaire.
 *
 * **Ce qui n'est jamais purgé, et pourquoi** : les factures, les paiements et
 * les réservations qui les portent. Le code de commerce impose dix ans de
 * conservation des documents comptables, et l'article 17 du RGPD écarte
 * l'effacement quand le traitement est nécessaire au respect d'une obligation
 * légale. Le dépôt le dit déjà à la personne au moment de l'effacement ; la
 * purge automatique applique exactement la même frontière.
 */

export const RETENTION_PHOTOS_MOIS = 13;
export const RETENTION_POSITIONS_MOIS = 13;
export const RETENTION_EVENEMENTS_MOIS = 13;
export const RETENTION_COMPTES_ANS = 3;

export interface RapportRetention {
  photosSupprimees: number;
  positionsEffacees: number;
  evenementsSupprimes: number;
  lecturesSecretSupprimees: number;
  listeAttentePurgee: number;
}

function ilYAMois(maintenant: Date, mois: number): Date {
  const limite = new Date(maintenant);
  limite.setMonth(limite.getMonth() - mois);
  return limite;
}

export async function purgerSelonLaRetention(
  maintenant: Date = new Date(),
): Promise<RapportRetention> {
  const limitePhotos = ilYAMois(maintenant, RETENTION_PHOTOS_MOIS);
  const limitePositions = ilYAMois(maintenant, RETENTION_POSITIONS_MOIS);

  const photos = await prisma.missionPhoto.deleteMany({
    where: { uploadedAt: { lt: limitePhotos } },
  });

  /*
   * Les pointages ne sont pas supprimés, leurs **positions** le sont. Le
   * pointage lui-même est une preuve de réalisation qui compte dans un litige
   * de facturation ; la position, elle, n'apporte plus rien après treize mois
   * et désigne encore un domicile. Effacer l'un sans l'autre est exactement ce
   * que la minimisation demande.
   */
  const positions = await prisma.missionCheck.updateMany({
    where: {
      at: { lt: limitePositions },
      OR: [{ lat: { not: null } }, { lng: { not: null } }],
    },
    data: { lat: null, lng: null, distanceMeters: null },
  });

  const evenements = await purgerLesEvenements(maintenant);

  const lectures = await prisma.accessSecretRead.deleteMany({
    where: { readAt: { lt: limitePositions } },
  });

  /*
   * La liste d'attente est purgée à deux ans : une demande d'ouverture de
   * commune plus ancienne ne dit plus rien de la demande d'aujourd'hui, et
   * garder l'adresse email de quelqu'un qui n'a jamais été client au-delà
   * serait difficile à justifier.
   */
  const attente = await prisma.waitlist.deleteMany({
    where: { createdAt: { lt: ilYAMois(maintenant, 24) } },
  });

  return {
    photosSupprimees: photos.count,
    positionsEffacees: positions.count,
    evenementsSupprimes: evenements,
    lecturesSecretSupprimees: lectures.count,
    listeAttentePurgee: attente.count,
  };
}

/**
 * Les fichiers dont les lignes viennent d'être supprimées.
 *
 * Supprimer la ligne sans supprimer l'objet laisserait la photo dans le coffre,
 * accessible à qui possède son chemin — c'est-à-dire une purge qui n'en est pas
 * une. La liste est rendue à l'appelant, qui la passe au stockage : le module de
 * rétention ne connaît pas le fournisseur, et c'est ce qui le garde testable.
 */
export async function cheminsAOublier(
  maintenant: Date = new Date(),
): Promise<string[]> {
  const limite = ilYAMois(maintenant, RETENTION_PHOTOS_MOIS);
  const photos = await prisma.missionPhoto.findMany({
    where: { uploadedAt: { lt: limite } },
    select: { storagePath: true },
  });
  return photos.map((photo) => photo.storagePath);
}
