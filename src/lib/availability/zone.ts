/**
 * Zone d'intervention dessinée à la main.
 *
 * Module **pur** : appartenance d'un point, simplification d'un tracé,
 * validation. Ni base, ni horloge, ni DOM — c'est ce qui permet à l'écran de
 * dessin et au moteur d'attribution d'être d'accord par construction, ce qui
 * est toute la difficulté : une zone qui promettrait Cadaujac pendant que le
 * moteur la refuse ferait douter du réglage entier.
 *
 * **Le polygone l'emporte sur le rayon quand il existe.** Le rayon reste le
 * réglage par défaut — un cercle se comprend sans rien dessiner — et il
 * continue de s'appliquer à tous ceux qui n'ont rien tracé. Deux réglages
 * concurrents seraient un défaut ; un réglage et son défaut n'en sont pas un.
 */

export interface PointZone {
  lat: number;
  lng: number;
}

/**
 * Nombre maximal de sommets conservés.
 *
 * Un tracé au doigt produit plusieurs centaines de points, dont la quasi-
 * totalité ne dit rien : la simplification en garde la forme. Le plafond
 * protège la colonne JSON et le test d'appartenance, qui est linéaire et
 * s'exécute une fois par intervenant et par créneau candidat.
 */
export const SOMMETS_MAX = 60;

/** En deçà, ce n'est pas une surface. */
export const SOMMETS_MIN = 3;

/**
 * Aire minimale acceptée, en kilomètres carrés.
 *
 * Un tracé involontaire — un tap qui glisse de trois pixels — produit un
 * polygone valide et minuscule, qui couperait toutes les missions sans que
 * personne comprenne pourquoi. Un kilomètre carré est en dessous de la plus
 * petite de nos communes ; refuser au-delà écarterait un choix légitime.
 */
export const AIRE_MINIMALE_KM2 = 1;

export type ErreurZone = "trop-peu-de-points" | "trop-petite";

export const MESSAGES_ZONE: Record<ErreurZone, string> = {
  "trop-peu-de-points":
    "Le tracé est trop court. Dessinez une boucle autour de la zone où vous acceptez des missions.",
  "trop-petite":
    "La zone dessinée est minuscule. Élargissez-la, ou revenez au rayon.",
};

/**
 * Ce point est-il dans la zone ?
 *
 * Lancer de rayon vers l'est, avec la convention `[bas, haut)` sur les
 * ordonnées : c'est elle qui évite de compter deux fois un sommet traversé
 * exactement à sa latitude, et donc de déclarer « dehors » un point qui est
 * dedans. À l'échelle d'un département, travailler en degrés plutôt qu'en
 * mètres projetés déplace la frontière de moins d'un mètre.
 */
export function dansLaZone(
  point: PointZone,
  zone: readonly PointZone[],
): boolean {
  let dedans = false;

  for (let i = 0, j = zone.length - 1; i < zone.length; j = i, i += 1) {
    const a = zone[i]!;
    const b = zone[j]!;

    const traverse = a.lat > point.lat !== b.lat > point.lat;
    if (!traverse) continue;

    const abscisse =
      a.lng + ((point.lat - a.lat) / (b.lat - a.lat)) * (b.lng - a.lng);
    if (point.lng < abscisse) dedans = !dedans;
  }

  return dedans;
}

/**
 * Aire approchée, en kilomètres carrés.
 *
 * Formule du lacet, sur une projection équirectangulaire locale. Elle sert à
 * refuser un tracé involontaire, pas à cadastrer : une erreur de quelques
 * pour cent à l'échelle d'un département est sans conséquence sur ce seuil.
 */
export function aireKm2(zone: readonly PointZone[]): number {
  if (zone.length < 3) return 0;

  const KM_PAR_DEGRE = 111.32;
  const latMoyenne =
    zone.reduce((somme, point) => somme + point.lat, 0) / zone.length;
  const cosLat = Math.cos((latMoyenne * Math.PI) / 180);

  let double = 0;
  for (let i = 0, j = zone.length - 1; i < zone.length; j = i, i += 1) {
    const a = zone[i]!;
    const b = zone[j]!;
    double +=
      b.lng * KM_PAR_DEGRE * cosLat * (a.lat * KM_PAR_DEGRE) -
      a.lng * KM_PAR_DEGRE * cosLat * (b.lat * KM_PAR_DEGRE);
  }

  return Math.abs(double) / 2;
}

/**
 * Simplifie un tracé — Ramer-Douglas-Peucker, puis plafond de sommets.
 *
 * La tolérance est exprimée en degrés parce que c'est l'unité du tracé ; elle
 * est resserrée tant que le résultat dépasse `SOMMETS_MAX`, ce qui garantit la
 * terminaison sans dépendre de la forme dessinée. Un tracé fermé garde ses
 * deux extrémités, que l'appelant n'a donc pas à recoller.
 */
export function simplifier(
  points: readonly PointZone[],
  tolerance = 0.0002,
): PointZone[] {
  if (points.length <= SOMMETS_MIN) return [...points];

  let resultat = rdp(points, tolerance);
  let courante = tolerance;
  /* Vingt doublements couvrent quatre ordres de grandeur : au-delà, la boucle
     ne progresserait plus et le plafond dur reprend la main. */
  for (let essai = 0; essai < 20 && resultat.length > SOMMETS_MAX; essai += 1) {
    courante *= 2;
    resultat = rdp(points, courante);
  }

  if (resultat.length > SOMMETS_MAX) {
    const pas = resultat.length / SOMMETS_MAX;
    resultat = Array.from(
      { length: SOMMETS_MAX },
      (_, index) => resultat[Math.floor(index * pas)]!,
    );
  }

  return resultat;
}

function rdp(points: readonly PointZone[], tolerance: number): PointZone[] {
  if (points.length < 3) return [...points];

  const premier = points[0]!;
  const dernier = points[points.length - 1]!;

  let indexMax = 0;
  let distanceMax = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = distanceAuSegment(points[i]!, premier, dernier);
    if (distance > distanceMax) {
      distanceMax = distance;
      indexMax = i;
    }
  }

  if (distanceMax <= tolerance) return [premier, dernier];

  return [
    ...rdp(points.slice(0, indexMax + 1), tolerance).slice(0, -1),
    ...rdp(points.slice(indexMax), tolerance),
  ];
}

function distanceAuSegment(
  point: PointZone,
  a: PointZone,
  b: PointZone,
): number {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const norme = dx * dx + dy * dy;

  if (norme === 0) {
    return Math.hypot(point.lng - a.lng, point.lat - a.lat);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.lng - a.lng) * dx + (point.lat - a.lat) * dy) / norme),
  );
  return Math.hypot(point.lng - (a.lng + t * dx), point.lat - (a.lat + t * dy));
}

/** Ce tracé peut-il être enregistré ? */
export function verifierLaZone(zone: readonly PointZone[]): ErreurZone | null {
  if (zone.length < SOMMETS_MIN) return "trop-peu-de-points";
  if (aireKm2(zone) < AIRE_MINIMALE_KM2) return "trop-petite";
  return null;
}

/** Rectangle englobant, pour cadrer la carte sur la zone. */
export function cadre(zone: readonly PointZone[]): {
  sud: number;
  ouest: number;
  nord: number;
  est: number;
} | null {
  if (zone.length === 0) return null;
  return zone.reduce(
    (boite, point) => ({
      sud: Math.min(boite.sud, point.lat),
      nord: Math.max(boite.nord, point.lat),
      ouest: Math.min(boite.ouest, point.lng),
      est: Math.max(boite.est, point.lng),
    }),
    {
      sud: zone[0]!.lat,
      nord: zone[0]!.lat,
      ouest: zone[0]!.lng,
      est: zone[0]!.lng,
    },
  );
}

/**
 * Relit une zone stockée en JSON libre.
 *
 * **Une zone illisible se replie sur le rayon, elle ne fait échouer personne.**
 * La colonne n'est pas typée par la base : une valeur écrite par une version
 * antérieure, ou tronquée, ne doit pas interrompre une recherche de créneaux
 * — ce qui reviendrait à retirer un intervenant de la circulation pour une
 * donnée d'affichage.
 */
export function lireLaZone(valeur: unknown): PointZone[] | null {
  if (!Array.isArray(valeur) || valeur.length < SOMMETS_MIN) return null;

  const points: PointZone[] = [];
  for (const brut of valeur) {
    if (typeof brut !== "object" || brut === null) return null;
    const { lat, lng } = brut as { lat?: unknown; lng?: unknown };
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null;
    }
    points.push({ lat, lng });
  }

  return points.length > SOMMETS_MAX ? points.slice(0, SOMMETS_MAX) : points;
}
