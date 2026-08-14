import { describe, expect, it } from "vitest";

import {
  estimateTravelMinutes,
  geometricTravelTimeProvider,
  roundTravelBuffer,
  travelKey,
  travelMatrixFrom,
} from "@/lib/scheduling/travel";
import { COMMUNES, getCommuneBySlug } from "@/lib/territory";

const point = (slug: string) => {
  const commune = getCommuneBySlug(slug);
  if (!commune) throw new Error(`Commune inconnue : ${slug}`);
  return { lat: commune.lat, lng: commune.lng };
};

describe("estimation géométrique du temps de trajet", () => {
  it("renvoie zéro entre un point et lui-même", () => {
    expect(estimateTravelMinutes(point("leognan"), point("leognan"))).toBe(0);
  });

  it("croît avec la distance", () => {
    const proche = estimateTravelMinutes(point("leognan"), point("martillac"));
    const loin = estimateTravelMinutes(point("leognan"), point("saint-selve"));
    expect(loin).toBeGreaterThan(proche);
  });

  it("est symétrique", () => {
    // Le modèle est purement géométrique : il ne connaît ni sens interdit ni
    // heure de pointe. L'asymétrie n'apparaîtra qu'avec un vrai calculateur
    // d'itinéraire, et c'est une raison de plus pour que celui-ci reste
    // remplaçable.
    for (const commune of COMMUNES) {
      const aller = estimateTravelMinutes(point("leognan"), {
        lat: commune.lat,
        lng: commune.lng,
      });
      const retour = estimateTravelMinutes(
        { lat: commune.lat, lng: commune.lng },
        point("leognan"),
      );
      expect(aller).toBe(retour);
    }
  });

  it("reste plausible sur tout le territoire", () => {
    // Aucun trajet interne au territoire ne doit sortir de cette fourchette :
    // au-delà, c'est que le modèle ou les coordonnées ont dérivé.
    for (const from of COMMUNES) {
      for (const to of COMMUNES) {
        if (from.slug === to.slug) continue;
        const minutes = estimateTravelMinutes(
          { lat: from.lat, lng: from.lng },
          { lat: to.lat, lng: to.lng },
        );
        expect(minutes, `${from.slug} → ${to.slug}`).toBeGreaterThanOrEqual(4);
        expect(minutes, `${from.slug} → ${to.slug}`).toBeLessThanOrEqual(45);
      }
    }
  });

  it("reste proche des itinéraires réellement mesurés", () => {
    // Contrôle de calibrage. Les valeurs de référence viennent d'un calcul
    // d'itinéraire routier de mairie à mairie ; le modèle est ajusté dessus et
    // ne doit pas s'en écarter de plus de cinq minutes.
    const mesures: [string, { lat: number; lng: number }, number][] = [
      ["martillac", { lat: 44.7128, lng: -0.5431 }, 8.1],
      ["cadaujac", { lat: 44.7558, lng: -0.5296 }, 10.8],
      ["gradignan", { lat: 44.7725, lng: -0.6083 }, 12.2],
      ["la-brede", { lat: 44.6814, lng: -0.5278 }, 13.0],
      ["isle-saint-georges", { lat: 44.7249, lng: -0.4718 }, 17.8],
      ["cabanac", { lat: 44.6068, lng: -0.5534 }, 18.5],
      ["saint-morillon", { lat: 44.65, lng: -0.5031 }, 20.9],
    ];
    const mairieLeognan = { lat: 44.7278, lng: -0.5971 };

    for (const [nom, destination, mesure] of mesures) {
      const estimation = estimateTravelMinutes(mairieLeognan, destination);
      expect(Math.abs(estimation - mesure), nom).toBeLessThanOrEqual(5);
    }
  });

  it("expose une durée entière et une distance en mètres", async () => {
    const estimate = await geometricTravelTimeProvider.estimate(
      point("leognan"),
      point("cestas"),
    );
    expect(Number.isInteger(estimate.durationMinutes)).toBe(true);
    expect(estimate.distanceMeters).toBeGreaterThan(0);
    expect(estimate.provider).toBe("geometrique");
  });
});

describe("clé de cache", () => {
  it("regroupe deux points distants de moins de cent mètres", () => {
    // Trois décimales, soit environ 110 mètres : deux voisins de la même rue
    // partagent une entrée de cache, ce qui est l'objet de l'arrondi.
    expect(travelKey({ lat: 44.72361, lng: -0.61724 })).toBe(
      travelKey({ lat: 44.72358, lng: -0.61719 }),
    );
  });

  it("distingue deux points réellement différents", () => {
    expect(travelKey(point("leognan"))).not.toBe(travelKey(point("cestas")));
  });
});

describe("arrondi des tampons de trajet", () => {
  it("arrondit au pas de cinq minutes supérieur", () => {
    expect(roundTravelBuffer(0)).toBe(0);
    expect(roundTravelBuffer(1)).toBe(5);
    expect(roundTravelBuffer(11)).toBe(15);
    expect(roundTravelBuffer(15)).toBe(15);
  });

  it("n'arrondit jamais vers le bas", () => {
    // Arrondir un trajet à la baisse ferait vendre un créneau qu'on ne peut
    // pas tenir : le tampon doit toujours couvrir la route réelle.
    for (let minutes = 0; minutes <= 60; minutes += 1) {
      expect(roundTravelBuffer(minutes)).toBeGreaterThanOrEqual(minutes);
    }
  });
});

describe("table de trajets pré-résolue", () => {
  it("préfère la valeur mesurée à l'estimation", () => {
    const matrix = travelMatrixFrom([
      {
        origin: point("leognan"),
        destination: point("cestas"),
        durationMinutes: 11,
      },
    ]);
    expect(matrix.minutesBetween(point("leognan"), point("cestas"))).toBe(11);
  });

  it("retombe sur l'estimation quand le couple est absent", () => {
    // Un cache froid ne doit pas fermer la réservation : il doit dégrader la
    // précision, pas la disponibilité.
    const matrix = travelMatrixFrom([]);
    expect(matrix.minutesBetween(point("leognan"), point("saucats"))).toBe(
      estimateTravelMinutes(point("leognan"), point("saucats")),
    );
  });

  it("ne confond pas l'aller et le retour", () => {
    const matrix = travelMatrixFrom([
      {
        origin: point("leognan"),
        destination: point("cestas"),
        durationMinutes: 11,
      },
      {
        origin: point("cestas"),
        destination: point("leognan"),
        durationMinutes: 14,
      },
    ]);
    expect(matrix.minutesBetween(point("leognan"), point("cestas"))).toBe(11);
    expect(matrix.minutesBetween(point("cestas"), point("leognan"))).toBe(14);
  });
});
