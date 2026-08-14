/**
 * Score d'attribution.
 *
 * L'attribution est automatique : le client choisit une heure, jamais une
 * personne. C'est ce score qui choisit à sa place, et il doit rester
 * explicable — `Assignment.scoreBreakdown` conserve sa décomposition pour
 * qu'une décision contestée puisse être relue plutôt que devinée.
 *
 * Chaque composante est ramenée à `[0, 1]`, où 1 est le meilleur cas, puis
 * pondérée. Aucun score ne peut donc sortir de `[0, 1]`, et changer une
 * pondération ne change pas l'échelle des autres.
 */

export interface ScoreInput {
  /** Minutes de route ajoutées à la tournée par cette mission. */
  insertionCostMinutes: number;
  ratingAverage: number;
  ratingCount: number;
  /** Part des propositions acceptées, dans `[0, 1]`. */
  acceptanceRate: number;
  /** Minutes déjà attribuées sur la période de référence. */
  assignedMinutesInPeriod: number;
  /** L'intervenant est déjà celui de ce client — abonnement ou historique. */
  isPreferred: boolean;
}

export interface ScoreBreakdown {
  travel: number;
  continuity: number;
  rating: number;
  acceptance: number;
  fairness: number;
}

/**
 * Pondérations.
 *
 * Le trajet domine, et ce n'est pas une préférence esthétique : c'est la seule
 * composante qui coûte de l'argent et de la fatigue à quelqu'un. Vingt minutes
 * de route en plus, c'est vingt minutes non payées pour l'intervenant et une
 * heure vendable perdue pour la plateforme.
 *
 * La continuité vient juste après, parce que « le même intervenant chaque
 * semaine » est la promesse commerciale centrale de Léo Clean : la rompre pour
 * gagner cinq minutes de route serait un mauvais échange.
 *
 * L'équité de charge pèse peu mais n'est pas nulle. Sans elle, les mieux notés
 * capteraient tout et les nouveaux ne démarreraient jamais — un score qui
 * s'auto-renforce finit par assécher son propre vivier.
 */
export const SCORE_WEIGHTS: Readonly<ScoreBreakdown> = {
  travel: 0.4,
  continuity: 0.25,
  rating: 0.15,
  acceptance: 0.1,
  fairness: 0.1,
};

/**
 * Coût de trajet au-delà duquel une insertion vaut zéro.
 *
 * Une heure de route ajoutée pour une mission de deux heures n'est pas une
 * mauvaise attribution : c'est une attribution qui ne devrait pas exister. Le
 * plafond évite qu'un excellent intervenant très éloigné l'emporte sur un bon
 * intervenant du village.
 */
export const MAX_INSERTION_COST_MINUTES = 60;

/** Charge de référence servant à mesurer l'équité, en minutes par semaine. */
export const FAIRNESS_REFERENCE_MINUTES = 35 * 60;

/**
 * Note attribuée à un intervenant sans avis.
 *
 * Neutre plutôt que nulle : un intervenant qui vient d'arriver n'a pas démérité
 * et doit pouvoir recevoir une première mission. Le mettre à zéro reviendrait à
 * le sanctionner pour n'avoir pas encore travaillé.
 */
export const NEUTRAL_RATING_SCORE = 0.5;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function scoreBreakdown(input: ScoreInput): ScoreBreakdown {
  return {
    travel: clamp01(
      1 - input.insertionCostMinutes / MAX_INSERTION_COST_MINUTES,
    ),
    continuity: input.isPreferred ? 1 : 0,
    rating:
      input.ratingCount === 0
        ? NEUTRAL_RATING_SCORE
        : // Une note sur 5 ramenée à [0, 1] : 1 étoile vaut 0, 5 étoiles valent 1.
          clamp01((input.ratingAverage - 1) / 4),
    acceptance: clamp01(input.acceptanceRate),
    fairness: clamp01(
      1 - input.assignedMinutesInPeriod / FAIRNESS_REFERENCE_MINUTES,
    ),
  };
}

/** Score global dans `[0, 1]`, avec sa décomposition. */
export function scoreAssignment(input: ScoreInput): {
  score: number;
  breakdown: ScoreBreakdown;
} {
  const breakdown = scoreBreakdown(input);
  const score = (Object.keys(SCORE_WEIGHTS) as (keyof ScoreBreakdown)[]).reduce(
    (total, key) => total + breakdown[key] * SCORE_WEIGHTS[key],
    0,
  );

  // Le score sert à trier et à s'expliquer, pas à calculer : quatre décimales
  // suffisent et évitent de conserver du bruit flottant en base.
  return { score: Math.round(score * 10_000) / 10_000, breakdown };
}
