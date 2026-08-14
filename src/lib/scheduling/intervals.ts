/**
 * Algèbre d'intervalles temporels.
 *
 * Tout le moteur de disponibilité se ramène à des additions et des
 * soustractions de plages. Les isoler ici, en fonctions pures manipulant des
 * millisecondes, évite que chaque appelant réinvente sa gestion des bords —
 * c'est là que se logent les bugs de planning, et ils ne se voient qu'en
 * production, sous la forme d'un créneau vendu sur une heure occupée.
 *
 * **Convention de bornes : `[start, end)`.** Une plage contient son début et
 * exclut sa fin. Deux plages jointives — l'une finissant à 12 h, l'autre
 * commençant à 12 h — ne se chevauchent donc pas, et une mission de 10 h à 12 h
 * laisse 12 h libre. Sans cette convention, chaque frontière produirait un
 * conflit d'une milliseconde.
 */

/** Plage temporelle en millisecondes depuis l'époque, bornes `[start, end)`. */
export interface Interval {
  start: number;
  end: number;
}

export const MINUTE_MS = 60_000;

export function interval(start: Date, end: Date): Interval {
  return { start: start.getTime(), end: end.getTime() };
}

export function toDates(value: Interval): { start: Date; end: Date } {
  return { start: new Date(value.start), end: new Date(value.end) };
}

export function durationMinutes(value: Interval): number {
  return (value.end - value.start) / MINUTE_MS;
}

/** Vraie si les deux plages partagent au moins un instant. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function contains(outer: Interval, inner: Interval): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

/** Élargit une plage de part et d'autre. Sert aux tampons de trajet. */
export function expand(
  value: Interval,
  beforeMinutes: number,
  afterMinutes: number,
): Interval {
  return {
    start: value.start - beforeMinutes * MINUTE_MS,
    end: value.end + afterMinutes * MINUTE_MS,
  };
}

/**
 * Trie, écarte les plages vides ou inversées, et fusionne ce qui se chevauche
 * ou se touche.
 *
 * Les plages jointives sont fusionnées bien que `[9 h, 12 h)` et `[12 h, 17 h)`
 * ne se chevauchent pas : sur une disponibilité, les garder séparées ferait
 * refuser une mission de 11 h à 13 h qui tient pourtant entièrement dans les
 * heures déclarées.
 */
export function normalize(values: readonly Interval[]): Interval[] {
  const sorted = values
    .filter((value) => value.end > value.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: Interval[] = [];
  for (const value of sorted) {
    const last = merged[merged.length - 1];
    if (last && value.start <= last.end) {
      last.end = Math.max(last.end, value.end);
    } else {
      merged.push({ ...value });
    }
  }
  return merged;
}

export function union(
  a: readonly Interval[],
  b: readonly Interval[],
): Interval[] {
  return normalize([...a, ...b]);
}

/**
 * Retire `removed` de `from`.
 *
 * Une soustraction peut couper une plage en deux : une mission de 12 h à 14 h
 * dans une disponibilité de 9 h à 18 h laisse deux fenêtres, pas une.
 */
export function subtract(
  from: readonly Interval[],
  removed: readonly Interval[],
): Interval[] {
  const holes = normalize(removed);
  let current = normalize(from);

  for (const hole of holes) {
    const next: Interval[] = [];
    for (const value of current) {
      if (!overlaps(value, hole)) {
        next.push(value);
        continue;
      }
      if (value.start < hole.start) {
        next.push({ start: value.start, end: hole.start });
      }
      if (hole.end < value.end) {
        next.push({ start: hole.end, end: value.end });
      }
    }
    current = next;
  }

  return current;
}

export function intersect(
  a: readonly Interval[],
  b: readonly Interval[],
): Interval[] {
  const left = normalize(a);
  const right = normalize(b);
  const result: Interval[] = [];

  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const start = Math.max(left[i]!.start, right[j]!.start);
    const end = Math.min(left[i]!.end, right[j]!.end);
    if (end > start) {
      result.push({ start, end });
    }
    if (left[i]!.end < right[j]!.end) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return result;
}

/** Restreint des plages à une fenêtre. Raccourci de `intersect` à une plage. */
export function clampTo(
  values: readonly Interval[],
  window: Interval,
): Interval[] {
  return intersect(values, [window]);
}

/** Écarte les fragments trop courts pour accueillir la moindre mission. */
export function atLeast(
  values: readonly Interval[],
  minutes: number,
): Interval[] {
  return values.filter((value) => durationMinutes(value) >= minutes);
}

export function totalMinutes(values: readonly Interval[]): number {
  return values.reduce((total, value) => total + durationMinutes(value), 0);
}
