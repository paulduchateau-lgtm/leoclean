/**
 * Estimation de la durée d'un ménage.
 *
 * Le client indique une surface, pas un nombre d'heures : il ne sait pas
 * combien de temps prend son logement, et lui demander de l'arbitrer est le
 * meilleur moyen de le voir abandonner le tunnel. On propose donc une durée,
 * qu'il reste libre d'ajuster.
 *
 * La durée est le pivot de tout le reste : elle détermine le prix, l'espace
 * occupé dans la tournée de l'intervenant, et donc la faisabilité du créneau.
 */

/** Paramètres d'estimation, portés par chaque prestation du catalogue. */
export interface DurationParameters {
  /** Surface traitée en une heure. Un ménage régulier tourne autour de 25 m². */
  sqmPerHour: number;
  /** Plancher de facturation. Deux heures dans le catalogue standard. */
  minDurationMinutes: number;
}

export interface DurationEstimateInput {
  surfaceSqm: number;
  service: DurationParameters;
  /** Minutes ajoutées par les options retenues (repassage, vitres, four…). */
  optionMinutes?: number;
}

export interface DurationEstimate {
  /** Durée retenue, arrondie et bornée. */
  durationMinutes: number;
  /** Durée brute issue de la surface, avant arrondi et bornes. */
  rawMinutes: number;
  /** La durée a été relevée au plancher de la prestation. */
  clampedToMinimum: boolean;
  /** La durée a été ramenée au plafond d'une journée. */
  clampedToMaximum: boolean;
}

/**
 * Les créneaux sont proposés par pas de trente minutes.
 *
 * Un intervenant ne raisonne pas en minutes isolées, et un planning au pas de
 * cinq minutes serait ingérable comme illisible.
 */
export const SLOT_GRANULARITY_MINUTES = 30;

/**
 * Plafond d'une intervention en une fois.
 *
 * Au-delà de six heures, la prestation cesse d'être réalisable correctement
 * dans la journée par une seule personne. Le tunnel doit alors proposer de
 * répartir sur deux passages plutôt que de vendre une mission intenable.
 */
export const MAX_DURATION_MINUTES = 360;

export function estimateDuration({
  surfaceSqm,
  service,
  optionMinutes = 0,
}: DurationEstimateInput): DurationEstimate {
  if (surfaceSqm <= 0) {
    throw new Error("La surface doit être strictement positive.");
  }
  if (service.sqmPerHour <= 0) {
    throw new Error(
      "Le rendement de la prestation (m² par heure) doit être strictement positif.",
    );
  }

  const rawMinutes = (surfaceSqm / service.sqmPerHour) * 60 + optionMinutes;

  // On arrondit au pas supérieur plutôt qu'au plus proche : mieux vaut prévoir
  // trente minutes de trop que de mettre l'intervenant en retard sur la
  // mission suivante, ce qui pénaliserait toute la tournée.
  const rounded =
    Math.ceil(rawMinutes / SLOT_GRANULARITY_MINUTES) * SLOT_GRANULARITY_MINUTES;

  const flooredToMinimum = Math.max(rounded, service.minDurationMinutes);
  const durationMinutes = Math.min(flooredToMinimum, MAX_DURATION_MINUTES);

  return {
    durationMinutes,
    rawMinutes,
    clampedToMinimum: rounded < service.minDurationMinutes,
    clampedToMaximum: flooredToMinimum > MAX_DURATION_MINUTES,
  };
}

/**
 * Surface qui produit exactement la durée demandée.
 *
 * Le tunnel demande désormais un nombre d'heures et suggère la surface qui va
 * avec, plutôt que l'inverse : personne ne connaît sa surface au mètre près,
 * alors que tout le monde sait dire « deux heures, ça devrait suffire ».
 *
 * Le reste de la chaîne — devis, recherche de créneaux, création de la
 * réservation — continue de parler en surface. C'est cette fonction qui fait
 * le pont, et elle doit être exacte : une surface qui, repassée dans
 * `estimateDuration`, donnerait une autre durée que celle choisie ferait
 * facturer autre chose que ce qui a été affiché.
 *
 * D'où le `floor` et non un arrondi : l'estimation arrondit au pas de trente
 * minutes **supérieur**, si bien qu'il faut viser le haut de l'intervalle qui
 * retombe sur la durée voulue. 3 h 30 vaut 87,5 m² en théorie ; 88 m²
 * donneraient 4 h, 87 m² donnent bien 3 h 30. Un test vérifie l'aller-retour
 * sur tous les pas de la grille.
 */
export function surfaceForDuration(
  durationMinutes: number,
  service: DurationParameters,
): number {
  if (durationMinutes <= 0) {
    throw new Error("La durée doit être strictement positive.");
  }
  return Math.floor((durationMinutes / 60) * service.sqmPerHour);
}

/**
 * Surface indicative affichée en face d'une durée.
 *
 * Ce n'est pas la valeur transmise au serveur mais celle qu'on montre : « idéal
 * pour 75 m² » se lit mieux que « 74 m² », et l'écart d'un mètre carré qui
 * sépare parfois les deux ne change ni la durée ni le prix, qui ne dépendent
 * que de la durée retenue.
 */
export function suggestedSurfaceFor(
  durationMinutes: number,
  service: DurationParameters,
): number {
  return Math.round((durationMinutes / 60) * service.sqmPerHour);
}

/**
 * Durées proposées d'emblée, du plancher au plafond, par pas d'une heure.
 *
 * Six choix au maximum : au-delà, une grille de durées devient un formulaire.
 * Les pas intermédiaires restent accessibles par la saisie libre.
 */
export function wholeHourChoices(service: DurationParameters): number[] {
  const choices: number[] = [];
  for (
    let minutes = Math.max(60, service.minDurationMinutes);
    minutes <= MAX_DURATION_MINUTES;
    minutes += 60
  ) {
    choices.push(minutes);
  }
  return choices;
}

/**
 * Durées proposées autour de l'estimation, pour que le client puisse ajuster.
 *
 * On encadre l'estimation d'un pas de part et d'autre, sans jamais descendre
 * sous le plancher de la prestation ni dépasser le plafond journalier.
 */
export function durationChoices(
  estimate: DurationEstimate,
  service: DurationParameters,
): number[] {
  const candidates = [
    estimate.durationMinutes - SLOT_GRANULARITY_MINUTES,
    estimate.durationMinutes,
    estimate.durationMinutes + SLOT_GRANULARITY_MINUTES,
    estimate.durationMinutes + SLOT_GRANULARITY_MINUTES * 2,
  ];

  return [
    ...new Set(
      candidates.filter(
        (minutes) =>
          minutes >= service.minDurationMinutes &&
          minutes <= MAX_DURATION_MINUTES,
      ),
    ),
  ].sort((a, b) => a - b);
}
