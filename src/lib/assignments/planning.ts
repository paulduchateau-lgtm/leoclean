import { parisDayKey } from "@/lib/time";

/**
 * Comment une mission proposée s'insère dans la journée de l'intervenant.
 *
 * Le produit ne demande pas « voulez-vous ce créneau ? » mais « est-ce que ça
 * tient ? ». Un mardi de 12 h 15 à 15 h 15 ne se juge pas seul : il se juge
 * entre ce qui le précède et ce qui le suit, temps de route compris. Une
 * mission qui laisse deux heures mortes au milieu de la journée coûte cher à
 * quelqu'un qui est payé à l'heure travaillée.
 *
 * Ce module est **pur** : aucune base, aucune horloge, aucun fuseau implicite.
 * Il reçoit des instants et rend une lecture. C'est ce qui permet de vérifier
 * en quelques millisecondes une journée serrée, une mission isolée ou un
 * chevauchement que la base refuserait.
 *
 * **Les bornes de blocage font foi, pas celles de la prestation.**
 * `blocDebut`/`blocFin` étendent le créneau des tampons de trajet, et c'est
 * cette grandeur que protège la contrainte d'exclusion en base. Raisonner sur
 * les heures de ménage donnerait des trous là où il n'y a que de la route.
 */

/** Une étape de la journée : mission acceptée, ou proposition à l'étude. */
export interface EtapeJournee {
  assignmentId: string;
  /** Début et fin de la prestation elle-même. */
  debut: Date;
  fin: Date;
  /** Bornes réellement bloquées, tampons de trajet compris. */
  blocDebut: Date;
  blocFin: Date;
  trajetAvantMinutes: number;
  trajetApresMinutes: number;
  communeName: string;
}

/**
 * Battement en deçà duquel une insertion est dite serrée.
 *
 * Zéro minute signifie que les tampons de trajet se touchent : la journée est
 * réalisable, mais sans marge pour un embouteillage ou un client qui retient
 * cinq minutes sur le pas de la porte. On le signale sans l'interdire — c'est
 * à l'intervenant de juger, pas à la plateforme de décider pour lui.
 */
export const BATTEMENT_SERRE_MINUTES = 15;

export interface Insertion {
  /** Rien d'autre ce jour-là : un aller-retour pour une seule prestation. */
  estIsolee: boolean;
  /** Étape qui précède immédiatement, le même jour. */
  precedente: EtapeJournee | null;
  suivante: EtapeJournee | null;
  /** Minutes libres entre la fin du bloc précédent et le début de celui-ci. */
  battementAvantMinutes: number | null;
  battementApresMinutes: number | null;
  /** L'un des deux battements est nul ou presque. */
  estSerree: boolean;
  /**
   * Temps mort de la journée, en minutes : les creux entre deux blocs, qui ne
   * sont ni du ménage ni de la route, et que personne ne paie.
   */
  tempsMortMinutes: number;
  /** La proposition chevauche une étape déjà acceptée. */
  chevauche: boolean;
}

function minutesEntre(depuis: Date, jusqu: Date): number {
  return Math.round((jusqu.getTime() - depuis.getTime()) / 60_000);
}

/** Étapes du même jour civil français que l'instant donné, triées. */
export function etapesDuJour(
  etapes: readonly EtapeJournee[],
  jour: Date,
): EtapeJournee[] {
  const cle = parisDayKey(jour);
  return etapes
    .filter((etape) => parisDayKey(etape.debut) === cle)
    .sort((a, b) => a.blocDebut.getTime() - b.blocDebut.getTime());
}

/**
 * Situe une proposition parmi les missions déjà acceptées du même jour.
 *
 * La journée est le bon horizon, et rien de plus : traiter comme « étape
 * suivante » une mission située trois jours plus tard ferait calculer un
 * battement entre deux journées que personne n'enchaîne.
 */
export function analyserInsertion(
  proposition: EtapeJournee,
  autresEtapes: readonly EtapeJournee[],
): Insertion {
  const memeJour = etapesDuJour(autresEtapes, proposition.debut).filter(
    (etape) => etape.assignmentId !== proposition.assignmentId,
  );

  const precedente =
    [...memeJour]
      .reverse()
      .find((etape) => etape.blocFin <= proposition.blocDebut) ?? null;
  const suivante =
    memeJour.find((etape) => etape.blocDebut >= proposition.blocFin) ?? null;

  const battementAvantMinutes = precedente
    ? minutesEntre(precedente.blocFin, proposition.blocDebut)
    : null;
  const battementApresMinutes = suivante
    ? minutesEntre(proposition.blocFin, suivante.blocDebut)
    : null;

  // Un chevauchement ne devrait jamais arriver — la contrainte d'exclusion en
  // base l'interdit — mais l'écran ne doit pas mentir si la donnée est
  // incohérente : mieux vaut l'afficher que le taire.
  const chevauche = memeJour.some(
    (etape) =>
      etape.blocDebut < proposition.blocFin &&
      proposition.blocDebut < etape.blocFin,
  );

  const avecProposition = [...memeJour, proposition].sort(
    (a, b) => a.blocDebut.getTime() - b.blocDebut.getTime(),
  );
  let tempsMortMinutes = 0;
  for (let index = 1; index < avecProposition.length; index += 1) {
    const creux = minutesEntre(
      avecProposition[index - 1]!.blocFin,
      avecProposition[index]!.blocDebut,
    );
    if (creux > 0) {
      tempsMortMinutes += creux;
    }
  }

  const estSerree = [battementAvantMinutes, battementApresMinutes].some(
    (battement) => battement !== null && battement <= BATTEMENT_SERRE_MINUTES,
  );

  return {
    estIsolee: memeJour.length === 0,
    precedente,
    suivante,
    battementAvantMinutes,
    battementApresMinutes,
    estSerree,
    tempsMortMinutes,
    chevauche,
  };
}

/**
 * Voie sans son numéro : « 2 ter rue Camille Desmoulins » → « rue Camille
 * Desmoulins ».
 *
 * C'est ce que voit l'intervenant avant d'accepter. Le numéro est ce qui
 * désigne un foyer ; la voie situe le trajet sans livrer l'adresse de
 * quelqu'un qui n'a pas consenti à ce qu'elle circule chez une personne qui
 * refusera peut-être la mission.
 */
export function voieSansNumero(rue: string): string {
  const sansNumero = rue
    .trim()
    .replace(/^\d+\s*(bis|ter|quater|quinquies)?\b[\s,]*/i, "");
  // Une voie qui n'était qu'un numéro ne doit pas devenir une chaîne vide :
  // on rend alors la saisie telle quelle, faute de mieux.
  return sansNumero.length > 0 ? sansNumero : rue.trim();
}
