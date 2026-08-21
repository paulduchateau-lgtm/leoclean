import "server-only";

import type { TenantClient } from "@/lib/db";
import { FichierRefuseError, estPublic } from "@/lib/stockage";
import { stockage, stockageConfigure } from "@/lib/stockage/resolution";

/**
 * Le portrait d'un compte, client ou intervenant.
 *
 * **Un seul module pour les deux**, parce que la règle est la même : une image
 * légère, un coffre public, une colonne `photoUrl`. Les séparer aurait donné
 * deux politiques qui divergent, et c'est l'avatar du client qui aurait fini
 * par accepter ce que celui de l'intervenant refuse.
 *
 * **Le chemin est engendré et stable par personne.** Reprendre le même
 * identifiant à chaque dépôt écrase l'ancien portrait : sans cela, chaque
 * changement laisserait un fichier orphelin dans le coffre, et un coffre public
 * qui accumule des visages qu'on croyait remplacés est exactement ce qu'on ne
 * veut pas.
 */

export class PortraitRefuseError extends Error {}

/** Le coffre est-il configuré ? Les écrans le disent plutôt que d'échouer. */
export function portraitDisponible(): boolean {
  return stockageConfigure();
}

async function deposer(
  proprietaireId: string,
  octets: Uint8Array,
): Promise<string> {
  if (!stockageConfigure()) {
    throw new PortraitRefuseError(
      "Le dépôt de photo n'est pas encore ouvert. Appelez-nous, on s'en occupe.",
    );
  }

  try {
    const fichier = await stockage().deposer({
      coffre: "portraits",
      proprietaireId,
      // Stable : le nouveau portrait remplace l'ancien plutôt que de s'ajouter.
      identifiant: "portrait",
      octets,
    });

    if (!estPublic("portraits")) {
      // Garde-fou : si le coffre redevenait privé, l'URL stockée pointerait
      // vers un objet illisible sans que rien ne le signale.
      throw new PortraitRefuseError(
        "Le coffre des portraits n'est plus public.",
      );
    }

    return stockage().urlPublique(fichier.chemin);
  } catch (erreur) {
    if (erreur instanceof FichierRefuseError) {
      throw new PortraitRefuseError(
        erreur.refus === "trop-gros"
          ? "Cette image est trop lourde. Deux mégaoctets au maximum."
          : "Ce fichier n'est pas une image. JPEG, PNG ou WebP.",
      );
    }
    throw erreur;
  }
}

/** Enregistre le portrait d'un client. */
export async function enregistrerLePortraitClient(
  db: TenantClient,
  userId: string,
  octets: Uint8Array,
): Promise<string> {
  const profil = await db.clientProfile.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!profil) throw new PortraitRefuseError("Profil introuvable.");

  const url = await deposer(profil.id, octets);
  await db.clientProfile.update({
    where: { id: profil.id },
    data: { photoUrl: url },
  });
  return url;
}

/** Enregistre le portrait d'un intervenant. */
export async function enregistrerLePortraitIntervenant(
  db: TenantClient,
  userId: string,
  octets: Uint8Array,
): Promise<string> {
  const profil = await db.cleanerProfile.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!profil) throw new PortraitRefuseError("Profil introuvable.");

  const url = await deposer(profil.id, octets);
  await db.cleanerProfile.update({
    where: { id: profil.id },
    data: { photoUrl: url },
  });
  return url;
}

/** Retire le portrait, sans effacer le fichier déjà servi ailleurs. */
export async function retirerLePortraitClient(
  db: TenantClient,
  userId: string,
): Promise<void> {
  await db.clientProfile.updateMany({
    where: { userId },
    data: { photoUrl: null },
  });
}
