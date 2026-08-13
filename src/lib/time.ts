/**
 * Conversions entre l'heure locale française et l'UTC.
 *
 * La base ne stocke que de l'UTC. Mais le métier se pense en heure locale : un
 * ménage « le mardi à 9 h » est à 9 h toute l'année, et une disponibilité
 * déclarée de 9 h à 17 h ne se décale pas au passage à l'heure d'hiver. Ces
 * fonctions sont la frontière entre les deux mondes ; rien d'autre dans le code
 * n'a le droit de manipuler un décalage horaire.
 *
 * L'implémentation s'appuie sur `Intl`, donc sur la base de données de fuseaux
 * du système, plutôt que sur une table de règles recopiée à la main.
 */

export const PARIS_TIMEZONE = "Europe/Paris";

const PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: PARIS_TIMEZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** Décalage d'Europe/Paris par rapport à l'UTC, en minutes, à cet instant. */
export function parisOffsetMinutes(instant: Date): number {
  const parts = PARTS_FORMATTER.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value === undefined) {
      throw new Error(`Intl n'a pas renvoyé le composant « ${type} ».`);
    }
    return Number(value);
  };

  // `hour` peut valoir 24 en hour12:false selon les moteurs ; le modulo évite
  // de décaler la date d'un jour à minuit.
  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour") % 24,
    read("minute"),
    read("second"),
  );

  return (asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000;
}

const DAY_MS = 86_400_000;

/**
 * Convertit une heure murale française en instant UTC.
 *
 * Le décalage à appliquer dépend de l'instant cherché, qu'on ne connaît pas
 * encore. On teste donc les deux décalages en vigueur autour de la date, et on
 * ne retient que les candidats cohérents avec eux-mêmes : un candidat dont le
 * décalage réel diffère de celui employé pour le calculer n'existe pas.
 *
 * Les deux nuits de transition annuelles sont traitées explicitement plutôt
 * que laissées au hasard de l'arithmétique :
 *
 * - heure inexistante — au passage à l'heure d'été, l'horloge saute de 2 h à
 *   3 h et 2 h 30 n'existe pas. Aucun candidat n'est valide ; on décale vers
 *   l'avant, ce qui donne 3 h 30.
 * - heure ambiguë — au passage à l'heure d'hiver, 2 h 30 se produit deux fois.
 *   Les deux candidats sont valides ; on retient le premier, celui encore en
 *   heure d'été.
 *
 * C'est la convention dite « compatible », celle de la proposition Temporal.
 * Pour un planning de ménage, l'essentiel est surtout de ne jamais refuser une
 * réservation sous prétexte qu'elle tombe une nuit de changement d'heure.
 */
export function parisWallClockToUtc(wall: WallClock): Date {
  const naive = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
  );

  const offsetBefore = parisOffsetMinutes(new Date(naive - DAY_MS));
  const offsetAfter = parisOffsetMinutes(new Date(naive + DAY_MS));

  const candidates = [...new Set([offsetBefore, offsetAfter])].map(
    (offset) => naive - offset * 60_000,
  );
  const valid = candidates.filter(
    (candidate) =>
      parisOffsetMinutes(new Date(candidate)) === (naive - candidate) / 60_000,
  );

  if (valid.length === 0) {
    // Heure inexistante : on applique le décalage d'avant la transition, ce
    // qui projette l'horaire au-delà du saut.
    return new Date(naive - offsetBefore * 60_000);
  }

  return new Date(Math.min(...valid));
}

/** Composants de l'heure murale française correspondant à cet instant UTC. */
export function utcToParisWallClock(instant: Date): WallClock {
  const parts = PARTS_FORMATTER.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value === undefined) {
      throw new Error(`Intl n'a pas renvoyé le composant « ${type} ».`);
    }
    return Number(value);
  };

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour") % 24,
    minute: read("minute"),
  };
}

/**
 * Jour de la semaine au sens ISO 8601 — 1 pour lundi, 7 pour dimanche — dans le
 * calendrier français.
 *
 * C'est la convention retenue par `AvailabilityRule.weekday` et
 * `Subscription.weekday`. Elle diffère de `Date.getUTCDay()`, qui place
 * dimanche à 0 : confondre les deux décale tout un planning d'un jour.
 */
export function parisIsoWeekday(instant: Date): number {
  const wall = utcToParisWallClock(instant);
  const day = new Date(
    Date.UTC(wall.year, wall.month - 1, wall.day),
  ).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Minutes écoulées depuis minuit, heure locale française. */
export function parisMinuteOfDay(instant: Date): number {
  const wall = utcToParisWallClock(instant);
  return wall.hour * 60 + wall.minute;
}

/**
 * Instant UTC correspondant à un nombre de minutes depuis minuit, un jour
 * donné, en heure locale française. C'est la conversion dont se sert le moteur
 * de disponibilité pour projeter une règle hebdomadaire sur une date réelle.
 */
export function parisDayMinuteToUtc(
  day: { year: number; month: number; day: number },
  minuteOfDay: number,
): Date {
  return parisWallClockToUtc({
    ...day,
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
  });
}

/** Formatage lisible en français, pour l'affichage et les emails. */
export function formatParis(
  instant: Date,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "full",
    timeStyle: "short",
  },
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    ...options,
    timeZone: PARIS_TIMEZONE,
  }).format(instant);
}
