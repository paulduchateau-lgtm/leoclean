/**
 * Ce qu'un intervenant voit de ses missions.
 *
 * Deux formes, et la différence n'est pas cosmétique : **l'adresse complète et
 * les consignes d'accès n'apparaissent qu'après acceptation.** Avant, la
 * mission se situe par sa commune, sa voie sans numéro et le temps de trajet —
 * de quoi juger si elle tient dans la journée, sans livrer l'adresse d'un
 * client qui n'a pas consenti à ce qu'elle circule chez quelqu'un qui refusera
 * peut-être.
 *
 * Le tri se fait côté serveur, pas à l'affichage : une donnée qu'on ne veut pas
 * montrer ne doit pas voyager jusqu'au navigateur, où il suffirait d'ouvrir les
 * outils de développement pour la lire.
 *
 * Les instants sont sérialisés en ISO : ce sont des propriétés de composant
 * serveur, et un `Date` traverse mal cette frontière.
 */

/** Étape de la journée, telle que l'écran la dessine. */
export interface EtapeVue {
  assignmentId: string;
  debut: string;
  fin: string;
  blocDebut: string;
  blocFin: string;
  trajetAvantMinutes: number;
  trajetApresMinutes: number;
  communeName: string;
  /** Vraie pour la mission dont on examine l'insertion. */
  estLaProposition: boolean;
}

/** Comment la proposition se place dans la journée. */
export interface InsertionVue {
  estIsolee: boolean;
  estSerree: boolean;
  chevauche: boolean;
  battementAvantMinutes: number | null;
  battementApresMinutes: number | null;
  tempsMortMinutes: number;
  /** La journée entière, proposition comprise, dans l'ordre. */
  journee: EtapeVue[];
}

interface MissionCommune {
  assignmentId: string;
  bookingId: string;
  debut: string;
  fin: string;
  dureeMinutes: number;
  communeName: string;
  /** Voie sans son numéro. */
  voie: string;
  trajetAvantMinutes: number;
  trajetApresMinutes: number;
  /** Ce que l'intervenant percevra, en centimes. */
  remunerationCents: number;
  surfaceSqm: number | null;
}

/** Mission proposée, en attente de réponse. */
export interface MissionProposee extends MissionCommune {
  statut: "PROPOSED";
  /** Échéance de réponse : passée, l'affectation part au suivant. */
  repondreAvant: string | null;
  insertion: InsertionVue;
}

/** Mission acceptée : l'adresse et les consignes sont désormais visibles. */
export interface MissionAcceptee extends MissionCommune {
  statut: "ACCEPTED";
  adresseComplete: string;
  accessNotes: string | null;
  clientNotes: string | null;
  clientPrenom: string | null;
}

export interface MissionsIntervenant {
  propositions: MissionProposee[];
  aVenir: MissionAcceptee[];
}
