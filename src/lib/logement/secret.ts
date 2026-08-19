import "server-only";

import { serverEnv } from "@/lib/env";
import { prisma } from "@/lib/db";

import { chiffrer, dansLaFenetre, dechiffrer, deriverClef } from "./chiffrement";

/**
 * Le seul chemin par lequel une consigne d'accès entre et sort.
 *
 * **Aucun autre module ne doit importer ce fichier pour déchiffrer.** Un test
 * le vérifie sur l'arborescence, et ce n'est pas de la coquetterie : un code de
 * porte lu depuis trois endroits finit par être lu depuis un quatrième où
 * personne n'a pensé à la fenêtre temporelle.
 *
 * Trois conditions sont vérifiées **ensemble**, jamais séparément :
 *
 * 1. le demandeur détient une affectation `ACCEPTED` sur une réservation à
 *    cette adresse ;
 * 2. l'instant tombe entre J-24 h et J+2 h de cette mission ;
 * 3. la lecture est journalisée, accordée ou refusée.
 *
 * La troisième n'est pas une garantie de moins que les deux autres : le jour où
 * un client signale une entrée qu'il n'attendait pas, « qui a lu le code, et
 * quand » doit avoir une réponse.
 */

export class SecretIndisponibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretIndisponibleError";
  }
}

/**
 * La clé de chiffrement, ou un refus net.
 *
 * Même direction que le stockage de fichiers, et l'inverse de
 * `TRAVEL_TIME_PROVIDER` : sans clé configurée, on **échoue** plutôt que de
 * dégrader. Un repli qui écrirait en clair serait la pire dégradation
 * imaginable — celle qu'on ne remarque pas.
 */
function clef(): Buffer {
  const secret = serverEnv.ACCESS_SECRET_KEY;
  if (!secret) {
    throw new SecretIndisponibleError(
      "ACCESS_SECRET_KEY n'est pas configurée : les consignes d'accès ne " +
        "peuvent être ni enregistrées ni lues.",
    );
  }
  return deriverClef(secret);
}

/** Le client enregistre ou remplace sa consigne. Il ne la relit jamais. */
export async function enregistrerSecret(
  addressId: string,
  organizationId: string,
  clair: string | null,
): Promise<void> {
  await prisma.address.update({
    where: { id: addressId, organizationId },
    data: clair
      ? {
          /* `Buffer` est un `Uint8Array` : Prisma attend le second. */
          accessSecretEnc: new Uint8Array(chiffrer(clair, clef())),
          accessSecretSetAt: new Date(),
        }
      : { accessSecretEnc: null, accessSecretSetAt: null },
  });
}

export type RefusSecret =
  | "PAS_DE_CONSIGNE"
  | "AUCUNE_MISSION"
  | "HORS_FENETRE"
  | "NON_CONFIGURE";

export interface LectureSecret {
  accorde: boolean;
  consigne: string | null;
  refus: RefusSecret | null;
}

/**
 * Lecture par un intervenant, pour une mission précise.
 *
 * On passe l'identifiant de la réservation plutôt que de chercher « une mission
 * quelconque à cette adresse » : sans cela, une affectation ancienne rouvrirait
 * la fenêtre d'une mission future, et la fenêtre ne voudrait plus rien dire.
 */
export async function lireSecret(
  bookingId: string,
  cleanerProfileId: string,
  maintenant: Date,
): Promise<LectureSecret> {
  const affectation = await prisma.assignment.findFirst({
    where: { bookingId, cleanerProfileId, status: "ACCEPTED" },
    select: {
      startAt: true,
      endAt: true,
      organizationId: true,
      booking: {
        select: {
          addressId: true,
          address: { select: { accessSecretEnc: true } },
        },
      },
    },
  });

  if (!affectation) {
    /*
     * Rien à journaliser : sans affectation, on ne sait même pas de quelle
     * adresse il s'agirait, et écrire une ligne sur une adresse devinée
     * remplirait le journal de bruit. Le refus est rendu, il suffit.
     */
    return { accorde: false, consigne: null, refus: "AUCUNE_MISSION" };
  }

  const contexte = {
    organizationId: affectation.organizationId,
    addressId: affectation.booking.addressId,
    cleanerProfileId,
    bookingId,
  };

  const refuser = async (refus: RefusSecret): Promise<LectureSecret> => {
    await prisma.accessSecretRead.create({
      data: { ...contexte, granted: false, reason: refus },
    });
    return { accorde: false, consigne: null, refus };
  };

  if (
    !dansLaFenetre(
      { debut: affectation.startAt, fin: affectation.endAt },
      maintenant,
    )
  ) {
    return refuser("HORS_FENETRE");
  }

  const paquet = affectation.booking.address.accessSecretEnc;
  if (!paquet) return refuser("PAS_DE_CONSIGNE");

  let consigne: string;
  try {
    consigne = dechiffrer(Buffer.from(paquet), clef());
  } catch {
    return refuser("NON_CONFIGURE");
  }

  await prisma.accessSecretRead.create({
    data: { ...contexte, granted: true },
  });

  return { accorde: true, consigne, refus: null };
}

/** Ce que le client voit de sa propre consigne : qu'elle existe, et depuis quand. */
export async function etatDuSecret(
  addressId: string,
  organizationId: string,
): Promise<{ enregistre: boolean; depuis: Date | null }> {
  const adresse = await prisma.address.findFirst({
    where: { id: addressId, organizationId },
    select: { accessSecretEnc: true, accessSecretSetAt: true },
  });
  return {
    enregistre: Boolean(adresse?.accessSecretEnc),
    depuis: adresse?.accessSecretSetAt ?? null,
  };
}

/** Messages destinés à la personne, pas au journal. */
export const MESSAGES_REFUS_SECRET: Record<RefusSecret, string> = {
  PAS_DE_CONSIGNE: "Aucune consigne d'accès n'a été enregistrée pour ce logement.",
  AUCUNE_MISSION: "Cette mission ne vous est pas attribuée.",
  HORS_FENETRE:
    "La consigne d'accès s'affiche à partir de la veille de l'intervention.",
  NON_CONFIGURE:
    "La consigne d'accès est illisible. Appelez-nous, nous la retrouvons avec le client.",
};
