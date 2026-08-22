import { describe, expect, it } from "vitest";

import {
  AIRE_MINIMALE_KM2,
  SOMMETS_MAX,
  aireKm2,
  cadre,
  dansLaZone,
  simplifier,
  verifierLaZone,
} from "@/lib/availability/zone";
import { COMMUNES, HEADQUARTERS } from "@/lib/territory";

/** Carré d'environ 0,2° de côté autour de Léognan — une vingtaine de km. */
const CARRE = [
  { lat: HEADQUARTERS.lat - 0.1, lng: HEADQUARTERS.lng - 0.1 },
  { lat: HEADQUARTERS.lat - 0.1, lng: HEADQUARTERS.lng + 0.1 },
  { lat: HEADQUARTERS.lat + 0.1, lng: HEADQUARTERS.lng + 0.1 },
  { lat: HEADQUARTERS.lat + 0.1, lng: HEADQUARTERS.lng - 0.1 },
];

describe("appartenance", () => {
  it("place le centre dedans et le lointain dehors", () => {
    expect(dansLaZone(HEADQUARTERS, CARRE)).toBe(true);
    expect(dansLaZone({ lat: 48.8566, lng: 2.3522 }, CARRE)).toBe(false);
  });

  it("tranche pareil sur toutes les communes, quel que soit l'ordre des sommets", () => {
    // Un tracé au doigt peut tourner dans les deux sens : le lancer de rayon
    // ne doit pas s'en apercevoir.
    const inverse = [...CARRE].reverse();
    for (const commune of COMMUNES) {
      expect(dansLaZone(commune, CARRE)).toBe(dansLaZone(commune, inverse));
    }
  });

  it("ne compte pas deux fois un sommet traversé à sa latitude exacte", () => {
    // La convention [bas, haut) existe pour ce cas : sans elle, un point à la
    // latitude d'un sommet est déclaré dehors alors qu'il est dedans.
    const triangle = [
      { lat: 0, lng: 0 },
      { lat: 1, lng: 2 },
      { lat: 2, lng: 0 },
    ];
    expect(dansLaZone({ lat: 1, lng: 0.5 }, triangle)).toBe(true);
  });

  it("refuse un point hors du polygone mais dans son rectangle englobant", () => {
    const l = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 2 },
      { lat: 1, lng: 2 },
      { lat: 1, lng: 1 },
      { lat: 2, lng: 1 },
      { lat: 2, lng: 0 },
    ];
    expect(dansLaZone({ lat: 1.5, lng: 1.5 }, l)).toBe(false);
    expect(dansLaZone({ lat: 0.5, lng: 1.5 }, l)).toBe(true);
  });
});

describe("aire", () => {
  it("mesure un carré connu", () => {
    // 0,2° de latitude ≈ 22,3 km ; 0,2° de longitude à 44,7° ≈ 15,8 km.
    expect(aireKm2(CARRE)).toBeGreaterThan(300);
    expect(aireKm2(CARRE)).toBeLessThan(400);
  });

  it("ne dépend pas du sens de parcours", () => {
    expect(aireKm2([...CARRE].reverse())).toBeCloseTo(aireKm2(CARRE), 6);
  });
});

describe("simplification", () => {
  it("garde la forme et respecte le plafond", () => {
    // Un tracé au doigt : trois cents points sur un cercle.
    const cercle = Array.from({ length: 300 }, (_, index) => {
      const angle = (index / 300) * 2 * Math.PI;
      return {
        lat: HEADQUARTERS.lat + 0.1 * Math.sin(angle),
        lng: HEADQUARTERS.lng + 0.1 * Math.cos(angle),
      };
    });

    const simple = simplifier(cercle);
    expect(simple.length).toBeLessThanOrEqual(SOMMETS_MAX);
    expect(simple.length).toBeGreaterThanOrEqual(3);
    // Le centre reste dedans : la forme n'a pas été détruite.
    expect(dansLaZone(HEADQUARTERS, simple)).toBe(true);
    // L'aire ne s'effondre pas.
    expect(aireKm2(simple)).toBeGreaterThan(aireKm2(cercle) * 0.9);
  });

  it("laisse tranquille un tracé déjà court", () => {
    expect(simplifier(CARRE)).toHaveLength(CARRE.length);
  });
});

describe("validation", () => {
  it("refuse un tracé involontaire", () => {
    // Un tap qui glisse de quelques pixels produit un polygone valide et
    // minuscule, qui couperait toutes les missions sans que personne
    // comprenne pourquoi.
    const minuscule = [
      { lat: 44.73, lng: -0.6 },
      { lat: 44.7301, lng: -0.6 },
      { lat: 44.7301, lng: -0.5999 },
    ];
    expect(aireKm2(minuscule)).toBeLessThan(AIRE_MINIMALE_KM2);
    expect(verifierLaZone(minuscule)).toBe("trop-petite");
  });

  it("refuse moins de trois points", () => {
    expect(verifierLaZone(CARRE.slice(0, 2))).toBe("trop-peu-de-points");
  });

  it("accepte un tracé raisonnable", () => {
    expect(verifierLaZone(CARRE)).toBeNull();
  });
});

describe("cadre", () => {
  it("englobe tous les sommets", () => {
    const boite = cadre(CARRE)!;
    for (const point of CARRE) {
      expect(point.lat).toBeGreaterThanOrEqual(boite.sud);
      expect(point.lat).toBeLessThanOrEqual(boite.nord);
      expect(point.lng).toBeGreaterThanOrEqual(boite.ouest);
      expect(point.lng).toBeLessThanOrEqual(boite.est);
    }
  });

  it("rend null sur une zone vide", () => {
    expect(cadre([])).toBeNull();
  });
});
