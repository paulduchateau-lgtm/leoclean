import "server-only";

import { BusinessError } from "@/lib/booking/errors";
import { prisma } from "@/lib/db";
import { activationState } from "@/lib/cleaner/activation";
import { etatDesPieces, etatDuCompte } from "@/lib/cleaner/etat-compte";

/**
 * Les comptes intervenants, vus par la plateforme.
 *
 * **La même règle pure que l'écran de l'intervenant décide de son état.** Un
 * back-office qui recalculerait « complet / incomplet » de son côté finirait
 * par activer quelqu'un à qui son propre écran réclame encore une pièce — et
 * c'est l'intervenant qui aurait raison.
 *
 * La lecture traverse les organisations : elle passe donc par le client non
 * cloisonné, et `asPlatformAdmin()` est vérifié à l'entrée de la page, là où
 * cela se lit.
 */

export class ActionRefuseeError extends BusinessError {}

export interface CompteVue {
  cleanerProfileId: string;
  userId: string;
  nom: string;
  email: string;
  organisation: string;
  statut: string;
  /** Ce que l'intervenant lit lui-même en haut de son espace. */
  etatLibelle: string;
  actif: boolean;
  motif: string | null;
  suspensionOrigine: string | null;
  suspensionMotif: string | null;
  dossierSoumisLe: Date | null;
  /** Pièces conformes sur le total exigé. */
  piecesConformes: number;
  piecesTotal: number;
}

/**
 * Les dossiers soumis, du plus ancien au plus récent.
 *
 * L'ordre est celui de la revue de dossier, et pour la même raison : traiter le
 * plus récent laisse indéfiniment au fond de la pile celui qui attend depuis
 * trois semaines, et c'est celui-là qu'on perd.
 */
export async function lireLesComptes(
  filtre: "A_VALIDER" | "TOUS",
  maintenant: Date = new Date(),
): Promise<CompteVue[]> {
  const profils = await prisma.cleanerProfile.findMany({
    where:
      filtre === "A_VALIDER"
        ? { status: "PENDING_VERIFICATION", dossierSubmittedAt: { not: null } }
        : {},
    orderBy:
      filtre === "A_VALIDER"
        ? { dossierSubmittedAt: "asc" }
        : { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      userId: true,
      displayName: true,
      status: true,
      siret: true,
      sapDeclarationNumber: true,
      insuranceExpiresAt: true,
      suspensionOrigin: true,
      suspensionReason: true,
      dossierSubmittedAt: true,
      organization: { select: { name: true } },
      user: { select: { email: true } },
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

  return profils.map((profil) => {
    const activation = activationState({
      siret: profil.siret,
      sapDeclarationNumber: profil.sapDeclarationNumber,
      insuranceExpiresAt: profil.insuranceExpiresAt,
      documents: profil.documents,
      now: maintenant,
    });
    const pieces = etatDesPieces(profil.documents, maintenant);
    const etat = etatDuCompte({
      status: profil.status,
      suspensionOrigine: profil.suspensionOrigin,
      dossierSoumisLe: profil.dossierSubmittedAt,
      activation,
    });

    return {
      cleanerProfileId: profil.id,
      userId: profil.userId,
      nom: profil.displayName,
      email: profil.user.email,
      organisation: profil.organization.name,
      statut: profil.status,
      etatLibelle: etat.libelle,
      actif: etat.actif,
      motif: etat.motif,
      suspensionOrigine: profil.suspensionOrigin,
      suspensionMotif: profil.suspensionReason,
      dossierSoumisLe: profil.dossierSubmittedAt,
      piecesConformes: pieces.filter((piece) => piece.conforme).length,
      piecesTotal: pieces.length,
    };
  });
}

/**
 * Valide un dossier soumis et active le compte.
 *
 * **La même règle pure décide des deux côtés.** L'activation relit
 * `activationState` plutôt que de faire confiance au fait que le dossier ait
 * été soumis : une pièce peut avoir expiré entre la soumission et l'examen, et
 * activer alors quelqu'un dont l'attestation d'assurance vient de périmer, c'est
 * exactement ce que « professionnels vérifiés » promet de ne pas faire.
 *
 * Les pièces déposées passent en `APPROVED` dans la même transaction : les
 * laisser en attente ferait afficher à l'intervenant un dossier « reçu, en
 * attente de vérification » sur un compte déjà actif.
 */
export async function activerUnCompte(
  cleanerProfileId: string,
  valideParId: string,
  maintenant: Date = new Date(),
): Promise<void> {
  const profil = await prisma.cleanerProfile.findUnique({
    where: { id: cleanerProfileId },
    select: {
      id: true,
      siret: true,
      sapDeclarationNumber: true,
      insuranceExpiresAt: true,
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
  if (!profil) throw new ActionRefuseeError("Compte introuvable.");

  const pieces = etatDesPieces(profil.documents, maintenant);
  const manquantes = pieces.filter((piece) => !piece.conforme);
  if (manquantes.length > 0) {
    throw new ActionRefuseeError(
      `Le dossier n'est pas complet : ${manquantes.length} pièce(s) à revoir.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.cleanerDocument.updateMany({
      where: { cleanerProfileId, status: "PENDING" },
      data: {
        status: "APPROVED",
        verifiedAt: maintenant,
        verifiedById: valideParId,
      },
    });

    await tx.cleanerProfile.update({
      where: { id: cleanerProfileId },
      data: {
        status: "ACTIVE",
        activatedAt: maintenant,
        suspensionOrigin: null,
        suspendedAt: null,
        suspensionReason: null,
      },
    });
  });
}

/**
 * Refuse une pièce, avec son motif.
 *
 * Le motif est écrit en langage courant et lu tel quel par l'intervenant : un
 * motif vague fait redéposer la même pièce, et c'est le candidat qui paie
 * l'aller-retour. Le dossier repasse « à soumettre » — l'examen portait sur
 * cette pièce-là.
 */
export async function refuserUnePiece(
  cleanerProfileId: string,
  type: string,
  motif: string,
): Promise<void> {
  const texte = motif.trim();
  if (texte.length < 10) {
    throw new ActionRefuseeError(
      "Écrivez pourquoi : un motif vague fait redéposer la même pièce.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.cleanerDocument.updateMany({
      where: { cleanerProfileId, type: type as never },
      data: { status: "REJECTED", rejectionReason: texte },
    });
    await tx.cleanerProfile.update({
      where: { id: cleanerProfileId },
      data: { dossierSubmittedAt: null },
    });
  });
}

/**
 * Suspend un compte, au nom de la plateforme.
 *
 * **Le motif est exigé.** Une suspension sans motif ne se conteste pas, et
 * c'est celui-là même qui s'affiche à l'intervenant : sans lui, l'écran dirait
 * « appelez-nous » sans que personne, à l'autre bout du fil, sache pourquoi.
 */
export async function suspendreUnCompte(
  cleanerProfileId: string,
  motif: string,
  maintenant: Date = new Date(),
): Promise<void> {
  const texte = motif.trim();
  if (texte.length < 10) {
    throw new ActionRefuseeError(
      "Écrivez le motif : c'est lui que l'intervenant lira, et c'est lui qu'on relira.",
    );
  }

  await prisma.cleanerProfile.update({
    where: { id: cleanerProfileId },
    data: {
      status: "SUSPENDED",
      suspensionOrigin: "PLATFORM",
      suspendedAt: maintenant,
      suspensionReason: texte,
    },
  });
}

/**
 * Lève une suspension de plateforme.
 *
 * On ne rend `ACTIVE` que si le compte l'avait déjà été : rendre actif un
 * dossier jamais validé ferait entrer dans le vivier quelqu'un dont personne
 * n'a vu les pièces.
 */
export async function leverLaSuspension(
  cleanerProfileId: string,
): Promise<void> {
  const profil = await prisma.cleanerProfile.findUnique({
    where: { id: cleanerProfileId },
    select: { suspensionOrigin: true, activatedAt: true },
  });
  if (!profil) throw new ActionRefuseeError("Compte introuvable.");

  if (profil.suspensionOrigin === "CLEANER") {
    throw new ActionRefuseeError(
      "C'est une pause posée par l'intervenant : lui seul la lève, depuis son espace.",
    );
  }

  await prisma.cleanerProfile.update({
    where: { id: cleanerProfileId },
    data: {
      status: profil.activatedAt === null ? "PENDING_VERIFICATION" : "ACTIVE",
      suspensionOrigin: null,
      suspendedAt: null,
      suspensionReason: null,
    },
  });
}

/**
 * Clôt un compte.
 *
 * **On ne supprime pas la ligne, on ferme le compte.** Un intervenant a émis
 * des factures en son nom et perçu des reversements : effacer son profil
 * emporterait en cascade des affectations et des documents que la comptabilité
 * exige de conserver, et laisserait des factures sans émetteur. `INACTIVE` le
 * retire de la plateforme — plus aucune proposition, plus aucun accès — sans
 * rendre irrégulier ce qui a déjà été facturé.
 *
 * L'effacement des données personnelles, lui, passe par la demande RGPD et par
 * un humain, qui sait ce qui peut partir et ce qui doit rester.
 */
export async function cloreUnCompte(
  cleanerProfileId: string,
  motif: string,
  maintenant: Date = new Date(),
): Promise<void> {
  const texte = motif.trim();
  if (texte.length < 10) {
    throw new ActionRefuseeError("Écrivez le motif de la clôture.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.cleanerProfile.update({
      where: { id: cleanerProfileId },
      data: {
        status: "INACTIVE",
        suspensionOrigin: "PLATFORM",
        suspendedAt: maintenant,
        suspensionReason: texte,
      },
    });

    /*
     * Les propositions en cours n'ont plus d'objet : les laisser ouvertes
     * ferait attendre une réponse de quelqu'un qui n'a plus accès à l'écran.
     * Les missions **acceptées** ne sont pas touchées — un client les attend, et
     * c'est un appel, pas une écriture.
     */
    await tx.assignment.updateMany({
      where: { cleanerProfileId, status: "PROPOSED" },
      data: { status: "CANCELLED" },
    });
  });
}
