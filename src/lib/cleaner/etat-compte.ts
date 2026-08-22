import type { DocumentStatus, DocumentType } from "@prisma/client";

import {
  type ActivationState,
  REQUIRED_DOCUMENTS,
} from "@/lib/cleaner/activation";

/**
 * L'état du compte, tel qu'il s'affiche en haut de chaque écran.
 *
 * Module **pur**, et c'est ce qui permet au bandeau, à la page dossier et au
 * back-office de dire exactement la même chose. Un intervenant qui lit
 * « inactif » en tête et « tout est bon » sur son dossier cesse de croire les
 * deux.
 *
 * **Un état inactif doit dire quoi faire.** Un badge rouge qui ne mène nulle
 * part est une punition, pas une information : chaque état porte donc sa
 * phrase et, quand un geste existe, l'écran où l'accomplir. C'est la règle
 * centrale de ce module.
 *
 * **La suspension a une origine, et elle change tout.** Une pause que
 * l'intervenant s'est donnée se reprend d'un bouton ; une suspension décidée
 * par la plateforme ne se lève pas soi-même — proposer le bouton dans ce cas
 * ferait promettre au produit ce qu'il ne tiendra pas.
 */

export type OrigineSuspension = "CLEANER" | "PLATFORM";

/** Ce qui empêche de travailler, ou rien. */
export type MotifInactivite =
  /** Le dossier n'est pas complet : il manque des pièces. */
  | "DOSSIER_INCOMPLET"
  /** Tout est là, mais rien n'a été soumis à la validation. */
  | "DOSSIER_A_SOUMETTRE"
  /** Soumis, en attente d'un humain. */
  | "EN_COURS_EXAMEN"
  /** L'intervenant s'est mis en pause. */
  | "EN_PAUSE"
  /** La plateforme a suspendu le compte. */
  | "SUSPENDU"
  /** Compte clos. */
  | "CLOS";

export interface EtatCompte {
  actif: boolean;
  /** Le mot affiché dans le bandeau : « Actif » ou « Inactif ». */
  libelle: string;
  /** Une phrase qui dit pourquoi, et qui se lit sans contexte. */
  explication: string;
  motif: MotifInactivite | null;
  /** Où aller pour y remédier, quand un geste existe. */
  action: { href: string; libelle: string } | null;
  /** L'intervenant peut-il lever cet état lui-même ? */
  reversibleParLIntervenant: boolean;
}

export interface EntreeEtatCompte {
  status: string;
  suspensionOrigine: OrigineSuspension | null;
  /** Dossier soumis à validation, `null` tant qu'il ne l'a pas été. */
  dossierSoumisLe: Date | null;
  activation: ActivationState;
}

const DOSSIER = { href: "/intervenant/dossier", libelle: "Voir mon dossier" };

export function etatDuCompte(entree: EntreeEtatCompte): EtatCompte {
  /*
   * L'ordre compte : une suspension prime sur l'état du dossier. Quelqu'un que
   * la plateforme a suspendu n'a pas à s'entendre réclamer une attestation
   * d'assurance — ce n'est pas ce qui le bloque, et le lui dire l'enverrait
   * réparer ce qui n'est pas cassé.
   */
  if (entree.status === "SUSPENDED") {
    return entree.suspensionOrigine === "CLEANER"
      ? {
          actif: false,
          libelle: "En pause",
          explication:
            "Vous avez mis votre compte en pause : aucune mission ne vous est proposée. Vous pouvez le réactiver quand vous voulez.",
          motif: "EN_PAUSE",
          action: {
            href: "/intervenant/profil",
            libelle: "Reprendre les missions",
          },
          reversibleParLIntervenant: true,
        }
      : {
          actif: false,
          libelle: "Inactif",
          explication:
            "Votre compte est suspendu par Léo Clean. Appelez-nous : nous vous expliquons ce qui bloque et comment le lever.",
          motif: "SUSPENDU",
          /*
           * Aucun écran ne lève une suspension de plateforme : y renvoyer
           * ferait chercher un bouton qui n'existe pas. Le geste est un appel,
           * et il est écrit dans la phrase.
           */
          action: null,
          reversibleParLIntervenant: false,
        };
  }

  if (entree.status === "INACTIVE") {
    return {
      actif: false,
      libelle: "Inactif",
      explication:
        "Votre compte est clos. Si c'est une erreur, appelez-nous : nous le rouvrons.",
      motif: "CLOS",
      action: null,
      reversibleParLIntervenant: false,
    };
  }

  if (entree.status === "ACTIVE") {
    return {
      actif: true,
      libelle: "Actif",
      explication:
        "Votre dossier est validé : vous recevez les missions de votre secteur.",
      motif: null,
      action: null,
      reversibleParLIntervenant: false,
    };
  }

  // Reste `PENDING_VERIFICATION`, où c'est l'état du dossier qui parle.
  if (!entree.activation.ready) {
    const manquantes = entree.activation.missing.length;
    return {
      actif: false,
      libelle: "Inactif",
      explication:
        manquantes === 1
          ? "Il manque une pièce à votre dossier. Vous ne recevrez pas de mission tant qu'elle n'est pas fournie."
          : `Il manque ${manquantes} pièces à votre dossier. Vous ne recevrez pas de mission tant qu'elles ne sont pas fournies.`,
      motif: "DOSSIER_INCOMPLET",
      action: { href: DOSSIER.href, libelle: "Compléter mon dossier" },
      reversibleParLIntervenant: true,
    };
  }

  if (entree.dossierSoumisLe === null) {
    return {
      actif: false,
      libelle: "Inactif",
      explication:
        "Votre dossier est complet mais n'a pas encore été soumis. Un geste, et nous l'examinons.",
      motif: "DOSSIER_A_SOUMETTRE",
      action: { href: DOSSIER.href, libelle: "Soumettre mon dossier" },
      reversibleParLIntervenant: true,
    };
  }

  return {
    actif: false,
    libelle: "Inactif",
    explication:
      "Votre dossier est en cours d'examen. Nous revenons vers vous sous 48 heures ouvrées.",
    motif: "EN_COURS_EXAMEN",
    action: { href: DOSSIER.href, libelle: "Voir mon dossier" },
    reversibleParLIntervenant: false,
  };
}

/** Ce qu'une pièce vaut à l'écran : une coche verte, ou ce qui cloche. */
export type EtatPiece =
  "VALIDEE" | "EN_ATTENTE_DE_VALIDATION" | "REFUSEE" | "EXPIREE" | "MANQUANTE";

export interface PieceVue {
  type: DocumentType;
  etat: EtatPiece;
  /** Vrai quand rien n'est à faire : c'est ce qui porte la coche verte. */
  conforme: boolean;
  /** Ce que l'intervenant doit comprendre, quand quelque chose cloche. */
  detail: string | null;
  expireLe: Date | null;
}

export interface EntreePiece {
  type: DocumentType;
  status: DocumentStatus;
  expiresAt: Date | null;
  rejectionReason: string | null;
}

/**
 * L'état de chaque pièce exigée, dans l'ordre du dossier.
 *
 * **Toutes les pièces sont rendues, y compris celles qu'on n'a pas.** Une liste
 * qui ne montre que ce qui manque ne dit pas ce qui reste à faire : elle dit ce
 * qui va mal. Montrer les quatre, cochées ou non, transforme un reproche en
 * progression.
 *
 * **Une pièce expirée est traitée comme absente**, et le dit. Le contraire
 * laisserait une coche verte sur une attestation périmée — exactement le cas
 * où le client croit l'intervenant assuré et ne l'est pas.
 */
export function etatDesPieces(
  pieces: readonly EntreePiece[],
  maintenant: Date,
): PieceVue[] {
  const parType = new Map(pieces.map((piece) => [piece.type, piece]));

  return REQUIRED_DOCUMENTS.map((type) => {
    const piece = parType.get(type);

    if (!piece) {
      return {
        type,
        etat: "MANQUANTE" as const,
        conforme: false,
        detail: null,
        expireLe: null,
      };
    }

    const expiree =
      piece.expiresAt !== null &&
      piece.expiresAt.getTime() <= maintenant.getTime();

    if (piece.status === "REJECTED") {
      return {
        type,
        etat: "REFUSEE" as const,
        conforme: false,
        detail:
          piece.rejectionReason ??
          "Cette pièce a été refusée. Envoyez-en une autre.",
        expireLe: piece.expiresAt,
      };
    }

    if (expiree || piece.status === "EXPIRED") {
      return {
        type,
        etat: "EXPIREE" as const,
        conforme: false,
        detail: "Cette pièce n'est plus valide. Envoyez la nouvelle version.",
        expireLe: piece.expiresAt,
      };
    }

    if (piece.status === "APPROVED") {
      return {
        type,
        etat: "VALIDEE" as const,
        conforme: true,
        detail: null,
        expireLe: piece.expiresAt,
      };
    }

    /*
     * `PENDING` : la pièce est là et rien n'est demandé à l'intervenant. Elle
     * est donc **conforme de son point de vue** — lui montrer une croix rouge
     * sur un document qu'il vient d'envoyer le ferait le renvoyer une seconde
     * fois.
     */
    return {
      type,
      etat: "EN_ATTENTE_DE_VALIDATION" as const,
      conforme: true,
      detail: "Reçue, en attente de vérification.",
      expireLe: piece.expiresAt,
    };
  });
}

/**
 * Le dossier peut-il être soumis à validation ?
 *
 * Toutes les pièces déposées, et rien d'expiré ni de refusé. On ne demande pas
 * qu'elles soient déjà validées : c'est précisément ce que la soumission
 * déclenche.
 */
export function peutSoumettreLeDossier(pieces: readonly PieceVue[]): boolean {
  return pieces.length > 0 && pieces.every((piece) => piece.conforme);
}
