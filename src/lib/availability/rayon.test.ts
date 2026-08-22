import { describe, expect, it } from "vitest";

import {
  RAYON_DEFAUT_KM,
  RAYON_MAX_KM,
  RAYON_MIN_KM,
  RAYON_PAS_KM,
  projeter,
  rayonValide,
  resumeDuRayon,
} from "@/lib/availability/rayon";
import { COMMUNES, HEADQUARTERS, haversineKm } from "@/lib/territory";

const CARTE = COMMUNES.map((commune) => ({
  slug: commune.slug,
  name: commune.name,
  lat: commune.lat,
  lng: commune.lng,
}));

describe("bornes du réglage", () => {
  it("n'accepte que des multiples du pas, dans les bornes", () => {
    expect(rayonValide(20)).toBe(true);
    expect(rayonValide(RAYON_MIN_KM)).toBe(true);
    expect(rayonValide(RAYON_MAX_KM)).toBe(true);
    expect(rayonValide(RAYON_MIN_KM - RAYON_PAS_KM)).toBe(false);
    expect(rayonValide(RAYON_MAX_KM + RAYON_PAS_KM)).toBe(false);
    expect(rayonValide(22)).toBe(false);
    expect(rayonValide(12.5)).toBe(false);
  });

  it("garde le défaut au niveau de celui de la migration", () => {
    // Une divergence ici ferait afficher un rayon que la base ne porte pas,
    // et le premier enregistrement changerait silencieusement le périmètre.
    expect(RAYON_DEFAUT_KM).toBe(20);
    expect(rayonValide(RAYON_DEFAUT_KM)).toBe(true);
  });

  it("couvre tout le territoire depuis le siège", () => {
    // C'est la justification du défaut : il ne retire personne de la
    // circulation le jour de la migration.
    const carte = projeter(HEADQUARTERS, CARTE, RAYON_DEFAUT_KM);
    expect(carte.couvertes).toBe(carte.total);
  });
});

describe("projection", () => {
  it("place le centre au milieu et le nord vers le haut", () => {
    const carte = projeter(HEADQUARTERS, CARTE, 20);
    const siege = carte.communes.find(
      (commune) => commune.slug === HEADQUARTERS.slug,
    );
    expect(siege?.x).toBeCloseTo(50, 6);
    expect(siege?.y).toBeCloseTo(50, 6);

    const gradignan = carte.communes.find(
      (commune) => commune.slug === "gradignan",
    );
    // Gradignan est au nord de Léognan : plus haut dans le dessin.
    expect(gradignan!.lat).toBeGreaterThan(HEADQUARTERS.lat);
    expect(gradignan!.y).toBeLessThan(50);
  });

  it("dit couverte exactement ce que le moteur accepterait", () => {
    // La carte et `horsDuRayon` doivent trancher pareil : un cercle qui
    // promettrait une commune que le moteur refuse ferait douter du réglage.
    const rayon = 10;
    const carte = projeter(HEADQUARTERS, CARTE, rayon);
    for (const commune of carte.communes) {
      const km = haversineKm(
        HEADQUARTERS.lat,
        HEADQUARTERS.lng,
        commune.lat,
        commune.lng,
      );
      expect(commune.couverte).toBe(km <= rayon);
    }
  });

  it("garde les communes exclues dans le cadre", () => {
    // Cadrer sur le seul rayon les ferait disparaître, et resserrer le
    // réglage ne montrerait plus ce qu'on perd.
    const carte = projeter(HEADQUARTERS, CARTE, RAYON_MIN_KM);
    expect(carte.communes.some((commune) => !commune.couverte)).toBe(true);
    for (const commune of carte.communes) {
      expect(commune.x).toBeGreaterThanOrEqual(0);
      expect(commune.x).toBeLessThanOrEqual(100);
      expect(commune.y).toBeGreaterThanOrEqual(0);
      expect(commune.y).toBeLessThanOrEqual(100);
    }
  });

  it("garde le cercle dans le cadre au rayon maximal", () => {
    const carte = projeter(HEADQUARTERS, CARTE, RAYON_MAX_KM);
    expect(carte.rayonRelatif).toBeLessThanOrEqual(50);
  });

  it("dessine les communes couvertes en dernier", () => {
    const carte = projeter(HEADQUARTERS, CARTE, 10);
    const premiereCouverte = carte.communes.findIndex(
      (commune) => commune.couverte,
    );
    expect(
      carte.communes.slice(premiereCouverte).every((c) => c.couverte),
    ).toBe(true);
  });
});

describe("résumé", () => {
  it("annonce l'absence de proposition quand rien n'est couvert", () => {
    const loin = { lat: 48.8566, lng: 2.3522 }; // Paris.
    const carte = projeter(loin, CARTE, RAYON_MAX_KM);
    expect(resumeDuRayon(carte, RAYON_MAX_KM)).toContain("aucune proposition");
  });

  it("compte ce que la carte a compté, jamais autre chose", () => {
    const carte = projeter(HEADQUARTERS, CARTE, 10);
    expect(resumeDuRayon(carte, 10)).toContain(String(carte.couvertes));
  });
});

describe("étiquettes", () => {
  /*
   * Sept communes se serrent dans deux kilomètres carrés : sans arbitrage, le
   * dessin superposait « Ayguemorte-les-Graves », « Beautiran » et
   * « Saint-Médard-d'Eyrans » au même endroit, et plus aucun nom n'était
   * lisible — pas même ceux qui ne se chevauchaient pas.
   */
  it("n'étiquette jamais deux noms qui se recouvriraient", () => {
    const carte = projeter(HEADQUARTERS, CARTE, 20);
    const etiquetees = carte.communes.filter((commune) => commune.etiquette);

    for (const a of etiquetees) {
      for (const b of etiquetees) {
        if (a.slug === b.slug) continue;
        const demiLargeurs =
          (a.name.length * 1.35) / 2 + (b.name.length * 1.35) / 2;
        const seChevauchent =
          Math.abs(a.x - b.x) <= demiLargeurs && Math.abs(a.y - b.y) <= 3.4;
        expect(seChevauchent).toBe(false);
      }
    }
  });

  it("ne sacrifie jamais un nom couvert au profit d'un nom exclu", () => {
    // C'est la propriété qui rend l'arbitrage défendable : une commune
    // couverte peut perdre son nom, mais seulement contre une autre commune
    // couverte — jamais contre une que le rayon vient d'écarter.
    const carte = projeter(HEADQUARTERS, CARTE, 8);
    const chevauchent = (a: (typeof carte.communes)[number], b: typeof a) =>
      Math.abs(a.x - b.x) <=
        (a.name.length * 1.35) / 2 + (b.name.length * 1.35) / 2 &&
      Math.abs(a.y - b.y) <= 3.4;

    for (const commune of carte.communes) {
      if (!commune.couverte || commune.etiquette) continue;
      const bloqueePar = carte.communes.filter(
        (autre) =>
          autre.slug !== commune.slug &&
          autre.etiquette &&
          chevauchent(commune, autre),
      );
      expect(bloqueePar.length).toBeGreaterThan(0);
      expect(bloqueePar.some((autre) => autre.couverte)).toBe(true);
    }
  });
});
