import "server-only";

import { BusinessError } from "@/lib/booking/errors";
import type { TenantClient } from "@/lib/db";

/**
 * Mettre un compte en pause, et le reprendre.
 *
 * **Une pause n'est pas une suspension**, et le produit ne doit jamais les
 * confondre. L'intervenant se met en pause : c'est son droit, il la lève quand
 * il veut, et personne ne lui demande pourquoi. La plateforme suspend : c'est
 * une décision qui le concerne mais ne lui appartient pas, et il ne peut pas la
 * lever seul. Les deux rendent le compte inactif, et c'est la seule chose
 * qu'elles partagent.
 *
 * **Se mettre en pause n'annule aucune mission acceptée.** C'est la même règle
 * que les absences : une pause change ce qui **sera** proposé ; se dégager d'un
 * engagement déjà pris regarde aussi le client, et passe par un appel. L'écran
 * le dit, et compte les missions concernées plutôt que de les effacer.
 */

export class SuspensionRefuseeError extends BusinessError {}

/** Les missions à venir qu'une pause ne retire pas. */
export async function missionsQueLaPauseNeRetirePas(
  db: TenantClient,
  userId: string,
  maintenant: Date = new Date(),
): Promise<number> {
  return db.assignment.count({
    where: {
      cleaner: { userId },
      status: "ACCEPTED",
      startAt: { gt: maintenant },
    },
  });
}

/**
 * L'intervenant met son compte en pause.
 *
 * Refusé sur un compte suspendu par la plateforme : il est déjà inactif, et
 * accepter écraserait l'origine — le compte deviendrait réversible d'un bouton
 * par celui-là même que la plateforme vient d'écarter.
 */
export async function mettreEnPause(
  db: TenantClient,
  userId: string,
  maintenant: Date = new Date(),
): Promise<void> {
  const profil = await db.cleanerProfile.findFirst({
    where: { userId },
    select: { id: true, status: true, suspensionOrigin: true },
  });
  if (!profil) throw new SuspensionRefuseeError("Profil introuvable.");

  if (profil.suspensionOrigin === "PLATFORM") {
    throw new SuspensionRefuseeError(
      "Votre compte est suspendu par Léo Clean. Appelez-nous.",
    );
  }
  if (profil.status === "INACTIVE") {
    throw new SuspensionRefuseeError("Votre compte est clos.");
  }

  await db.cleanerProfile.update({
    where: { id: profil.id },
    data: {
      status: "SUSPENDED",
      suspensionOrigin: "CLEANER",
      suspendedAt: maintenant,
      // Aucun motif : on ne demande pas à quelqu'un de justifier une pause.
      suspensionReason: null,
    },
  });
}

/**
 * L'intervenant reprend les missions.
 *
 * **On ne revient pas forcément à `ACTIVE`.** Quelqu'un qui s'était mis en
 * pause avant d'être validé retourne en `PENDING_VERIFICATION` : le sortir de
 * pause ne vaut pas validation de dossier, et l'écrire `ACTIVE` ferait entrer
 * dans le vivier quelqu'un dont les pièces n'ont jamais été vues.
 */
export async function reprendreLesMissions(
  db: TenantClient,
  userId: string,
): Promise<void> {
  const profil = await db.cleanerProfile.findFirst({
    where: { userId },
    select: { id: true, suspensionOrigin: true, activatedAt: true },
  });
  if (!profil) throw new SuspensionRefuseeError("Profil introuvable.");

  if (profil.suspensionOrigin !== "CLEANER") {
    throw new SuspensionRefuseeError(
      "Seule une pause que vous avez posée peut être levée ici.",
    );
  }

  await db.cleanerProfile.update({
    where: { id: profil.id },
    data: {
      status: profil.activatedAt === null ? "PENDING_VERIFICATION" : "ACTIVE",
      suspensionOrigin: null,
      suspendedAt: null,
      suspensionReason: null,
    },
  });
}
