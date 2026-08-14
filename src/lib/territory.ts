/**
 * Référentiel des communes couvertes par Léo Clean.
 *
 * La zone d'intervention réunit deux ensembles : les 13 communes de la
 * Communauté de communes de Montesquieu (Gironde, Nouvelle-Aquitaine), siège à
 * Léognan, et trois communes limitrophes au nord et à l'ouest — Gradignan,
 * Villenave-d'Ornon et Cestas — qui n'appartiennent pas à cette
 * intercommunalité mais sont plus proches du siège que certaines de ses
 * communes membres.
 *
 * La distinction est portée par `inMontesquieu` : elle n'a pas d'incidence
 * opérationnelle, mais les contenus publics ne doivent pas laisser croire que
 * ces trois communes font partie de l'intercommunalité.
 *
 * Données factuelles (code INSEE, code postal, population légale, centroïde)
 * issues de l'API Découpage administratif de l'État (geo.api.gouv.fr).
 * Elles alimentent le contrôle de couverture, le géocodage, les pages SEO
 * locales et les fichiers llms.txt : elles doivent rester exactes.
 */

export type CommuneSlug =
  | "ayguemorte-les-graves"
  | "beautiran"
  | "cabanac-et-villagrains"
  | "cadaujac"
  | "castres-gironde"
  | "isle-saint-georges"
  | "la-brede"
  | "leognan"
  | "martillac"
  | "saint-medard-d-eyrans"
  | "saint-morillon"
  | "saint-selve"
  | "saucats"
  | "gradignan"
  | "villenave-d-ornon"
  | "cestas";

export interface Commune {
  /** Segment d'URL, sans accent ni apostrophe. */
  readonly slug: CommuneSlug;
  /** Nom officiel, accentué, tel qu'il doit être affiché. */
  readonly name: string;
  /** Code INSEE à 5 caractères. Clé de jointure avec la Base Adresse Nationale. */
  readonly insee: string;
  readonly postalCode: string;
  /** Population légale (recensement INSEE). */
  readonly population: number;
  /** Centroïde de la commune, WGS84. */
  readonly lat: number;
  readonly lng: number;
  /** Léognan, siège de Léo Clean. */
  readonly isHeadquarters: boolean;
  /**
   * Membre de la Communauté de communes de Montesquieu.
   *
   * Faux pour Gradignan, Villenave-d'Ornon et Cestas, desservies aux mêmes
   * conditions mais rattachées à d'autres intercommunalités. Écrire le
   * contraire dans un contenu public serait inexact.
   */
  readonly inMontesquieu: boolean;
}

export const COMMUNES: readonly Commune[] = [
  {
    slug: "ayguemorte-les-graves",
    name: "Ayguemorte-les-Graves",
    insee: "33023",
    postalCode: "33640",
    population: 1425,
    lat: 44.7027,
    lng: -0.4857,
    isHeadquarters: false,
    inMontesquieu: true,
  },
  {
    slug: "beautiran",
    name: "Beautiran",
    insee: "33037",
    postalCode: "33640",
    population: 2488,
    lat: 44.7035,
    lng: -0.4604,
    isHeadquarters: false,
    inMontesquieu: true,
  },
  {
    slug: "cabanac-et-villagrains",
    name: "Cabanac-et-Villagrains",
    insee: "33077",
    postalCode: "33650",
    population: 2400,
    lat: 44.5889,
    lng: -0.5412,
    isHeadquarters: false,
    inMontesquieu: true,
  },
  {
    slug: "cadaujac",
    name: "Cadaujac",
    insee: "33080",
    postalCode: "33140",
    population: 6909,
    lat: 44.7468,
    lng: -0.5316,
    isHeadquarters: false,
    inMontesquieu: true,
  },
  {
    slug: "castres-gironde",
    name: "Castres-Gironde",
    insee: "33109",
    postalCode: "33640",
    population: 2695,
    lat: 44.6866,
    lng: -0.4566,
    isHeadquarters: false,
    inMontesquieu: true,
  },
  {
    slug: "isle-saint-georges",
    name: "Isle-Saint-Georges",
    insee: "33206",
    postalCode: "33640",
    population: 502,
    lat: 44.7277,
    lng: -0.4755,
    isHeadquarters: false,
    inMontesquieu: true,
  },
  {
    slug: "la-brede",
    name: "La Brède",
    insee: "33213",
    postalCode: "33650",
    population: 4386,
    lat: 44.6777,
    lng: -0.5396,
    isHeadquarters: false,
    inMontesquieu: true,
  },
  {
    slug: "leognan",
    name: "Léognan",
    insee: "33238",
    postalCode: "33850",
    population: 10670,
    lat: 44.7236,
    lng: -0.6172,
    isHeadquarters: true,
    inMontesquieu: true,
  },
  {
    slug: "martillac",
    name: "Martillac",
    insee: "33274",
    postalCode: "33650",
    population: 3659,
    lat: 44.7176,
    lng: -0.558,
    isHeadquarters: false,
    inMontesquieu: true,
  },
  {
    slug: "saint-medard-d-eyrans",
    name: "Saint-Médard-d'Eyrans",
    insee: "33448",
    postalCode: "33650",
    population: 3409,
    lat: 44.714,
    lng: -0.5125,
    isHeadquarters: false,
    inMontesquieu: true,
  },
  {
    slug: "saint-morillon",
    name: "Saint-Morillon",
    insee: "33454",
    postalCode: "33650",
    population: 1834,
    lat: 44.6387,
    lng: -0.5232,
    isHeadquarters: false,
    inMontesquieu: true,
  },
  {
    slug: "saint-selve",
    name: "Saint-Selve",
    insee: "33474",
    postalCode: "33650",
    population: 3746,
    lat: 44.6574,
    lng: -0.4726,
    isHeadquarters: false,
    inMontesquieu: true,
  },
  {
    slug: "saucats",
    name: "Saucats",
    insee: "33501",
    postalCode: "33650",
    population: 3548,
    lat: 44.6476,
    lng: -0.6377,
    isHeadquarters: false,
    inMontesquieu: true,
  },

  // --- Communes limitrophes, hors Communauté de communes de Montesquieu ---
  {
    slug: "gradignan",
    name: "Gradignan",
    insee: "33192",
    postalCode: "33170",
    population: 26952,
    lat: 44.7681,
    lng: -0.6163,
    isHeadquarters: false,
    inMontesquieu: false,
  },
  {
    slug: "villenave-d-ornon",
    name: "Villenave-d'Ornon",
    insee: "33550",
    postalCode: "33140",
    population: 42545,
    lat: 44.7736,
    lng: -0.5523,
    isHeadquarters: false,
    inMontesquieu: false,
  },
  {
    slug: "cestas",
    name: "Cestas",
    insee: "33122",
    postalCode: "33610",
    population: 16666,
    lat: 44.7274,
    lng: -0.7349,
    isHeadquarters: false,
    inMontesquieu: false,
  },
] as const;

/** Les 13 communes de la Communauté de communes de Montesquieu. */
export const MONTESQUIEU_COMMUNES: readonly Commune[] = COMMUNES.filter(
  (commune) => commune.inMontesquieu,
);

/** Communes desservies hors intercommunalité de Montesquieu. */
export const ADJACENT_COMMUNES: readonly Commune[] = COMMUNES.filter(
  (commune) => !commune.inMontesquieu,
);

/** Population cumulée de la zone couverte. */
export const TERRITORY_POPULATION: number = COMMUNES.reduce(
  (sum, commune) => sum + commune.population,
  0,
);

/** Commune siège. Léognan est garanti présent par le test d'invariants. */
export const HEADQUARTERS: Commune = COMMUNES.find((c) => c.isHeadquarters)!;

const BY_SLUG = new Map<string, Commune>(COMMUNES.map((c) => [c.slug, c]));
const BY_INSEE = new Map<string, Commune>(COMMUNES.map((c) => [c.insee, c]));

export function getCommuneBySlug(slug: string): Commune | undefined {
  return BY_SLUG.get(slug);
}

/**
 * Résout une commune depuis le code INSEE renvoyé par la Base Adresse
 * Nationale. Le code INSEE est le seul identifiant fiable : plusieurs communes
 * de la zone partagent un code postal (33640, 33650) et les noms sont saisis
 * de façon inconstante par les clients.
 */
export function getCommuneByInsee(insee: string): Commune | undefined {
  return BY_INSEE.get(insee);
}

/** Contrôle de couverture. Source de vérité unique du périmètre commercial. */
export function isCoveredInsee(insee: string): boolean {
  return BY_INSEE.has(insee);
}

/** Codes postaux distincts de la zone, triés. */
export const TERRITORY_POSTAL_CODES: readonly string[] = [
  ...new Set(COMMUNES.map((c) => c.postalCode)),
].sort();

/** Communes triées par population décroissante (ordre d'affichage par défaut). */
export const COMMUNES_BY_POPULATION: readonly Commune[] = [...COMMUNES].sort(
  (a, b) => b.population - a.population,
);

/**
 * Rayon en kilomètres couvrant toutes les communes depuis Léognan.
 * Alimente le `GeoCircle` du JSON-LD `Service.areaServed`.
 */
export function coverageRadiusKm(): number {
  const distances = COMMUNES.map((c) =>
    haversineKm(HEADQUARTERS.lat, HEADQUARTERS.lng, c.lat, c.lng),
  );
  return Math.ceil(Math.max(...distances));
}

const EARTH_RADIUS_KM = 6371;

/**
 * Distance orthodromique en kilomètres.
 *
 * Utilisée uniquement pour des bornes géographiques (rayon de couverture,
 * pré-filtrage de candidats). Elle ne doit jamais servir à estimer un temps de
 * trajet : c'est le rôle de `TravelTimeProvider` (voir lib/scheduling).
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}
