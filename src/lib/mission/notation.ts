/**
 * Notation d'une intervention terminée.
 *
 * Module **pur**. Il n'écrit rien, il décide ce qu'une note déclenche.
 *
 * Deux taps : les étoiles, puis des tags. Le commentaire est facultatif, et
 * c'est voulu — un champ libre obligatoire fait chuter le taux de réponse sans
 * rien apprendre de plus qu'une étoile.
 */

/** Tags proposés, repris du corpus. Positifs et négatifs se disent avec les mêmes mots. */
export const TAGS_AVIS = [
  "ponctualite",
  "soin",
  "discretion",
  "initiative",
  "relationnel",
] as const;

export type TagAvis = (typeof TAGS_AVIS)[number];

export const LIBELLES_TAGS: Record<TagAvis, string> = {
  ponctualite: "Ponctualité",
  soin: "Soin du détail",
  discretion: "Discrétion",
  initiative: "Prend des initiatives",
  relationnel: "Agréable",
};

/**
 * Seuil au-dessous duquel un avis ouvre un ticket qualité.
 *
 * Trois étoiles ou moins. Ce n'est pas une note « moyenne » qu'on laisse
 * passer : un client qui prend le temps de mettre trois étoiles a quelque chose
 * à dire, et le lui demander le jour même vaut mieux que de le découvrir à la
 * résiliation.
 */
export const SEUIL_TICKET_QUALITE = 3;

export type CategorieInsatisfaction =
  | "PROPRETE"
  | "RETARD"
  | "COMPORTEMENT"
  | "CASSE"
  | "AUTRE";

export const LIBELLES_INSATISFACTION: Record<CategorieInsatisfaction, string> = {
  PROPRETE: "Le ménage n'était pas à la hauteur",
  RETARD: "Retard ou horaire non respecté",
  COMPORTEMENT: "Comportement",
  CASSE: "Quelque chose a été abîmé",
  AUTRE: "Autre chose",
};

export type RefusAvis =
  | "MISSION_NON_TERMINEE"
  | "DEJA_NOTEE"
  | "NOTE_INVALIDE"
  | "TROP_TARD";

export const MESSAGES_AVIS: Record<RefusAvis, string> = {
  MISSION_NON_TERMINEE: "Cette intervention n'est pas encore terminée.",
  DEJA_NOTEE: "Vous avez déjà noté cette intervention.",
  NOTE_INVALIDE: "La note va de une à cinq étoiles.",
  TROP_TARD:
    "Le délai pour noter cette intervention est passé. Écrivez-nous si quelque chose n'allait pas.",
};

/**
 * Délai pour noter, en jours.
 *
 * Trente jours. Au-delà, le souvenir est reconstruit et la note dit surtout
 * l'humeur du moment ; laisser la porte ouverte indéfiniment ferait remonter
 * des avis qu'aucune action ne peut plus rattraper.
 */
export const DELAI_NOTATION_JOURS = 30;

export function verifierAvis(input: {
  terminee: boolean;
  termineeLe: Date | null;
  dejaNotee: boolean;
  etoiles: number;
  maintenant: Date;
}): RefusAvis | null {
  if (!input.terminee || !input.termineeLe) return "MISSION_NON_TERMINEE";
  if (input.dejaNotee) return "DEJA_NOTEE";
  if (!Number.isInteger(input.etoiles) || input.etoiles < 1 || input.etoiles > 5) {
    return "NOTE_INVALIDE";
  }

  const jours =
    (input.maintenant.getTime() - input.termineeLe.getTime()) / 86_400_000;
  if (jours > DELAI_NOTATION_JOURS) return "TROP_TARD";

  return null;
}

/**
 * Cet avis ouvre-t-il un ticket qualité ?
 *
 * La règle est volontairement simple et sans exception : trois étoiles ou moins
 * appellent quelqu'un. Un seuil modulé par l'ancienneté du client ou la note
 * moyenne de l'intervenant serait un seuil que personne ne saurait expliquer à
 * celui qui en fait les frais.
 */
export function ouvreUnTicketQualite(etoiles: number): boolean {
  return etoiles <= SEUIL_TICKET_QUALITE;
}

/**
 * Un avis est-il publiable ?
 *
 * Seuls les avis accompagnés d'un commentaire ont un intérêt public : une
 * étoile nue ne dit rien à personne et gonfle un compteur. Et rien n'est publié
 * sous trois étoiles — non pour cacher, mais parce qu'un avis négatif se traite
 * avant de s'afficher, et que l'afficher pendant qu'on le traite mettrait
 * l'intervenant en cause avant toute vérification.
 */
export function estPubliable(etoiles: number, commentaire: string | null): boolean {
  return etoiles > SEUIL_TICKET_QUALITE && Boolean(commentaire?.trim());
}
