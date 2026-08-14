import { describe, expect, it } from "vitest";

import {
  PUBLISHED_COMMUNE_SLUGS,
  getPublishedCommune,
  isCoveredButUnpublished,
  publishedCommunes,
} from "@/lib/communes-content";
import { COMMUNES, HEADQUARTERS } from "@/lib/territory";

/**
 * Ces tests ne jugent pas le style : ils défendent la règle qui fait tenir tout
 * le référencement local — chaque page dit quelque chose que les quinze autres
 * ne disent pas. Une page satellite est produite par substitution d'un nom de
 * ville dans un gabarit ; ce qui suit rend cette substitution détectable.
 */

const published = publishedCommunes();

describe("contenu des pages communes", () => {
  it("couvre les seize communes desservies, sans doublon", () => {
    expect(new Set(PUBLISHED_COMMUNE_SLUGS).size).toBe(
      PUBLISHED_COMMUNE_SLUGS.length,
    );
    expect(PUBLISHED_COMMUNE_SLUGS.length).toBe(COMMUNES.length);
    for (const commune of COMMUNES) {
      expect(getPublishedCommune(commune.slug)).toBeDefined();
      expect(isCoveredButUnpublished(commune.slug)).toBe(false);
    }
  });

  it("est ordonné par population décroissante", () => {
    const populations = published.map(({ commune }) => commune.population);
    expect(populations).toEqual([...populations].sort((a, b) => b - a));
  });

  it("n'écrit jamais deux fois la même phrase", () => {
    // Le test décisif : si un paragraphe apparaît sur deux communes, c'est
    // qu'il aurait pu être écrit pour n'importe laquelle.
    const intros = published.map(({ content }) => content.intro);
    const housings = published.map(({ content }) => content.housing);
    const landmarks = published.flatMap(({ content }) => content.landmarks);
    const questions = published.flatMap(({ content }) =>
      content.faq.map((entry) => entry.question),
    );
    const answers = published.flatMap(({ content }) =>
      content.faq.map((entry) => entry.answer),
    );

    for (const [label, values] of [
      ["intro", intros],
      ["habitat", housings],
      ["repères", landmarks],
      ["questions", questions],
      ["réponses", answers],
    ] as const) {
      const duplicates = values.filter(
        (value, index) => values.indexOf(value) !== index,
      );
      expect(duplicates, `${label} dupliqué`).toEqual([]);
    }
  });

  it("nomme sa propre commune dans son paragraphe d'ouverture", () => {
    for (const { commune, content } of published) {
      expect(content.intro).toContain(commune.name);
    }
  });

  it("porte des repères et des questions sur chaque commune", () => {
    for (const { commune, content } of published) {
      expect(content.landmarks.length, commune.slug).toBeGreaterThanOrEqual(3);
      expect(content.faq.length, commune.slug).toBeGreaterThanOrEqual(2);
      for (const entry of content.faq) {
        expect(entry.question.endsWith("?"), entry.question).toBe(true);
        expect(entry.answer.length).toBeGreaterThan(80);
      }
    }
  });

  it("annonce des temps de trajet plausibles, mesurés depuis Léognan", () => {
    for (const { commune, content } of published) {
      if (commune.isHeadquarters) {
        expect(content.driveMinutesFromLeognan).toBe(0);
        expect(content.driveKmFromLeognan).toBe(0);
        continue;
      }
      expect(content.driveMinutesFromLeognan, commune.slug).toBeGreaterThan(0);
      expect(content.driveMinutesFromLeognan, commune.slug).toBeLessThanOrEqual(
        30,
      );
      // Une route ne peut pas être plus courte que la ligne droite, et un
      // détour de plus du double signalerait un point de mesure aberrant —
      // typiquement un centroïde tombé en pleine forêt plutôt que le bourg.
      expect(content.driveKmFromLeognan, commune.slug).toBeGreaterThan(0);
      const straightLine = haversineKm(commune);
      expect(content.driveKmFromLeognan, commune.slug).toBeGreaterThan(
        straightLine * 0.7,
      );
      expect(content.driveKmFromLeognan, commune.slug).toBeLessThan(
        straightLine * 2.5,
      );
    }
  });

  it("réserve les superlatifs de distance à la commune qui les mérite", () => {
    // Ces phrases sont les plus fragiles du corpus : elles restent vraies
    // tant que personne ne modifie un temps de trajet sans relire les seize
    // fiches. Le test le fait à sa place.
    const others = published.filter(({ commune }) => !commune.isHeadquarters);
    const nearest = others.reduce((a, b) =>
      a.content.driveMinutesFromLeognan <= b.content.driveMinutesFromLeognan
        ? a
        : b,
    );
    const farthest = others.reduce((a, b) =>
      a.content.driveMinutesFromLeognan >= b.content.driveMinutesFromLeognan
        ? a
        : b,
    );

    expect(nearest.commune.slug).toBe("martillac");
    expect(nearest.content.intro).toContain("la plus proche");
    expect(farthest.commune.slug).toBe("saint-morillon");
    expect(farthest.content.intro).toContain("la plus longue à rejoindre");

    // Et personne d'autre ne revendique ces deux places.
    for (const { commune, content } of others) {
      if (commune.slug !== nearest.commune.slug) {
        expect(content.intro, commune.slug).not.toContain("la plus proche");
      }
      if (commune.slug !== farthest.commune.slug) {
        expect(content.intro, commune.slug).not.toContain(
          "la plus longue à rejoindre",
        );
      }
    }
  });

  it("n'attribue jamais Gradignan, Villenave-d'Ornon ou Cestas à Montesquieu", () => {
    // Ces trois communes sont desservies aux mêmes conditions mais relèvent
    // d'autres intercommunalités. L'écrire de travers serait factuellement
    // faux, et repris tel quel par un modèle de langage.
    for (const { commune, content } of published) {
      if (commune.inMontesquieu) continue;
      const prose = [content.intro, content.housing].join(" ");
      expect(prose, commune.slug).not.toMatch(
        /(de|des) la Communauté de communes de Montesquieu/,
      );
    }
  });
});

function haversineKm({ lat, lng }: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat - HEADQUARTERS.lat);
  const dLng = toRad(lng - HEADQUARTERS.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(HEADQUARTERS.lat)) *
      Math.cos(toRad(lat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
