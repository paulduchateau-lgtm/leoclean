import { haversineKm } from "../territory";

/**
 * Temps de trajet.
 *
 * Le temps de route est la grandeur qui décide de tout dans ce produit : ce
 * qu'on peut vendre, à qui on l'attribue, et si la journée d'un intervenant est
 * tenable. Il est donc modélisé comme une dépendance remplaçable, jamais
 * calculé à la volée au fil du code.
 *
 * Trois implémentations coexistent, dans cet ordre de préférence :
 *
 * 1. un service de calcul d'itinéraire réel, appelé derrière un cache ;
 * 2. le cache seul, quand le service est indisponible ;
 * 3. `estimateTravelMinutes`, l'estimation géométrique ci-dessous, qui ne
 *    tombe jamais en panne.
 *
 * Le repli n'est pas un détail d'implémentation : un service d'itinéraire en
 * panne ne doit pas fermer la réservation. Il doit dégrader la précision, pas
 * la disponibilité.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface TravelEstimate {
  /** Durée de porte à porte, en minutes, arrondie à l'entier supérieur. */
  durationMinutes: number;
  distanceMeters: number;
  /** Nom du fournisseur, conservé pour l'audit et le cache. */
  provider: string;
}

export interface TravelTimeProvider {
  readonly name: string;
  estimate(origin: GeoPoint, destination: GeoPoint): Promise<TravelEstimate>;
}

/**
 * Précision de la clé de cache : trois décimales, soit environ 110 mètres.
 *
 * C'est un compromis assumé. Une clé à l'adresse exacte ne serait jamais
 * réutilisée entre deux voisins de la même rue ; une clé trop grossière
 * mélangerait des trajets réellement différents. À 110 mètres, l'écart de temps
 * introduit est de l'ordre de la minute — très en deçà de l'arrondi des tampons
 * de trajet, qui est de cinq minutes.
 */
const KEY_DECIMALS = 3;

export function travelKey(point: GeoPoint): string {
  return `${point.lat.toFixed(KEY_DECIMALS)},${point.lng.toFixed(KEY_DECIMALS)}`;
}

/**
 * Facteur de détour et vitesse moyenne observés sur le territoire.
 *
 * Mesurés sur les quinze itinéraires réels reliant la mairie de Léognan à
 * celles des quinze autres communes desservies : le trajet routier vaut en
 * moyenne 1,20 fois la distance à vol d'oiseau, parcourue à 43,7 km/h.
 *
 * Ils ne servent pas au calcul — la régression ci-dessous est plus fidèle —
 * mais ils documentent la réalité du terrain : on ne roule pas à 50 km/h entre
 * Léognan et Saint-Morillon, et aucune route ne va tout droit.
 */
export const OBSERVED_DETOUR_FACTOR = 1.2;
export const OBSERVED_AVERAGE_SPEED_KMH = 43.7;

/**
 * Estimation géométrique du temps de trajet, en minutes.
 *
 * `minutes = 3,45 + 1,249 × distance_à_vol_d_oiseau_km`, régression des
 * moindres carrés sur les quinze itinéraires mesurés. L'erreur absolue moyenne
 * est de 1,4 minute, l'erreur maximale de 4,2 minutes.
 *
 * L'ordonnée à l'origine n'est pas un artefact : elle capture ce qui ne dépend
 * pas de la distance — sortir d'un lotissement, traverser un bourg, se garer.
 * Un modèle purement proportionnel sous-estime systématiquement les trajets
 * courts, ceux-là mêmes qui structurent une tournée dense.
 *
 * Le modèle n'est valable que dans ce territoire et pour ces distances. Sur un
 * trajet de cinquante kilomètres il n'a aucun sens — mais LéoClean n'en fait
 * pas.
 */
const BASE_MINUTES = 3.45;
const MINUTES_PER_KM = 1.249;

export function estimateTravelMinutes(
  origin: GeoPoint,
  destination: GeoPoint,
): number {
  const km = haversineKm(
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng,
  );
  if (km === 0) {
    return 0;
  }
  return Math.ceil(BASE_MINUTES + MINUTES_PER_KM * km);
}

/**
 * Fournisseur de repli, purement géométrique.
 *
 * Il ne fait aucun appel réseau, ne peut donc ni échouer ni ralentir, et rend
 * le moteur de disponibilité testable de bout en bout sans service externe.
 */
export const geometricTravelTimeProvider: TravelTimeProvider = {
  name: "geometrique",
  estimate(origin, destination) {
    return Promise.resolve({
      durationMinutes: estimateTravelMinutes(origin, destination),
      distanceMeters: Math.round(
        haversineKm(origin.lat, origin.lng, destination.lat, destination.lng) *
          1000 *
          OBSERVED_DETOUR_FACTOR,
      ),
      provider: "geometrique",
    });
  },
};

/**
 * Pas d'arrondi des tampons de trajet, en minutes.
 *
 * Un planning ne se raisonne pas à la minute près. Arrondir au pas supérieur
 * absorbe l'imprécision du modèle et donne des horaires qu'un intervenant peut
 * lire — « je pars à 10 h 15 », pas « à 10 h 13 ».
 */
export const TRAVEL_BUFFER_STEP_MINUTES = 5;

export function roundTravelBuffer(minutes: number): number {
  return (
    Math.ceil(minutes / TRAVEL_BUFFER_STEP_MINUTES) * TRAVEL_BUFFER_STEP_MINUTES
  );
}

/**
 * Table de trajets pré-résolue.
 *
 * Le moteur de créneaux est synchrone et pur : il ne peut pas attendre un appel
 * réseau au milieu d'une boucle. Les trajets nécessaires sont donc résolus en
 * amont, une fois, et passés sous cette forme.
 */
export interface TravelMatrix {
  minutesBetween(origin: GeoPoint, destination: GeoPoint): number;
}

/** Construit une table à partir de couples déjà calculés. */
export function travelMatrixFrom(
  entries: readonly {
    origin: GeoPoint;
    destination: GeoPoint;
    durationMinutes: number;
  }[],
  fallback: (
    origin: GeoPoint,
    destination: GeoPoint,
  ) => number = estimateTravelMinutes,
): TravelMatrix {
  const table = new Map<string, number>();
  for (const entry of entries) {
    table.set(
      `${travelKey(entry.origin)}>${travelKey(entry.destination)}`,
      entry.durationMinutes,
    );
  }

  return {
    minutesBetween(origin, destination) {
      const cached = table.get(
        `${travelKey(origin)}>${travelKey(destination)}`,
      );
      // Un trajet manquant n'est pas une erreur : le repli géométrique donne
      // une valeur utilisable, et refuser de répondre reviendrait à fermer la
      // réservation parce qu'un cache est froid.
      return cached ?? fallback(origin, destination);
    },
  };
}

/** Table de trajets purement géométrique, sans aucune donnée pré-résolue. */
export const geometricTravelMatrix: TravelMatrix = travelMatrixFrom([]);
