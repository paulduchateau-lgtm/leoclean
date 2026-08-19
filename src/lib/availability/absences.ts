/**
 * Absences déclarées d'un intervenant.
 *
 * Le moteur de disponibilité lit les `AvailabilityException` depuis toujours et
 * les fait gagner sur les ouvertures exceptionnelles — poser une absence est un
 * acte délibéré, une ouverture peut n'être qu'un reliquat. Mais **rien ne les
 * écrivait** : un intervenant en congé continuait de recevoir des propositions,
 * et le seul moyen de s'en sortir était de refuser une à une des missions qu'on
 * n'aurait jamais dû lui proposer.
 *
 * Module **pur** : il valide et normalise, sans base ni horloge implicite.
 * L'instant courant est toujours passé en paramètre, faute de quoi un test ne
 * pourrait pas décrire « la veille d'un départ en vacances ».
 *
 * Les instants manipulés ici sont en UTC, comme partout ailleurs dans le dépôt.
 * La conversion depuis ce que la personne a saisi — des dates françaises —
 * appartient à l'appelant et passe par `time.ts`.
 */

/** Une absence, bornes `[debut, fin)` comme partout dans le moteur. */
export interface Absence {
  debut: Date;
  fin: Date;
}

/**
 * Durée maximale d'une absence.
 *
 * Au-delà d'un an, ce n'est plus une absence, c'est un arrêt d'activité — et
 * cela se traduit par un changement de statut, pas par une exception qui
 * traînerait dans le planning. Distinguer les deux évite qu'un compte cesse
 * silencieusement d'être appelé sans que personne sache pourquoi.
 */
export const DUREE_MAXIMALE_JOURS = 366;

/**
 * Nombre d'absences vivantes qu'une personne peut déclarer.
 *
 * Ce n'est pas une limite de droit — personne ne restreint les congés d'un
 * indépendant — c'est une limite d'écran : au-delà, la liste devient illisible
 * et les chevauchements indétectables à l'œil.
 */
export const MAXIMUM_ABSENCES = 40;

export type ErreurAbsence =
  | "ordre"
  | "passee"
  | "trop-longue"
  | "chevauchement"
  | "trop-nombreuses";

/** Message destiné à la personne, pas au journal d'erreurs. */
export const MESSAGES_ABSENCE: Record<ErreurAbsence, string> = {
  ordre: "La date de fin doit venir après la date de début.",
  passee:
    "Cette période est déjà passée. Une absence ne change que les missions à venir.",
  "trop-longue":
    "Au-delà d'un an, prévenez-nous plutôt : ce n'est plus une absence, c'est une pause d'activité.",
  chevauchement: "Vous avez déjà déclaré une absence sur cette période.",
  "trop-nombreuses":
    "Vous avez atteint le nombre maximal d'absences enregistrées. Supprimez-en une avant d'en ajouter.",
};

const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Vérifie une absence avant de l'enregistrer.
 *
 * Rend l'erreur plutôt qu'un booléen : l'écran doit pouvoir dire ce qui cloche,
 * sans quoi la personne corrige au hasard. `null` signifie que l'absence peut
 * être posée.
 *
 * Une absence **déjà commencée** est acceptée : quelqu'un qui tombe malade un
 * mardi matin doit pouvoir se retirer du reste de la semaine. Seule une période
 * entièrement révolue est refusée, parce qu'elle ne changerait rien.
 */
export function verifierAbsence(
  absence: Absence,
  existantes: readonly Absence[],
  maintenant: Date,
): ErreurAbsence | null {
  if (absence.fin.getTime() <= absence.debut.getTime()) {
    return "ordre";
  }

  if (absence.fin.getTime() <= maintenant.getTime()) {
    return "passee";
  }

  if (absence.fin.getTime() - absence.debut.getTime() > DUREE_MAXIMALE_JOURS * JOUR_MS) {
    return "trop-longue";
  }

  if (existantes.length >= MAXIMUM_ABSENCES) {
    return "trop-nombreuses";
  }

  if (existantes.some((autre) => seChevauchent(absence, autre))) {
    return "chevauchement";
  }

  return null;
}

/**
 * Deux périodes se chevauchent-elles ?
 *
 * Bornes `[debut, fin)`, la même convention que le moteur de disponibilité :
 * une absence qui finit à midi laisse midi libre. Sans cette convention, deux
 * absences jointives — le 1ᵉʳ au 7, puis le 7 au 14 — seraient refusées pour un
 * conflit d'une milliseconde.
 */
export function seChevauchent(a: Absence, b: Absence): boolean {
  return a.debut.getTime() < b.fin.getTime() && b.debut.getTime() < a.fin.getTime();
}

/**
 * Les absences encore utiles à afficher.
 *
 * Une absence révolue n'a plus d'effet sur rien. La garder à l'écran ferait
 * grossir une liste que personne ne relit, et la limite ci-dessus finirait par
 * bloquer sur de l'histoire ancienne.
 */
export function absencesVivantes<T extends Absence>(
  absences: readonly T[],
  maintenant: Date,
): T[] {
  return absences
    .filter((absence) => absence.fin.getTime() > maintenant.getTime())
    .sort((a, b) => a.debut.getTime() - b.debut.getTime());
}

/** Une absence recouvre-t-elle une mission ? Même convention de bornes. */
export function recouvre(
  absence: Absence,
  mission: { debut: Date; fin: Date },
): boolean {
  return seChevauchent(absence, { debut: mission.debut, fin: mission.fin });
}

/**
 * Nombre de jours civils couverts, pour l'affichage.
 *
 * Compté sur la durée et non sur les dates de calendrier : une absence est
 * toujours posée du début d'un jour à la fin d'un autre par l'écran, et les
 * changements d'heure ne doivent pas faire afficher « 6,96 jours ».
 */
export function joursCouverts(absence: Absence): number {
  return Math.max(
    1,
    Math.round((absence.fin.getTime() - absence.debut.getTime()) / JOUR_MS),
  );
}
