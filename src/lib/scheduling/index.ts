/**
 * Moteur de disponibilité et de tournée.
 *
 * Tout ce qui est exporté ici est **pur** : aucune lecture de base, aucun appel
 * réseau, aucune dépendance à l'horloge autre que celle qu'on lui passe. C'est
 * ce qui permet de tester en quelques millisecondes des situations qu'on ne
 * saurait pas reproduire autrement — une nuit de changement d'heure, un agenda
 * externe qui recouvre une mission, une tournée impossible de vingt minutes.
 *
 * Le chargement des données vit à côté, dans `repository.ts`, marqué
 * `server-only`. La séparation est délibérée : le jour où la disponibilité sera
 * recalculée dans un travail de fond ou dans un webhook d'agenda, c'est le même
 * calcul qui devra s'appliquer.
 */

export {
  type Interval,
  MINUTE_MS,
  atLeast,
  clampTo,
  contains,
  durationMinutes,
  expand,
  interval,
  intersect,
  normalize,
  overlaps,
  subtract,
  toDates,
  totalMinutes,
  union,
} from "./intervals";

export {
  type AvailabilityExceptionInput,
  type AvailabilityInput,
  type BookedAssignment,
  type WeeklyAvailabilityRule,
  computeAvailability,
  fitsInAvailability,
} from "./availability";

export {
  type GeoPoint,
  type TravelEstimate,
  type TravelMatrix,
  type TravelTimeProvider,
  OBSERVED_AVERAGE_SPEED_KMH,
  OBSERVED_DETOUR_FACTOR,
  TRAVEL_BUFFER_STEP_MINUTES,
  estimateTravelMinutes,
  geometricTravelMatrix,
  geometricTravelTimeProvider,
  roundTravelBuffer,
  travelKey,
  travelMatrixFrom,
} from "./travel";

export {
  type ScoreBreakdown,
  type ScoreInput,
  FAIRNESS_REFERENCE_MINUTES,
  MAX_INSERTION_COST_MINUTES,
  NEUTRAL_RATING_SCORE,
  SCORE_WEIGHTS,
  scoreAssignment,
  scoreBreakdown,
} from "./scoring";

export {
  type CleanerSchedule,
  type RoundStop,
  type SlotCandidate,
  type SlotRequest,
  DEFAULT_LEAD_TIME_MINUTES,
  DEFAULT_SLOT_STEP_MINUTES,
  evaluateSlot,
  findSlots,
  insertionCostMinutes,
} from "./slots";
