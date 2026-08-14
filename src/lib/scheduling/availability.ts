import {
  type Interval,
  atLeast,
  clampTo,
  expand,
  normalize,
  subtract,
  union,
} from "./intervals";
import { parisDayMinuteToUtc, utcToParisWallClock } from "../time";

/**
 * Disponibilité réelle d'un intervenant : **la source de vérité unique**.
 *
 * Une seule formule, appliquée partout — moteur de créneaux, tournée du jour,
 * réattribution, back-office :
 *
 * ```
 * disponibilité = heures déclarées
 *               + ouvertures exceptionnelles
 *               − absences déclarées
 *               − occupations d'agenda externe
 *               − missions Léo Clean, tampons de trajet compris
 * ```
 *
 * La fonction est pure : elle reçoit un instantané déjà chargé et ne lit rien.
 * C'est ce qui la rend testable sans base, et c'est aussi ce qui garantit que
 * deux surfaces différentes ne pourront pas répondre différemment à la même
 * question.
 *
 * **Deux arbitrages sont figés ici, et il faut les connaître :**
 *
 * 1. **Une absence l'emporte sur une ouverture exceptionnelle.** Si les deux
 *    couvrent le même instant, l'intervenant n'est pas disponible. Poser une
 *    absence est un acte délibéré ; l'ouverture peut n'être qu'un reliquat.
 * 2. **Les tampons de trajet ne se franchissent pas.** Une mission occupe son
 *    créneau *plus* la route pour l'atteindre et pour en repartir. C'est la
 *    même convention que la contrainte d'exclusion en base, et les deux doivent
 *    rester d'accord — sinon le moteur propose des créneaux que la base
 *    refuse.
 */

/** Règle hebdomadaire déclarée, en heure locale française. */
export interface WeeklyAvailabilityRule {
  /** 1 = lundi … 7 = dimanche (ISO 8601), comme `AvailabilityRule.weekday`. */
  weekday: number;
  /** Minutes depuis minuit, heure de Paris. */
  startMinute: number;
  endMinute: number;
  validFrom: Date;
  validUntil: Date | null;
}

export interface AvailabilityExceptionInput {
  type: "AVAILABLE" | "UNAVAILABLE";
  start: Date;
  end: Date;
}

/** Mission déjà attribuée, avec les temps de route qui l'encadrent. */
export interface BookedAssignment {
  start: Date;
  end: Date;
  travelMinutesBefore: number;
  travelMinutesAfter: number;
}

export interface AvailabilityInput {
  /** Horizon de calcul. Rien n'est produit en dehors. */
  window: Interval;
  rules: readonly WeeklyAvailabilityRule[];
  exceptions?: readonly AvailabilityExceptionInput[];
  /** Plages occupées importées d'un agenda externe (free/busy uniquement). */
  externalBusy?: readonly Interval[];
  assignments?: readonly BookedAssignment[];
  /**
   * Durée minimale d'une mission. Les fragments plus courts sont écartés : ils
   * ne sont réservables par personne et encombreraient la tournée.
   */
  minimumSlotMinutes?: number;
}

/**
 * Projette les règles hebdomadaires sur les jours réels de la fenêtre.
 *
 * L'itération se fait sur les jours **du calendrier français**, pas sur des
 * tranches de 24 h : les 25 et 26 octobre ne durent pas la même chose, et une
 * disponibilité déclarée « le dimanche de 9 h à 17 h » doit rester de 9 h à
 * 17 h la nuit du changement d'heure. C'est `parisDayMinuteToUtc` qui porte la
 * conversion, et elle seule.
 */
function projectRules(
  rules: readonly WeeklyAvailabilityRule[],
  window: Interval,
): Interval[] {
  if (rules.length === 0) {
    return [];
  }

  const first = utcToParisWallClock(new Date(window.start));
  const last = utcToParisWallClock(new Date(window.end));

  // On déborde d'un jour de chaque côté : une règle qui court jusqu'à minuit
  // la veille peut mordre sur le début de la fenêtre, et réciproquement.
  const cursor = new Date(
    Date.UTC(first.year, first.month - 1, first.day) - 86_400_000,
  );
  const lastDay = Date.UTC(last.year, last.month - 1, last.day) + 86_400_000;

  const projected: Interval[] = [];

  while (cursor.getTime() <= lastDay) {
    const day = {
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
      day: cursor.getUTCDate(),
    };
    // `getUTCDay()` place dimanche à 0 ; les règles suivent l'ISO 8601.
    const isoWeekday = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();

    for (const rule of rules) {
      if (rule.weekday !== isoWeekday || rule.endMinute <= rule.startMinute) {
        continue;
      }

      const start = parisDayMinuteToUtc(day, rule.startMinute);
      const end = parisDayMinuteToUtc(day, rule.endMinute);

      // La validité de la règle se juge sur le créneau produit, pas sur la
      // date d'itération : une règle qui prend effet à midi ne rend pas
      // disponible la matinée du même jour.
      if (start < rule.validFrom) continue;
      if (rule.validUntil !== null && end > rule.validUntil) continue;

      projected.push({ start: start.getTime(), end: end.getTime() });
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return normalize(projected);
}

/** Plages réellement disponibles sur la fenêtre, normalisées et triées. */
export function computeAvailability(input: AvailabilityInput): Interval[] {
  const exceptions = input.exceptions ?? [];

  const opened = exceptions
    .filter((exception) => exception.type === "AVAILABLE")
    .map((exception) => ({
      start: exception.start.getTime(),
      end: exception.end.getTime(),
    }));

  const closed = exceptions
    .filter((exception) => exception.type === "UNAVAILABLE")
    .map((exception) => ({
      start: exception.start.getTime(),
      end: exception.end.getTime(),
    }));

  const busy = normalize([
    ...closed,
    ...(input.externalBusy ?? []),
    ...(input.assignments ?? []).map((assignment) =>
      expand(
        {
          start: assignment.start.getTime(),
          end: assignment.end.getTime(),
        },
        assignment.travelMinutesBefore,
        assignment.travelMinutesAfter,
      ),
    ),
  ]);

  const declared = union(projectRules(input.rules, input.window), opened);
  const free = subtract(clampTo(declared, input.window), busy);

  return atLeast(free, input.minimumSlotMinutes ?? 0);
}

/**
 * Vraie si la mission proposée tient entièrement dans une plage disponible.
 *
 * Le contrôle porte sur le créneau **élargi des trajets** : c'est la même
 * grandeur que celle protégée par la contrainte d'exclusion en base. Vérifier
 * le créneau nu laisserait passer des missions que la base refuserait ensuite,
 * au moment le plus coûteux — après paiement.
 */
export function fitsInAvailability(
  availability: readonly Interval[],
  candidate: Interval,
  travelMinutesBefore = 0,
  travelMinutesAfter = 0,
): boolean {
  const block = expand(candidate, travelMinutesBefore, travelMinutesAfter);
  return availability.some(
    (window) => window.start <= block.start && block.end <= window.end,
  );
}
