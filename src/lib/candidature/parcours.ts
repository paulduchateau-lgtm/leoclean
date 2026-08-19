/**
 * Le parcours d'une candidature d'intervenant.
 *
 * Module **pur** : il décrit un état, dit ce qui manque et ce qui vient
 * ensuite. Il n'écrit rien.
 *
 * **Le principe qui gouverne tout le funnel : un candidat sans SIRET n'est pas
 * un candidat disqualifié, c'est un candidat à quatre semaines.** C'est là que
 * se trouve le vivier réel au sud de Bordeaux — quelqu'un qui sait faire le
 * travail mais que l'administratif arrête. Un funnel qui le renvoie à l'étape
 * « votre SIRET ? » se prive de la moitié de son recrutement.
 *
 * Conséquence de conception : **l'attente est un état du parcours, pas une
 * sortie**. Pendant les deux à six semaines que prennent les démarches, le
 * dossier avance sur tout ce qui n'en dépend pas — profil, photo, pièces
 * d'identité, entretien — pour que l'activation ait lieu le jour même de la
 * réception du SIRET.
 */

/**
 * Les statuts du dossier.
 *
 * Ils décrivent où en est la personne, jamais ce qu'on pense d'elle. Aucun ne
 * porte de jugement : `REFUSE` est une décision, pas une qualité.
 */
export const STATUTS = [
  /** Compte créé, éligibilité passée. */
  "COMMENCE",
  "PROFIL_COMPLET",
  /** Démarche d'auto-entreprise envoyée, SIRET attendu. */
  "ATTENTE_SIRET",
  /** Déclaration SAP envoyée, récépissé attendu. */
  "ATTENTE_SAP",
  "PIECES_INCOMPLETES",
  "PIECES_DEPOSEES",
  "PIECES_REFUSEES",
  "ENTRETIEN_PLANIFIE",
  "ENTRETIEN_PASSE",
  "VALIDE",
  "ACTIF",
  "EN_PAUSE",
  "REFUSE",
  "ABANDONNE",
] as const;

export type Statut = (typeof STATUTS)[number];

/** Statuts depuis lesquels plus rien ne bouge sans intervention humaine. */
export const STATUTS_TERMINAUX: readonly Statut[] = [
  "ACTIF",
  "REFUSE",
  "ABANDONNE",
];

export type BrancheStatut = "SIRET_EXISTANT" | "CREATION_AE";
export type BrancheSap = "SAP_EXISTANT" | "SAP_A_DECLARER";

/**
 * Les pièces exigées avant activation.
 *
 * C'est **exactement** la liste promise aux clients sous « professionnels
 * vérifiés » et affichée aux candidats. Trois surfaces, une seule vérité,
 * vérifiable par n'importe qui — c'est la règle que le dépôt tient déjà pour
 * `activationState`.
 */
export const PIECES = [
  "IDENTITE",
  "JUSTIFICATIF_DOMICILE",
  "AVIS_SIRENE",
  "VIGILANCE_URSSAF",
  "RC_PRO",
  "IBAN",
] as const;

export type Piece = (typeof PIECES)[number];

export const LIBELLES_PIECES: Record<Piece, string> = {
  IDENTITE: "Pièce d'identité",
  JUSTIFICATIF_DOMICILE: "Justificatif de domicile",
  AVIS_SIRENE: "Avis de situation SIRENE",
  VIGILANCE_URSSAF: "Attestation de vigilance URSSAF",
  RC_PRO: "Assurance responsabilité civile professionnelle",
  IBAN: "Coordonnées bancaires",
};

/**
 * Pièce dont l'avis SIRENE peut être engendré plutôt que téléversé.
 *
 * L'API Sirene rend l'information ; demander à quelqu'un d'aller la
 * télécharger pour nous la renvoyer est un abandon gratuit dans le funnel.
 */
export const PIECES_ENGENDRABLES: readonly Piece[] = ["AVIS_SIRENE"];

export interface EtatCandidature {
  statut: Statut;
  brancheStatut: BrancheStatut | null;
  brancheSap: BrancheSap | null;
  profilComplet: boolean;
  photoDeposee: boolean;
  siretVerifie: boolean;
  sapVerifie: boolean;
  piecesValidees: readonly Piece[];
  entretienPasse: boolean;
  chartesSignees: boolean;
}

/** Ce qui manque encore, dans l'ordre où on le demandera. */
export function ceQuiManque(etat: EtatCandidature): string[] {
  const manques: string[] = [];

  if (!etat.profilComplet) manques.push("Votre profil");
  if (!etat.photoDeposee) manques.push("Votre photo");
  if (!etat.siretVerifie) manques.push("Votre numéro SIRET");

  for (const piece of PIECES) {
    if (piece === "AVIS_SIRENE" && etat.siretVerifie) continue;
    if (!etat.piecesValidees.includes(piece)) {
      manques.push(LIBELLES_PIECES[piece]);
    }
  }

  if (!etat.entretienPasse) manques.push("L'entretien");
  if (!etat.chartesSignees) manques.push("La signature des documents");

  /*
   * La déclaration SAP vient en dernier, et jamais comme un blocage : elle met
   * des semaines à être instruite, et refuser de faire travailler quelqu'un en
   * attendant reviendrait à ne recruter personne au lancement. C'est la même
   * règle que `CleanerProfile.sapDeclarationNumber`, qui est nullable pour
   * cette raison.
   */
  if (!etat.sapVerifie) manques.push("Votre déclaration SAP (sans blocage)");

  return manques;
}

/**
 * La candidature peut-elle être activée ?
 *
 * **La déclaration SAP n'y figure pas.** Sans elle, la part de cet intervenant
 * n'ouvre aucun crédit d'impôt au client, ce qui se dit en avertissement — mais
 * l'attendre pour activer reviendrait à ne recruter personne pendant les
 * semaines d'instruction.
 */
export function peutEtreActivee(etat: EtatCandidature): boolean {
  const piecesRequises = PIECES.filter(
    (piece) => !(piece === "AVIS_SIRENE" && etat.siretVerifie),
  );

  return (
    etat.profilComplet &&
    etat.photoDeposee &&
    etat.siretVerifie &&
    etat.entretienPasse &&
    etat.chartesSignees &&
    piecesRequises.every((piece) => etat.piecesValidees.includes(piece))
  );
}

/**
 * Progression affichée, en pourcentage.
 *
 * **Les branches longues ne font jamais reculer la barre.** Quelqu'un qui
 * découvre qu'il doit créer une auto-entreprise voit s'ouvrir un sous-parcours
 * avec sa propre progression ; si la barre principale reculait, il lirait
 * « votre dossier a régressé » au moment précis où il a besoin d'être rassuré.
 */
export function progression(etat: EtatCandidature): number {
  const jalons = [
    etat.profilComplet,
    etat.photoDeposee,
    etat.siretVerifie,
    etat.piecesValidees.length >= 3,
    peutEtreActivee(etat) || etat.entretienPasse,
    etat.chartesSignees,
  ];
  const faits = jalons.filter(Boolean).length;
  return Math.round((faits / jalons.length) * 100);
}

/**
 * Relances, par statut.
 *
 * **Contextuelles, jamais génériques.** « Il te manque juste ta RC Pro pour
 * finir » convertit ; « Votre inscription est incomplète » non — la seconde ne
 * dit ni ce qui manque ni combien il reste à faire, et se lit comme un
 * reproche.
 */
export const RELANCES_JOURS: Partial<Record<Statut, readonly number[]>> = {
  COMMENCE: [1, 3, 7],
  PROFIL_COMPLET: [2],
  ATTENTE_SIRET: [7, 14, 21],
  ATTENTE_SAP: [5, 12],
  PIECES_INCOMPLETES: [1, 3, 7],
  PIECES_REFUSEES: [0],
  VALIDE: [1, 3],
};

export function prochaineRelance(
  statut: Statut,
  depuis: Date,
  dejaEnvoyees: number,
): Date | null {
  const jours = RELANCES_JOURS[statut];
  if (!jours) return null;
  const prochain = jours[dejaEnvoyees];
  if (prochain === undefined) return null;
  return new Date(depuis.getTime() + prochain * 86_400_000);
}

/**
 * Délai de traitement promis, en heures ouvrées.
 *
 * Affiché au candidat au moment où il attend. Un délai annoncé et tenu vaut
 * mieux qu'une absence de délai : c'est pendant l'attente qu'on perd les
 * dossiers, et l'incertitude coûte plus cher que la durée.
 */
export const SLA_HEURES: Partial<Record<Statut, number>> = {
  PIECES_DEPOSEES: 24,
  ENTRETIEN_PASSE: 48,
  VALIDE: 24,
};

/**
 * Motifs de refus de pièce, en langage courant.
 *
 * Un code montré à quelqu'un n'explique rien, et un motif vague fait redéposer
 * la même pièce. Chacun dit **quoi refaire**.
 */
export const MOTIFS_REFUS_PIECE = {
  ILLISIBLE: "Le document est flou. Reprenez la photo à plat, en pleine lumière.",
  TRONQUE: "Il manque un bord du document. Cadrez-le en entier.",
  PERIME: "Ce document a expiré. Il en faut un en cours de validité.",
  NOM_DIFFERENT:
    "Le nom du document ne correspond pas à celui que vous avez déclaré.",
  MAUVAIS_DOCUMENT: "Ce n'est pas le document attendu à cet endroit.",
  TROP_ANCIEN: "Ce justificatif date de plus de trois mois.",
  VIGILANCE_PERIMEE:
    "L'attestation de vigilance doit dater de moins de six mois. Retéléchargez-la depuis votre espace auto-entrepreneur.",
  RC_ACTIVITE:
    "Votre assurance ne mentionne pas le nettoyage à domicile. Demandez une attestation qui couvre cette activité.",
  RC_PERIMEE: "Votre attestation d'assurance a expiré.",
  IBAN_TIERS:
    "Le compte n'est pas à votre nom. Nous ne pouvons verser que sur votre propre compte.",
  RECTO_SEUL: "Il manque le verso de la pièce d'identité.",
  AUTRE: "",
} as const;

export type MotifRefusPiece = keyof typeof MOTIFS_REFUS_PIECE;

/**
 * Critères de l'entretien.
 *
 * Notés de 1 à 5, et **la grille existe pour homogénéiser, pas pour classer** :
 * elle sert de trace en cas de contestation, et elle évite qu'une décision
 * repose sur une impression que personne ne saurait redire six mois plus tard.
 */
export const CRITERES_ENTRETIEN = [
  "experience",
  "fiabilite",
  "independance",
  "francais",
  "presentation",
  "motivation",
  "disponibilites",
] as const;

export type CritereEntretien = (typeof CRITERES_ENTRETIEN)[number];

export const LIBELLES_CRITERES: Record<CritereEntretien, string> = {
  experience: "Expérience concrète",
  fiabilite: "Fiabilité",
  independance: "Compréhension du statut d'indépendant",
  francais: "Français opérationnel",
  presentation: "Présentation",
  motivation: "Motivation",
  disponibilites: "Cohérence des disponibilités",
};

/**
 * Signaux d'attention.
 *
 * **Volontairement hors de tout score.** Un doublon d'IBAN ou une incohérence
 * de nom ne se compensent pas par de bons points ailleurs : les mêler à une
 * note ferait passer une fraude derrière une bonne moyenne.
 */
export const SIGNAUX_ATTENTION = [
  "DOUBLON_TELEPHONE",
  "DOUBLON_IBAN",
  "DOUBLON_SIRET",
  "IBAN_AUTRE_NOM",
  "SIRET_RECENT",
  "NOM_INCOHERENT",
  "APE_INATTENDU",
] as const;

export type SignalAttention = (typeof SIGNAUX_ATTENTION)[number];

export const LIBELLES_SIGNAUX: Record<SignalAttention, string> = {
  DOUBLON_TELEPHONE: "Ce téléphone est déjà rattaché à un autre dossier",
  DOUBLON_IBAN: "Cet IBAN est déjà rattaché à un autre dossier",
  DOUBLON_SIRET: "Ce SIRET est déjà rattaché à un autre dossier",
  IBAN_AUTRE_NOM: "Le titulaire du compte n'est pas le candidat",
  SIRET_RECENT: "Établissement créé il y a moins de trois mois",
  NOM_INCOHERENT: "Le nom déclaré diffère de celui des documents",
  APE_INATTENDU: "Le code APE ne correspond pas au nettoyage",
};

/**
 * Ce signal justifie-t-il de suspendre l'examen ?
 *
 * Deux seulement : un compte bancaire au nom d'un tiers, et un IBAN déjà vu
 * ailleurs. Ce sont les deux vecteurs par lesquels quelqu'un se fait payer le
 * travail d'un autre — le reste s'explique en entretien.
 */
export function bloquant(signal: SignalAttention): boolean {
  return signal === "IBAN_AUTRE_NOM" || signal === "DOUBLON_IBAN";
}
