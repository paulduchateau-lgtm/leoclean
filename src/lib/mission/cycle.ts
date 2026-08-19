/**
 * La vie d'une mission entre l'arrivée et le départ.
 *
 * Module **pur** : il décide, il n'écrit rien. C'est ce qui permet de tester un
 * pointage forcé, une fin sans photo ou une durée aberrante sans monter de
 * base.
 *
 * Jusqu'au 20 août 2026, la vie d'une réservation s'arrêtait à `CONFIRMED` :
 * `IN_PROGRESS`, `COMPLETED` et `NO_SHOW` étaient modélisés et jamais écrits.
 * Sans clôture, il n'y a ni facture, ni avis, ni reversement, ni passage
 * suivant — c'est le maillon qui manquait pour que le service tourne au
 * quotidien.
 */

/** Sens du pointage. */
export type SensPointage = "ARRIVEE" | "DEPART";

/**
 * Tolérance de position, en mètres.
 *
 * Cent cinquante mètres, et **jamais bloquante**. Un intervenant peut être dans
 * un sous-sol, devant un immeuble mal géocodé, ou avoir refusé la localisation
 * à son téléphone. Refuser le pointage dans ces cas-là empêcherait de
 * travailler pour protéger une mesure dont on n'a même pas besoin.
 */
export const TOLERANCE_METRES = 150;

/**
 * Avance maximale d'un pointage d'arrivée.
 *
 * Une heure. Pointer trois heures avant n'est pas une arrivée en avance, c'est
 * une erreur de manipulation — ou un pointage depuis chez soi, ce que la
 * tolérance de position n'attrape pas quand la position est refusée.
 */
export const AVANCE_MAXIMALE_MINUTES = 60;

export type MethodePointage =
  /** Position acceptée et dans la tolérance. */
  | "POSITION"
  /** Position hors tolérance, ou refusée : pointage assumé par la personne. */
  | "MANUEL"
  /** Code à quatre chiffres fourni par le client. */
  | "CODE_CLIENT"
  /** Enregistré hors ligne, synchronisé plus tard. */
  | "HORS_LIGNE";

export type RefusPointage =
  | "MISSION_NON_ACCEPTEE"
  | "TROP_TOT"
  | "DEJA_ARRIVE"
  | "PAS_ENCORE_ARRIVE"
  | "DEJA_TERMINE";

export const MESSAGES_POINTAGE: Record<RefusPointage, string> = {
  MISSION_NON_ACCEPTEE: "Cette mission ne vous est pas attribuée.",
  TROP_TOT:
    "Vous pointez plus d'une heure avant l'heure prévue. Vérifiez la mission.",
  DEJA_ARRIVE: "Vous avez déjà pointé votre arrivée.",
  PAS_ENCORE_ARRIVE: "Pointez votre arrivée avant de terminer.",
  DEJA_TERMINE: "Cette mission est déjà terminée.",
};

export interface EtatMission {
  /** L'intervenant détient-il l'affectation acceptée ? */
  affectee: boolean;
  arriveeA: Date | null;
  departA: Date | null;
  debutPrevu: Date;
}

/** Le pointage est-il recevable ? `null` signifie oui. */
export function verifierPointage(
  sens: SensPointage,
  etat: EtatMission,
  maintenant: Date,
): RefusPointage | null {
  if (!etat.affectee) return "MISSION_NON_ACCEPTEE";
  if (etat.departA) return "DEJA_TERMINE";

  if (sens === "ARRIVEE") {
    if (etat.arriveeA) return "DEJA_ARRIVE";
    const avanceMinutes =
      (etat.debutPrevu.getTime() - maintenant.getTime()) / 60_000;
    if (avanceMinutes > AVANCE_MAXIMALE_MINUTES) return "TROP_TOT";
    return null;
  }

  if (!etat.arriveeA) return "PAS_ENCORE_ARRIVE";
  return null;
}

/**
 * Distance approchée entre deux points, en mètres.
 *
 * Formule équirectangulaire : à l'échelle de quelques centaines de mètres, elle
 * s'écarte de la haversine de moins d'un mètre, et elle coûte trois fois moins
 * cher. La tolérance étant de cent cinquante mètres, la précision n'est pas le
 * sujet.
 */
export function distanceMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const RAYON = 6_371_000;
  const rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * RAYON;
}

/**
 * Quelle méthode retenir pour ce pointage ?
 *
 * La position n'est pas un droit d'entrée, c'est une preuve quand elle est
 * disponible. Sans elle, on n'empêche personne de travailler — on écrit
 * simplement que le pointage a été assumé.
 */
export function methodePointage(input: {
  position: { lat: number; lng: number } | null;
  logement: { lat: number; lng: number };
  codeClientFourni: boolean;
  horsLigne: boolean;
}): { methode: MethodePointage; distanceMetres: number | null } {
  if (input.horsLigne) {
    return {
      methode: "HORS_LIGNE",
      distanceMetres: input.position
        ? Math.round(distanceMetres(input.position, input.logement))
        : null,
    };
  }

  if (input.position) {
    const distance = Math.round(distanceMetres(input.position, input.logement));
    return {
      methode: distance <= TOLERANCE_METRES ? "POSITION" : "MANUEL",
      distanceMetres: distance,
    };
  }

  return {
    methode: input.codeClientFourni ? "CODE_CLIENT" : "MANUEL",
    distanceMetres: null,
  };
}

/**
 * Durée réelle, en minutes.
 *
 * Arrondie à la minute inférieure : compter une minute entamée comme faite
 * gonflerait mécaniquement toutes les durées, et c'est sur cette grandeur que
 * se lisent les écarts d'estimation.
 */
export function dureeReelleMinutes(arrivee: Date, depart: Date): number {
  return Math.max(
    0,
    Math.floor((depart.getTime() - arrivee.getTime()) / 60_000),
  );
}

/**
 * Écart entre durée prévue et durée réelle, en minutes.
 *
 * Positif quand la mission a duré plus longtemps que prévu. **Cet écart ne
 * refacture rien** : le montant reste celui qui a été annoncé, et un ajustement
 * passe par une anomalie validée. Facturer autre chose que ce qui a été affiché
 * serait un changement de contrat.
 */
export function ecartDuree(
  prevueMinutes: number,
  reelleMinutes: number,
): number {
  return reelleMinutes - prevueMinutes;
}

/**
 * Le rapport est-il complet ?
 *
 * Deux photos avant et deux après : le minimum pour qu'un rapport dise quelque
 * chose. **L'incomplétude ne bloque rien** — ni le check-out, ni le paiement.
 * Elle marque la mission et déclenche une relance, parce qu'un intervenant qui
 * ne peut pas terminer sa journée à cause d'une photo manquante finit par
 * photographier n'importe quoi.
 */
export const PHOTOS_MINIMALES_PAR_PHASE = 2;

export function rapportComplet(photos: {
  avant: number;
  apres: number;
}): boolean {
  return (
    photos.avant >= PHOTOS_MINIMALES_PAR_PHASE &&
    photos.apres >= PHOTOS_MINIMALES_PAR_PHASE
  );
}

/** Catégories d'anomalie, reprises du corpus de spécifications. */
export const TYPES_ANOMALIE = [
  "DEGAT_PREEXISTANT",
  "EQUIPEMENT_EN_PANNE",
  "PRODUIT_EPUISE",
  "ACCES_IMPOSSIBLE",
  "LOGEMENT_TRES_SALE",
  "PRESENCE_NON_PREVUE",
] as const;

export type TypeAnomalie = (typeof TYPES_ANOMALIE)[number];

export const LIBELLES_ANOMALIE: Record<TypeAnomalie, string> = {
  DEGAT_PREEXISTANT: "Dégât déjà présent en arrivant",
  EQUIPEMENT_EN_PANNE: "Équipement en panne",
  PRODUIT_EPUISE: "Produit épuisé",
  ACCES_IMPOSSIBLE: "Accès impossible",
  LOGEMENT_TRES_SALE: "Logement inhabituellement sale",
  PRESENCE_NON_PREVUE: "Présence non prévue",
};

/**
 * Une anomalie peut-elle proposer un ajustement de durée ?
 *
 * Une seule le peut — le logement inhabituellement sale — et **la proposition
 * ne facture rien** : elle attend une validation. Un supplément appliqué
 * unilatéralement par la personne qui en bénéficie n'est pas un ajustement,
 * c'est une facture non consentie.
 */
export function peutProposerUnAjustement(type: TypeAnomalie): boolean {
  return type === "LOGEMENT_TRES_SALE";
}
