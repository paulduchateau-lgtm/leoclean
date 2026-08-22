import { fitsInAvailability } from "./availability";
import { MINUTE_MS, type Interval, clampTo } from "./intervals";
import { type ScoreBreakdown, scoreAssignment } from "./scoring";
import {
  type GeoPoint,
  type TravelMatrix,
  geometricTravelMatrix,
  roundTravelBuffer,
} from "./travel";
import { type PointZone, dansLaZone } from "../availability/zone";
import { haversineKm } from "../territory";
import { parisDayKey } from "../time";

/**
 * Recherche de créneaux réservables.
 *
 * Le client choisit une heure, jamais une personne : l'attribution est
 * automatique. Ce module produit donc une liste d'heures possibles, chacune
 * accompagnée de l'intervenant que le score désigne — l'information reste
 * disponible pour l'exploitation, mais n'a pas à remonter jusqu'au client.
 *
 * La faisabilité d'un créneau ne se juge pas sur la seule disponibilité : il
 * faut aussi que la route tienne. Une intervenante libre de 9 h à 18 h qui
 * termine à Cabanac à 12 h n'est pas disponible à 12 h 15 à Villenave-d'Ornon,
 * et c'est exactement le genre de créneau qu'un moteur naïf vend.
 */

/** Étape déjà planifiée dans la journée d'un intervenant. */
export interface RoundStop {
  start: Date;
  end: Date;
  point: GeoPoint;
}

export interface CleanerSchedule {
  cleanerProfileId: string;
  /** Point de départ et d'arrivée de la tournée. `null` si non renseigné. */
  homePoint: GeoPoint | null;
  /** Trajet inter-missions maximal accepté, en minutes. */
  maxTravelMinutes: number;
  /**
   * Rayon d'action, en kilomètres à vol d'oiseau depuis `homePoint`.
   *
   * `null` — ou un domicile inconnu — ne filtre rien : on ne sait pas d'où
   * compter, et refuser par défaut retirerait de la circulation quelqu'un
   * d'actif.
   */
  serviceRadiusKm?: number | null;
  /**
   * Zone dessinée à la main. Elle l'emporte sur le rayon quand elle existe.
   *
   * Un cercle ne décrit pas un territoire : il traverse une forêt, une rocade,
   * un bras de Garonne. Le rayon reste le défaut de ceux qui n'ont rien tracé.
   */
  serviceArea?: readonly PointZone[] | null;
  /** Plages libres, telles que renvoyées par `computeAvailability`. */
  availability: readonly Interval[];
  /** Missions déjà attribuées, dans l'ordre chronologique. */
  stops: readonly RoundStop[];
  ratingAverage: number;
  ratingCount: number;
  acceptanceRate: number;
  assignedMinutesInPeriod: number;
  /** Intervenant attitré de ce client. */
  isPreferred: boolean;
}

export interface SlotRequest {
  window: Interval;
  durationMinutes: number;
  destination: GeoPoint;
  /**
   * Pas de la grille d'horaires proposés. Trente minutes : proposer 9 h 07
   * n'aide personne, et un pas plus large fait perdre des réservations.
   *
   * Le pas s'aligne sur les multiples de l'époque UTC. En France c'est
   * équivalent à un alignement sur l'heure locale, les deux décalages en
   * vigueur — UTC+1 et UTC+2 — étant des heures entières.
   */
  stepMinutes?: number;
  /** Instant de référence. Rien n'est proposé dans le passé. */
  now?: Date;
  /** Délai de prévenance minimal, en minutes. */
  leadTimeMinutes?: number;
  travel?: TravelMatrix;
  /**
   * Marge ajoutée à chacun des deux trajets, en minutes.
   *
   * Nulle quand la destination est une adresse exacte. Elle ne sert qu'au cas
   * où l'on ne connaît encore que la commune : le tunnel demande la commune
   * bien avant l'adresse, et un créneau proposé depuis le centre d'une commune
   * doit rester tenable pour n'importe quelle adresse de cette commune. Sans
   * elle, la réservation échouerait au dernier écran, une fois tout rempli —
   * c'est `createBooking` qui réévalue le créneau sur l'adresse réelle.
   *
   * Elle rend la proposition plus prudente, jamais plus permissive : mieux
   * vaut ne pas montrer un créneau tenable que d'en promettre un qui ne l'est
   * pas.
   */
  travelMarginMinutes?: number;
  /** Nombre maximal de créneaux renvoyés, les plus proches d'abord. */
  limit?: number;
}

export interface SlotCandidate {
  start: Date;
  end: Date;
  cleanerProfileId: string;
  travelMinutesBefore: number;
  travelMinutesAfter: number;
  /** Minutes de route ajoutées à la tournée par cette mission. */
  insertionCostMinutes: number;
  score: number;
  breakdown: ScoreBreakdown;
}

export const DEFAULT_SLOT_STEP_MINUTES = 30;

/**
 * Délai de prévenance par défaut, en minutes.
 *
 * Douze heures. Assez pour qu'un intervenant organise sa journée et accepte la
 * mission, assez court pour ne pas perdre la réservation d'un client pressé.
 */
export const DEFAULT_LEAD_TIME_MINUTES = 12 * 60;

/**
 * Coût d'insertion : minutes de route ajoutées à la tournée.
 *
 * La journée se lit comme une chaîne domicile → missions → domicile. Insérer
 * une mission remplace un tronçon par deux : le coût est la différence. Une
 * mission glissée entre deux adresses voisines ne coûte presque rien ; la même
 * mission en début de journée coûte l'aller-retour complet.
 */
export function insertionCostMinutes(
  schedule: CleanerSchedule,
  destination: GeoPoint,
  previous: RoundStop | undefined,
  next: RoundStop | undefined,
  travel: TravelMatrix,
): number {
  const before = previous?.point ?? schedule.homePoint;
  const after = next?.point ?? schedule.homePoint;

  const existingLeg =
    before && after ? travel.minutesBetween(before, after) : 0;
  const newLegs =
    (before ? travel.minutesBetween(before, destination) : 0) +
    (after ? travel.minutesBetween(destination, after) : 0);

  return Math.max(0, newLegs - existingLeg);
}

/**
 * Étapes appartenant à la même tournée que la mission envisagée.
 *
 * Une tournée est une **journée**, et rien d'autre. Traiter comme « étape
 * suivante » une mission située trois jours plus tard ferait calculer un temps
 * de trajet entre deux adresses que personne n'enchaîne — et, si les deux
 * adresses coïncident, un trajet nul qui rendrait faisable un créneau où
 * l'intervenant ne peut pas rentrer chez lui.
 *
 * Ce n'est pas une hypothèse théorique : c'est le bug qui a fait proposer un
 * samedi de 9 h 30 à 13 h à une intervenante dont les heures s'arrêtent à 13 h,
 * parce qu'elle avait le lundi suivant une mission à la même adresse.
 */
function sameRound(stops: readonly RoundStop[], instant: number): RoundStop[] {
  const day = parisDayKey(new Date(instant));
  return stops.filter((stop) => parisDayKey(stop.start) === day);
}

/** Dernière étape de la journée terminée avant l'instant donné. */
function stopBefore(
  stops: readonly RoundStop[],
  instant: number,
): RoundStop | undefined {
  let found: RoundStop | undefined;
  for (const stop of sameRound(stops, instant)) {
    if (stop.end.getTime() <= instant) {
      found = stop;
    }
  }
  return found;
}

/** Première étape de la journée commençant après l'instant donné. */
function stopAfter(
  stops: readonly RoundStop[],
  instant: number,
): RoundStop | undefined {
  return sameRound(stops, instant).find(
    (stop) => stop.start.getTime() >= instant,
  );
}

/**
 * Cette mission tombe-t-elle hors du périmètre déclaré ?
 *
 * **Le rayon décide avant tout le reste.** Il n'exprime pas une contrainte de
 * tournée mais un refus : quelqu'un qui a tracé vingt kilomètres autour de
 * chez lui ne veut pas d'une mission à quarante, même un jour où son planning
 * est vide. Le plafond `maxTravelMinutes`, lui, ne regarde que l'enchaînement
 * entre deux missions et ne dit rien de la première de la journée — c'est
 * précisément le trou que le rayon vient fermer.
 *
 * **À vol d'oiseau, parce que c'est un cercle sur une carte.** Mesurer par la
 * route exclurait des adresses que l'intervenant voit à l'intérieur du cercle
 * qu'il vient de tracer, et un réglage dont l'effet contredit le dessin n'est
 * plus un réglage. La route continue de décider de la faisabilité, elle, par
 * les tampons de trajet.
 */
export function horsDuRayon(
  schedule: Pick<
    CleanerSchedule,
    "homePoint" | "serviceRadiusKm" | "serviceArea"
  >,
  destination: GeoPoint,
): boolean {
  /* Une zone dessinée se suffit à elle-même : elle ne dépend pas du domicile,
     et elle exprime déjà ce que le rayon approximait. */
  if (schedule.serviceArea && schedule.serviceArea.length >= 3) {
    return !dansLaZone(destination, schedule.serviceArea);
  }

  const rayon = schedule.serviceRadiusKm;
  if (!schedule.homePoint || rayon === null || rayon === undefined) {
    return false;
  }
  return (
    haversineKm(
      schedule.homePoint.lat,
      schedule.homePoint.lng,
      destination.lat,
      destination.lng,
    ) > rayon
  );
}

/**
 * Un intervenant peut-il prendre cette mission à cette heure ?
 *
 * Renvoie le candidat complet, ou `null` si la mission ne tient pas — parce que
 * la plage libre est trop courte, parce que la route depuis la mission
 * précédente ne passe pas, ou parce que ce trajet dépasse ce que l'intervenant
 * a accepté.
 */
export function evaluateSlot(
  schedule: CleanerSchedule,
  request: SlotRequest,
  startMs: number,
): SlotCandidate | null {
  const travel = request.travel ?? geometricTravelMatrix;
  const endMs = startMs + request.durationMinutes * MINUTE_MS;
  const candidate: Interval = { start: startMs, end: endMs };

  if (horsDuRayon(schedule, request.destination)) return null;

  const previous = stopBefore(schedule.stops, startMs);
  const next = stopAfter(schedule.stops, endMs);

  const originPoint = previous?.point ?? schedule.homePoint;
  const destinationPoint = next?.point ?? schedule.homePoint;

  const margin = request.travelMarginMinutes ?? 0;
  const travelBefore = originPoint
    ? roundTravelBuffer(
        travel.minutesBetween(originPoint, request.destination) + margin,
      )
    : 0;
  const travelAfter = destinationPoint
    ? roundTravelBuffer(
        travel.minutesBetween(request.destination, destinationPoint) + margin,
      )
    : 0;

  // Le plafond ne s'applique qu'aux trajets entre deux missions. Le trajet
  // depuis ou vers le domicile relève du choix de l'intervenant : lui refuser
  // une mission proche de chez lui parce qu'il habite loin de la précédente
  // n'aurait pas de sens.
  if (previous && travelBefore > schedule.maxTravelMinutes) return null;
  if (next && travelAfter > schedule.maxTravelMinutes) return null;

  // La route doit tenir dans le temps réellement disponible entre deux
  // missions, et le bloc élargi doit tenir dans une plage libre — c'est la
  // même grandeur que celle protégée par la contrainte d'exclusion en base.
  if (previous && previous.end.getTime() + travelBefore * MINUTE_MS > startMs) {
    return null;
  }
  if (next && endMs + travelAfter * MINUTE_MS > next.start.getTime()) {
    return null;
  }
  if (
    !fitsInAvailability(
      schedule.availability,
      candidate,
      travelBefore,
      travelAfter,
    )
  ) {
    return null;
  }

  const cost = insertionCostMinutes(
    schedule,
    request.destination,
    previous,
    next,
    travel,
  );

  const { score, breakdown } = scoreAssignment({
    insertionCostMinutes: cost,
    ratingAverage: schedule.ratingAverage,
    ratingCount: schedule.ratingCount,
    acceptanceRate: schedule.acceptanceRate,
    assignedMinutesInPeriod: schedule.assignedMinutesInPeriod,
    isPreferred: schedule.isPreferred,
  });

  return {
    start: new Date(startMs),
    end: new Date(endMs),
    cleanerProfileId: schedule.cleanerProfileId,
    travelMinutesBefore: travelBefore,
    travelMinutesAfter: travelAfter,
    insertionCostMinutes: cost,
    score,
    breakdown,
  };
}

/**
 * Créneaux réservables, un par heure de départ, avec le meilleur intervenant.
 *
 * Deux intervenants disponibles à la même heure ne produisent pas deux
 * créneaux : le client n'a pas à arbitrer entre des personnes qu'il ne connaît
 * pas. Le score tranche, et à score égal c'est le coût de trajet le plus faible
 * qui l'emporte — départager par l'identifiant produirait un classement stable
 * mais arbitraire, celui-ci reste défendable.
 */
export function findSlots(
  schedules: readonly CleanerSchedule[],
  request: SlotRequest,
): SlotCandidate[] {
  const step = (request.stepMinutes ?? DEFAULT_SLOT_STEP_MINUTES) * MINUTE_MS;
  const now = request.now ?? new Date();
  const leadTime = request.leadTimeMinutes ?? DEFAULT_LEAD_TIME_MINUTES;

  const earliest = now.getTime() + leadTime * MINUTE_MS;
  const searchWindow: Interval = {
    start: Math.max(request.window.start, earliest),
    end: request.window.end,
  };

  if (searchWindow.end <= searchWindow.start) {
    return [];
  }

  const best = new Map<number, SlotCandidate>();

  for (const schedule of schedules) {
    for (const free of clampTo(schedule.availability, searchWindow)) {
      const firstStart = Math.ceil(free.start / step) * step;

      for (
        let startMs = Math.max(firstStart, searchWindow.start);
        startMs + request.durationMinutes * MINUTE_MS <= free.end;
        startMs += step
      ) {
        const candidate = evaluateSlot(schedule, request, startMs);
        if (!candidate) continue;

        const current = best.get(startMs);
        if (
          !current ||
          candidate.score > current.score ||
          (candidate.score === current.score &&
            candidate.insertionCostMinutes < current.insertionCostMinutes)
        ) {
          best.set(startMs, candidate);
        }
      }
    }
  }

  const slots = [...best.values()].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  return request.limit === undefined ? slots : slots.slice(0, request.limit);
}
