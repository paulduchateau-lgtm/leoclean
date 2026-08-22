import { haversineKm } from "@/lib/territory";

/**
 * Rayon d'action d'un intervenant, et ce qu'il couvre.
 *
 * Module **pur** : il projette des points sur un plan et compte des communes,
 * sans base ni horloge. L'écran s'en sert pour dessiner, la server action pour
 * valider — les deux voient donc la même chose, ce qui est toute la valeur de
 * la chose : un cercle qui promettrait Cestas pendant que le moteur la refuse
 * ferait douter du réglage entier.
 *
 * **C'est un cercle, donc une distance à vol d'oiseau.** La justification
 * complète est dans `scheduling/slots.horsDuRayon`, qui applique la même
 * mesure.
 */

/** Bornes du réglage, en kilomètres. */
export const RAYON_MIN_KM = 5;
export const RAYON_MAX_KM = 50;
export const RAYON_PAS_KM = 5;

/**
 * Rayon par défaut.
 *
 * Vingt kilomètres couvrent le territoire entier depuis n'importe laquelle de
 * ses communes : le défaut ne retire donc personne de la circulation. C'est la
 * même valeur que celle posée par la migration, et elle ne doit pas en diverger.
 */
export const RAYON_DEFAUT_KM = 20;

export function rayonValide(km: number): boolean {
  return (
    Number.isInteger(km) &&
    km >= RAYON_MIN_KM &&
    km <= RAYON_MAX_KM &&
    km % RAYON_PAS_KM === 0
  );
}

export interface Point {
  lat: number;
  lng: number;
}

/** Une commune telle que la carte a besoin de la connaître, et rien de plus. */
export interface CommuneCarte {
  slug: string;
  name: string;
  lat: number;
  lng: number;
}

export interface CommuneProjetee extends CommuneCarte {
  /** Distance au centre, à vol d'oiseau. */
  km: number;
  couverte: boolean;
  /** Coordonnées dans le repère du dessin, en pourcentage de la boîte. */
  x: number;
  y: number;
  /**
   * Le nom tient-il sans en recouvrir un autre ?
   *
   * Sept des seize communes se serrent dans deux kilomètres carrés : tout
   * étiqueter produit une bouillie où l'on ne lit plus aucun nom, pas même
   * ceux qui ne se chevauchent pas. Ce qui est écarté du dessin n'est pas
   * perdu — la liste sous la carte nomme toutes les communes couvertes, et
   * c'est elle qui répond exactement.
   */
  etiquette: boolean;
}

/**
 * Largeur approchée d'une étiquette, dans le repère du dessin.
 *
 * `1,35` unité par caractère à la taille de police retenue : la mesure exacte
 * demanderait le moteur de rendu, dont un module pur ne dispose pas, et
 * surestimer légèrement ne coûte qu'une étiquette de moins.
 */
const LARGEUR_PAR_CARACTERE = 1.35;
const HAUTEUR_ETIQUETTE = 3.4;

export interface Carte {
  /** Communes projetées, les couvertes d'abord — l'ordre de dessin. */
  communes: CommuneProjetee[];
  /** Rayon du cercle, en pourcentage de la demi-boîte. */
  rayonRelatif: number;
  couvertes: number;
  total: number;
}

/**
 * Projette le territoire autour d'un centre.
 *
 * **L'échelle est celle du plus grand des deux — le rayon ou la commune la
 * plus lointaine.** Cadrer sur le seul rayon ferait disparaître les communes
 * qu'on vient d'exclure, et l'intervenant ne verrait plus ce qu'il perd en
 * resserrant ; cadrer sur les seules communes ferait déborder un rayon de
 * cinquante kilomètres hors du dessin. Une marge d'un dixième évite que le
 * cercle affleure le bord.
 *
 * La projection est équirectangulaire, corrigée en longitude par le cosinus de
 * la latitude : à l'échelle d'un département, l'erreur est inférieure au pixel
 * et cela évite d'embarquer une bibliothèque cartographique pour dessiner
 * seize points.
 */
export function projeter(
  centre: Point,
  communes: readonly CommuneCarte[],
  rayonKm: number,
): Carte {
  const KM_PAR_DEGRE = 111.32;
  const cosLat = Math.cos((centre.lat * Math.PI) / 180);

  const mesurees = communes.map((commune) => ({
    ...commune,
    km: haversineKm(centre.lat, centre.lng, commune.lat, commune.lng),
    est: (commune.lng - centre.lng) * KM_PAR_DEGRE * cosLat,
    nord: (commune.lat - centre.lat) * KM_PAR_DEGRE,
  }));

  const plusLointaine = mesurees.reduce(
    (maximum, commune) => Math.max(maximum, commune.km),
    0,
  );
  const demiEtendue = Math.max(rayonKm, plusLointaine) * 1.1 || 1;

  const projetees: CommuneProjetee[] = mesurees.map((commune) => ({
    slug: commune.slug,
    name: commune.name,
    lat: commune.lat,
    lng: commune.lng,
    km: commune.km,
    couverte: commune.km <= rayonKm,
    x: 50 + (commune.est / demiEtendue) * 50,
    /* L'axe des ordonnées descend dans un SVG : le nord est vers le haut. */
    y: 50 - (commune.nord / demiEtendue) * 50,
    etiquette: false,
  }));

  /*
   * Étiquetage glouton, du plus proche du centre au plus lointain, les
   * couvertes d'abord. L'ordre est ce qui rend l'arbitrage défendable : quand
   * deux noms se disputent la place, celui qu'on garde est celui qui décrit le
   * périmètre choisi, pas celui qui se trouvait plus à l'ouest.
   */
  const posees: { x: number; y: number; demiLargeur: number }[] = [];
  for (const commune of [...projetees].sort(
    (a, b) => Number(b.couverte) - Number(a.couverte) || a.km - b.km,
  )) {
    const demiLargeur = (commune.name.length * LARGEUR_PAR_CARACTERE) / 2;
    const y = commune.y - 2.2;
    const libre = posees.every(
      (posee) =>
        Math.abs(posee.x - commune.x) > posee.demiLargeur + demiLargeur ||
        Math.abs(posee.y - y) > HAUTEUR_ETIQUETTE,
    );
    if (libre) {
      commune.etiquette = true;
      posees.push({ x: commune.x, y, demiLargeur });
    }
  }

  return {
    /* Les couvertes se dessinent en dernier : elles portent leur nom, et un
       point gris par-dessus rendrait le libellé illisible. */
    communes: [...projetees].sort(
      (a, b) => Number(a.couverte) - Number(b.couverte),
    ),
    rayonRelatif: (rayonKm / demiEtendue) * 50,
    couvertes: projetees.filter((commune) => commune.couverte).length,
    total: projetees.length,
  };
}

/**
 * Ce que le réglage promet, en une phrase.
 *
 * Elle est engendrée plutôt qu'écrite pour la même raison que partout ailleurs
 * dans le dépôt : un décompte recopié dans une page finit par diverger de
 * celui qui s'applique.
 */
export function resumeDuRayon(carte: Carte, rayonKm: number): string {
  if (carte.couvertes === 0) {
    return `Aucune de nos ${carte.total} communes n'est à moins de ${rayonKm} km de chez vous. Vous ne recevrez aucune proposition.`;
  }
  if (carte.couvertes === carte.total) {
    return `Nos ${carte.total} communes sont à moins de ${rayonKm} km de chez vous.`;
  }
  return `${carte.couvertes} de nos ${carte.total} communes sont à moins de ${rayonKm} km de chez vous.`;
}
