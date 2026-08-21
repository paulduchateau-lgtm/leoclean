/**
 * Les documents qu'un intervenant accepte avant d'être activé.
 *
 * Module **pur**. Trois documents, et chacun existe pour une raison qu'on peut
 * nommer — un consentement groupé à des « conditions » sans contenu ne prouve
 * rien, et c'est précisément ce qu'un juge regarde.
 *
 * **Le mandat de facturation n'est pas une formalité.** Léo Clean établit les
 * factures de l'intervenant en son nom et pour son compte, ce que l'article
 * 289, I-2 du CGI n'autorise **que sous mandat préalable et écrit**. Les
 * factures déjà émises portent la mention « conformément au mandat de
 * facturation accepté par ce dernier » : sans acceptation recueillie, cette
 * mention affirme quelque chose qui n'existe pas.
 *
 * **La version est horodatée avec l'acceptation.** Un document qui change après
 * coup rendrait indémontrable ce qui a été accepté — et c'est exactement ce
 * qu'on aurait à démontrer.
 */

/**
 * Version du jeu de documents.
 *
 * À incrémenter **dès qu'un texte change**, si mince que soit le changement :
 * c'est elle qui dit ce qui a été accepté, et une version figée sur un texte
 * mouvant ne prouve rien. Une acceptation portant une version antérieure devra
 * être renouvelée.
 */
export const VERSION_CHARTES = "2026-08-1";

export type CharteId = "cgu" | "qualite" | "mandat";

export interface Charte {
  id: CharteId;
  titre: string;
  /** Ce à quoi la personne s'engage, en une phrase qu'elle peut redire. */
  engagement: string;
  /** Pourquoi ce document existe. */
  raison: string;
  /** Adresse du texte complet, quand il est publié. */
  href: string | null;
}

export const CHARTES: readonly Charte[] = [
  {
    id: "cgu",
    titre: "Conditions générales d'utilisation",
    engagement:
      "J'interviens en tant qu'indépendant, pour mon propre compte, et je reste libre d'accepter ou de refuser chaque mission.",
    raison:
      "Léo Clean met en relation, elle n'emploie pas. C'est ce qui vous laisse refuser une mission sans avoir à vous justifier.",
    href: "/cgu",
  },
  {
    id: "qualite",
    titre: "Charte de qualité et de sécurité",
    engagement:
      "Je préviens dès que je ne peux pas venir, je respecte le domicile et les consignes d'accès, et je signale ce que j'ai cassé.",
    raison:
      "C'est ce que nous promettons aux clients. Un engagement que personne n'a pris est un engagement que personne ne tient.",
    href: null,
  },
  {
    id: "mandat",
    titre: "Mandat de facturation",
    engagement:
      "J'autorise Léo Clean à établir mes factures en mon nom et pour mon compte, dans une série qui m'est propre.",
    raison:
      "Sans ce mandat, nous ne pouvons pas facturer à votre place — l'article 289 du code général des impôts l'exige par écrit et à l'avance. Vos factures restent les vôtres : c'est votre chiffre d'affaires.",
    href: null,
  },
];

export type RefusSignature =
  "DOCUMENT_NON_ACCEPTE" | "VERSION_INCONNUE" | "DEJA_SIGNE";

export const MESSAGES_SIGNATURE: Record<RefusSignature, string> = {
  DOCUMENT_NON_ACCEPTE:
    "Il faut accepter les trois documents. Chacun engage sur un point différent.",
  VERSION_INCONNUE:
    "Ces documents ont changé depuis l'affichage. Rechargez la page avant d'accepter.",
  DEJA_SIGNE: "Vous avez déjà accepté ces documents.",
};

/**
 * L'acceptation est-elle recevable ?
 *
 * **Les trois documents séparément**, jamais une case unique. Grouper trois
 * engagements distincts sous une seule case rendrait l'acceptation attaquable —
 * le consentement doit être spécifique, et le mandat de facturation n'a rien à
 * voir avec la charte de qualité.
 *
 * La version acceptée est comparée à celle du jour : si les textes ont changé
 * pendant que la page était ouverte, on refuse plutôt que d'enregistrer une
 * acceptation portant sur autre chose que ce qui a été lu.
 */
export function verifierLaSignature(input: {
  acceptes: readonly string[];
  version: string;
  dejaSigneEn: string | null;
}): RefusSignature | null {
  if (input.dejaSigneEn === VERSION_CHARTES) return "DEJA_SIGNE";
  if (input.version !== VERSION_CHARTES) return "VERSION_INCONNUE";

  const manquant = CHARTES.some(
    (charte) => !input.acceptes.includes(charte.id),
  );
  return manquant ? "DOCUMENT_NON_ACCEPTE" : null;
}

/**
 * Une acceptation antérieure vaut-elle encore ?
 *
 * Non dès que la version change. On ne réactive pas quelqu'un sur un
 * consentement donné à un autre texte — c'est le sens même de la version.
 */
export function signatureAJour(versionSignee: string | null): boolean {
  return versionSignee === VERSION_CHARTES;
}
