import "server-only";

import type { DocumentType } from "@prisma/client";

import { BusinessError } from "@/lib/booking/errors";
import type { TenantClient } from "@/lib/db";
import {
  etatDesPieces,
  peutSoumettreLeDossier,
} from "@/lib/cleaner/etat-compte";
import { FichierRefuseError } from "@/lib/stockage";
import { stockage, stockageConfigure } from "@/lib/stockage/resolution";

/**
 * Le dépôt des pièces du dossier professionnel.
 *
 * **Le coffre est `kyc`, jamais `portraits`.** Une pièce d'identité et un
 * avatar n'ont pas la même politique : le second est public par arbitrage, la
 * première ne sort qu'avec une URL signée de soixante secondes. Les confondre
 * publierait le domicile et le numéro de quelqu'un.
 *
 * **Le chemin est stable par pièce.** Redéposer une attestation d'assurance
 * écrase la précédente : sans cela, un intervenant qui renouvelle chaque année
 * laisserait derrière lui une pile de documents d'identité qu'aucun écran ne
 * montre plus et qu'aucune purge ne connaît.
 *
 * **Déposer remet la pièce en attente.** Une pièce refusée puis redéposée doit
 * repasser devant un humain — garder le refus ferait croire à l'intervenant
 * qu'il a corrigé quelque chose qui reste bloqué.
 */

export class PieceRefuseeError extends BusinessError {}

/** Le coffre est-il configuré ? Les écrans le disent plutôt que d'échouer. */
export function depotDisponible(): boolean {
  return stockageConfigure();
}

export async function deposerUnePiece(
  db: TenantClient,
  userId: string,
  input: { type: DocumentType; octets: Uint8Array; expiresAt: Date | null },
  maintenant: Date = new Date(),
): Promise<void> {
  if (!stockageConfigure()) {
    throw new PieceRefuseeError(
      "Le dépôt de pièces n'est pas encore ouvert. Appelez-nous, on s'en occupe.",
    );
  }

  const profil = await db.cleanerProfile.findFirst({
    where: { userId },
    select: { id: true, organizationId: true },
  });
  if (!profil) throw new PieceRefuseeError("Profil introuvable.");

  let chemin: string;
  try {
    const fichier = await stockage().deposer({
      coffre: "kyc",
      proprietaireId: profil.id,
      // Stable par type : la nouvelle version remplace l'ancienne.
      identifiant: input.type,
      octets: input.octets,
    });
    chemin = fichier.chemin;
  } catch (erreur) {
    if (erreur instanceof FichierRefuseError) {
      throw new PieceRefuseeError(
        erreur.refus === "trop-gros"
          ? "Ce fichier est trop lourd. Vingt mégaoctets au maximum."
          : "Ce format n'est pas accepté. Une photo (JPEG, PNG, WebP) ou un PDF.",
      );
    }
    throw erreur;
  }

  await db.cleanerDocument.upsert({
    where: {
      cleanerProfileId_type: { cleanerProfileId: profil.id, type: input.type },
    },
    update: {
      fileUrl: chemin,
      status: "PENDING",
      expiresAt: input.expiresAt,
      // Le refus précédent n'a plus d'objet : le garder ferait afficher une
      // raison de rejet sous une pièce qu'on vient de remplacer.
      rejectionReason: null,
      verifiedAt: null,
      verifiedById: null,
    },
    create: {
      organizationId: profil.organizationId,
      cleanerProfileId: profil.id,
      type: input.type,
      fileUrl: chemin,
      status: "PENDING",
      expiresAt: input.expiresAt,
    },
  });

  /*
   * Redéposer une pièce après soumission remet le dossier en attente d'envoi :
   * l'examen portait sur ce qui a changé, et le laisser « soumis » ferait
   * croire qu'un humain regarde la nouvelle version.
   */
  await db.cleanerProfile.updateMany({
    where: { id: profil.id, dossierSubmittedAt: { not: null } },
    data: { dossierSubmittedAt: null },
  });

  // L'assurance porte sa date d'expiration sur le profil aussi : c'est elle que
  // lit `activationState`, et deux dates qui divergent feraient afficher un
  // dossier complet avec une attestation périmée.
  if (input.type === "INSURANCE_RC_PRO") {
    await db.cleanerProfile.update({
      where: { id: profil.id },
      data: { insuranceExpiresAt: input.expiresAt },
    });
  }

  void maintenant;
}

/**
 * Soumet le dossier à validation.
 *
 * **Rien n'est envoyé si une pièce manque**, et la vérification se refait ici :
 * l'écran désactive le bouton, mais un écran ne protège rien — la même règle
 * pure décide des deux côtés.
 */
export async function soumettreLeDossier(
  db: TenantClient,
  userId: string,
  maintenant: Date = new Date(),
): Promise<void> {
  const profil = await db.cleanerProfile.findFirst({
    where: { userId },
    select: {
      id: true,
      status: true,
      dossierSubmittedAt: true,
      documents: {
        select: {
          type: true,
          status: true,
          expiresAt: true,
          rejectionReason: true,
        },
      },
    },
  });
  if (!profil) throw new PieceRefuseeError("Profil introuvable.");

  if (profil.dossierSubmittedAt !== null) {
    throw new PieceRefuseeError("Votre dossier est déjà en cours d'examen.");
  }

  const pieces = etatDesPieces(profil.documents, maintenant);
  if (!peutSoumettreLeDossier(pieces)) {
    throw new PieceRefuseeError("Il manque encore des pièces à votre dossier.");
  }

  await db.cleanerProfile.update({
    where: { id: profil.id },
    data: { dossierSubmittedAt: maintenant },
  });
}

/** URL de lecture d'une pièce, valable soixante secondes. */
export async function urlDeLecture(
  db: TenantClient,
  userId: string,
  type: DocumentType,
): Promise<string | null> {
  const document = await db.cleanerDocument.findFirst({
    where: { type, cleaner: { userId } },
    select: { fileUrl: true },
  });
  if (!document) return null;

  return stockage().lireUrl(document.fileUrl);
}
