import { describe, expect, it } from "vitest";

import {
  ADJACENT_COMMUNES,
  COMMUNES,
  MONTESQUIEU_COMMUNES,
  HEADQUARTERS,
  TERRITORY_POPULATION,
  TERRITORY_POSTAL_CODES,
  coverageRadiusKm,
  getCommuneByInsee,
  getCommuneBySlug,
  haversineKm,
  isCoveredInsee,
  nearestCommunes,
} from "./territory";

describe("référentiel des communes", () => {
  it("couvre 16 communes, dont les 13 de la CC de Montesquieu", () => {
    expect(COMMUNES).toHaveLength(16);
    expect(MONTESQUIEU_COMMUNES).toHaveLength(13);
    expect(ADJACENT_COMMUNES.map((c) => c.name)).toEqual([
      "Gradignan",
      "Villenave-d'Ornon",
      "Cestas",
    ]);
  });

  it("n'attribue pas les communes limitrophes à l'intercommunalité", () => {
    // Écrire que Gradignan appartient à la Communauté de communes de
    // Montesquieu serait factuellement faux, et repris tel quel par les
    // moteurs comme par les modèles de langage.
    for (const commune of ADJACENT_COMMUNES) {
      expect(commune.inMontesquieu).toBe(false);
    }
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
      // Cestas, à l'ouest, est le point le plus éloigné en longitude.
      expect(commune.lng).toBeGreaterThan(-0.75);
      expect(commune.lng).toBeLessThan(-0.4);
    }
  });

  it("totalise la population annoncée sur le site", () => {
    expect(TERRITORY_POPULATION).toBe(133_834);
    const montesquieu = MONTESQUIEU_COMMUNES.reduce(
      (sum, c) => sum + c.population,
      0,
    );
    expect(montesquieu).toBe(47_671);
  });

  it("connaît six codes postaux, dont plusieurs partagés", () => {
    // Cadaujac et Villenave-d'Ornon partagent le 33140 : une raison de plus de
    // ne jamais résoudre une commune par son code postal.
    expect(TERRITORY_POSTAL_CODES).toEqual([
      "33140",
      "33170",
      "33610",
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

  it("accepte désormais les communes limitrophes desservies", () => {
    expect(isCoveredInsee("33192")).toBe(true); // Gradignan
    expect(isCoveredInsee("33550")).toBe(true); // Villenave-d'Ornon
    expect(isCoveredInsee("33122")).toBe(true); // Cestas
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

describe("voisinage", () => {
  /**
   * Le maillage latéral s'appuie sur cette fonction : chaque page locale lie
   * vers ses voisines plutôt que vers les quinze autres. Un maillage qui
   * expose tout depuis partout dilue la transmission d'autorité au lieu de la
   * concentrer.
   */
  it("ne se compte jamais elle-même", () => {
    for (const commune of COMMUNES) {
      const voisines = nearestCommunes(commune, 3);
      expect(voisines.map((entry) => entry.slug)).not.toContain(commune.slug);
    }
  });

  it("rend exactement le nombre demandé", () => {
    for (const commune of COMMUNES) {
      expect(nearestCommunes(commune, 3)).toHaveLength(3);
    }
  });

  it("les classe de la plus proche à la plus lointaine", () => {
    for (const commune of COMMUNES) {
      const distances = nearestCommunes(commune, 5).map((voisine) =>
        haversineKm(commune.lat, commune.lng, voisine.lat, voisine.lng),
      );
      expect(distances).toEqual([...distances].sort((a, b) => a - b));
    }
  });

  it("donne des voisinages qui se tiennent sur le terrain", () => {
    // Martillac et Saint-Médard-d'Eyrans se touchent : chacune doit figurer
    // dans le voisinage immédiat de l'autre.
    const martillac = getCommuneBySlug("martillac")!;
    expect(nearestCommunes(martillac, 3).map((c) => c.slug)).toContain(
      "saint-medard-d-eyrans",
    );

    // Cabanac-et-Villagrains est la plus méridionale du territoire :
    // Villenave-d'Ornon, tout au nord, n'a rien à faire dans son voisinage.
    const cabanac = getCommuneBySlug("cabanac-et-villagrains")!;
    const voisines = nearestCommunes(cabanac, 3).map((c) => c.slug);
    expect(voisines).toContain("saint-morillon");
    expect(voisines).not.toContain("villenave-d-ornon");
  });
});
