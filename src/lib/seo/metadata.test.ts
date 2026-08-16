import { describe, expect, it } from "vitest";

import { pageMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/site";

/**
 * Ce qui est vérifié ici tient en une phrase : `canonical` et `og:url` ne
 * peuvent pas désigner deux pages différentes.
 *
 * Le défaut d'origine était silencieux — aucune erreur, aucun test rouge, et
 * tous les partages du site consolidés sur l'accueil parce qu'un `og:url`
 * hérité du gabarit racine valait la même chose partout.
 */

describe("métadonnées d'une page publique", () => {
  it("fait pointer canonical et og:url sur la même page", () => {
    const metadata = pageMetadata({ path: "/tarifs" });

    expect(metadata.alternates?.canonical).toBe("/tarifs");
    expect(metadata.openGraph?.url).toBe(absoluteUrl("/tarifs"));
  });

  it("rend og:url absolu — les moteurs de prévisualisation ne relisent pas la page", () => {
    const url = pageMetadata({ path: "/menage-a-domicile/leognan" }).openGraph
      ?.url;

    expect(String(url)).toMatch(/^https?:\/\//);
    expect(String(url)).toContain("/menage-a-domicile/leognan");
  });

  it("distingue deux pages", () => {
    const tarifs = pageMetadata({ path: "/tarifs" });
    const blog = pageMetadata({ path: "/blog" });

    expect(tarifs.openGraph?.url).not.toBe(blog.openGraph?.url);
  });

  it("reprend le titre et la description pour la carte de partage", () => {
    const metadata = pageMetadata({
      path: "/a-propos",
      title: "À propos",
      description: "Ce que fait Léo Clean.",
    });

    expect(metadata.openGraph?.title).toBe("À propos");
    expect(metadata.openGraph?.description).toBe("Ce que fait Léo Clean.");
  });

  it("accepte une carte de partage rédigée à part", () => {
    const metadata = pageMetadata({
      path: "/menage-a-domicile/gradignan",
      title: "Ménage à domicile à Gradignan (33170)",
      description: "Description destinée aux moteurs.",
      openGraphTitle: "Ménage à domicile à Gradignan",
      openGraphDescription: "Phrase destinée aux humains.",
    });

    expect(metadata.title).toBe("Ménage à domicile à Gradignan (33170)");
    expect(metadata.openGraph?.title).toBe("Ménage à domicile à Gradignan");
    expect(metadata.openGraph?.description).toBe(
      "Phrase destinée aux humains.",
    );
  });

  it("n'invente ni titre ni description quand la page n'en donne pas", () => {
    // L'accueil tient les siens du gabarit racine : les écraser d'une chaîne
    // vide serait pire que de ne rien poser.
    const metadata = pageMetadata({ path: "/" });

    expect(metadata.title).toBeUndefined();
    expect(metadata.openGraph).not.toHaveProperty("title");
  });
});

describe("carte de partage", () => {
  it("repose la carte du site, que Next efface dès qu'une page déclare openGraph", () => {
    const images = pageMetadata({ path: "/tarifs" }).openGraph?.images;

    expect(images).toEqual([
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: expect.any(String),
      },
    ]);
  });

  it("s'efface devant la carte propre à la page", () => {
    // Une `images` posée à la main gagne sur le fichier `opengraph-image.tsx`
    // de la route : la reposer effacerait la carte de la commune.
    const metadata = pageMetadata({
      path: "/menage-a-domicile/leognan",
      hasOwnOpenGraphImage: true,
    });

    expect(metadata.openGraph).not.toHaveProperty("images");
  });
});

describe("article", () => {
  it("passe og:type à article et porte ses dates", () => {
    const og = pageMetadata({
      path: "/blog/duree-menage-maison-100m2",
      article: {
        publishedTime: "2026-01-12",
        modifiedTime: "2026-02-03",
      },
    }).openGraph;

    expect(og).toMatchObject({
      type: "article",
      publishedTime: "2026-01-12",
      modifiedTime: "2026-02-03",
    });
  });

  it("garde website partout ailleurs", () => {
    expect(pageMetadata({ path: "/tarifs" }).openGraph).toMatchObject({
      type: "website",
    });
  });
});

describe("résumé pour les modèles de langage", () => {
  it("pose les deux noms de balise pour une même valeur", () => {
    // Aucun n'est normalisé, les deux circulent, et une balise ignorée ne
    // fait de mal à personne.
    const metadata = pageMetadata({
      path: "/tarifs",
      summary: "Léo Clean fait le ménage à domicile à partir de 29 €/h.",
    });

    expect(metadata.other).toEqual({
      "llm-summary": "Léo Clean fait le ménage à domicile à partir de 29 €/h.",
      "ai:content": "Léo Clean fait le ménage à domicile à partir de 29 €/h.",
    });
  });

  it("n'en pose aucune quand la page n'a rien à résumer", () => {
    expect(pageMetadata({ path: "/tarifs" })).not.toHaveProperty("other");
  });
});
