import { describe, expect, it } from "vitest";

import {
  COMMUNES,
  HEADQUARTERS,
  TERRITORY_POPULATION,
  TERRITORY_POSTAL_CODES,
  coverageRadiusKm,
  getCommuneByInsee,
  getCommuneBySlug,
  haversineKm,
  isCoveredInsee,
} from "./territory";

describe("référentiel des communes", () => {
  it("couvre exactement les 13 communes de la CC de Montesquieu", () => {
    expect(COMMUNES).toHaveLength(13);
  });

  it("expose Léognan comme unique siège", () => {
    const headquarters = COMMUNES.filter((c) => c.isHeadquarters);
    expect(headquarters).toHaveLength(1);
    expect(HEADQUARTERS.name).toBe("Léognan");
    expect(HEADQUARTERS.postalCode).toBe("33850");
  });

  it("n'a ni slug ni code INSEE en double", () => {
    expect(new Set(COMMUNES.map((c) => c.slug)).size).toBe(COMMUNES.length);
    expect(new Set(COMMUNES.map((c) => c.insee)).size).toBe(COMMUNES.length);
  });

  it("utilise des codes INSEE de Gironde valides", () => {
    for (const commune of COMMUNES) {
      expect(commune.insee).toMatch(/^33\d{3}$/);
      expect(commune.postalCode).toMatch(/^33\d{3}$/);
    }
  });

  it("emploie des slugs sûrs en URL", () => {
    for (const commune of COMMUNES) {
      expect(commune.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("situe chaque centroïde dans les limites du sud de la Gironde", () => {
    for (const commune of COMMUNES) {
      expect(commune.lat).toBeGreaterThan(44.5);
      expect(commune.lat).toBeLessThan(44.85);
      expect(commune.lng).toBeGreaterThan(-0.7);
      expect(commune.lng).toBeLessThan(-0.4);
    }
  });

  it("totalise la population annoncée sur le site (~47 000 habitants)", () => {
    expect(TERRITORY_POPULATION).toBe(47671);
  });

  it("ne connaît que trois codes postaux, dont deux partagés", () => {
    expect(TERRITORY_POSTAL_CODES).toEqual([
      "33140",
      "33640",
      "33650",
      "33850",
    ]);
  });
});

describe("résolution de commune", () => {
  it("résout par slug", () => {
    expect(getCommuneBySlug("leognan")?.insee).toBe("33238");
    expect(getCommuneBySlug("saint-medard-d-eyrans")?.name).toBe(
      "Saint-Médard-d'Eyrans",
    );
  });

  it("résout par code INSEE, identifiant renvoyé par la BAN", () => {
    expect(getCommuneByInsee("33213")?.name).toBe("La Brède");
  });

  it("renvoie undefined hors zone plutôt que de lever", () => {
    expect(getCommuneBySlug("bordeaux")).toBeUndefined();
    expect(getCommuneByInsee("33063")).toBeUndefined();
  });
});

describe("contrôle de couverture", () => {
  it("accepte les communes de la zone", () => {
    expect(isCoveredInsee("33238")).toBe(true);
    expect(isCoveredInsee("33501")).toBe(true);
  });

  it("refuse Bordeaux, Pessac et Mérignac, limitrophes mais hors zone", () => {
    expect(isCoveredInsee("33063")).toBe(false);
    expect(isCoveredInsee("33318")).toBe(false);
    expect(isCoveredInsee("33281")).toBe(false);
  });
});

describe("géométrie", () => {
  it("calcule une distance plausible entre Léognan et Saucats", () => {
    // ~10 km à vol d'oiseau, deux communes voisines du sud de la zone.
    const km = haversineKm(44.7236, -0.6172, 44.6476, -0.6377);
    expect(km).toBeGreaterThan(8);
    expect(km).toBeLessThan(10);
  });

  it("renvoie zéro pour un point sur lui-même", () => {
    expect(haversineKm(44.7236, -0.6172, 44.7236, -0.6172)).toBe(0);
  });

  it("couvre toute la zone depuis Léognan dans un rayon exploitable", () => {
    const radius = coverageRadiusKm();
    expect(radius).toBeGreaterThan(10);
    expect(radius).toBeLessThan(20);
  });
});
