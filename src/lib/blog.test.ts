import { describe, expect, it } from "vitest";

import {
  ALL_ARTICLES,
  getPublishedArticle,
  publishedArticles,
  readingMinutes,
} from "@/lib/blog";
import { getPublishedCommune } from "@/lib/communes-content";
import { formatHourlyRate } from "@/lib/pricing";
import { PUBLIC_RATES } from "@/lib/pricing/public-grid";

describe("articles de conseil", () => {
  it("porte des slugs et des titres uniques", () => {
    const slugs = ALL_ARTICLES.map((article) => article.slug);
    const titles = ALL_ARTICLES.map((article) => article.title);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(titles).size).toBe(titles.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("retient l'article sur le crédit d'impôt tant que la déclaration SAP manque", () => {
    // Le garde-fou central : communiquer sur l'avantage fiscal avant d'être
    // déclaré organisme de services à la personne reviendrait à promettre un
    // droit que les prestations n'ouvrent pas encore.
    const gated = ALL_ARTICLES.filter(
      (article) => article.requiresSapDeclaration,
    );
    expect(gated.length).toBeGreaterThan(0);

    const withoutDeclaration = publishedArticles(false);
    for (const article of gated) {
      expect(withoutDeclaration).not.toContain(article);
      expect(getPublishedArticle(article.slug, false)).toBeUndefined();
      expect(getPublishedArticle(article.slug, true)).toBe(article);
    }

    expect(publishedArticles(true).length).toBe(ALL_ARTICLES.length);
  });

  it("ne parle du crédit d'impôt que dans un article verrouillé", () => {
    for (const article of publishedArticles(false)) {
      const prose = JSON.stringify(article);
      expect(prose, article.slug).not.toMatch(/crédit d['’]impôt/i);
    }
  });

  it("n'écrit aucun tarif horaire étranger à la grille publique", () => {
    // Un prix recopié à la main survit à un changement de grille et laisse un
    // article mensonger derrière lui sans que rien ne le signale.
    //
    // `Intl` insère des espaces insécables étroites dans les montants ; on les
    // ramène à des espaces ordinaires avant de comparer, sans quoi la
    // recherche échoue sur des chaînes pourtant identiques à l'œil.
    const normalize = (value: string) => value.replace(/[  ]/g, " ");
    const source = normalize(JSON.stringify(ALL_ARTICLES));
    const grid = PUBLIC_RATES.map((rate) => rate.hourlyRateCents);

    for (const rate of grid) {
      expect(
        source.includes(normalize(formatHourlyRate(rate))),
        `tarif ${rate / 100} € absent du corpus`,
      ).toBe(true);
    }

    // Tout montant présenté comme un tarif horaire doit venir de la grille.
    const quoted = [
      ...source.matchAll(/(\d+(?:,\d+)?) ?€(?:\/h| de l['’]heure)/g),
    ].map((match) => Math.round(Number(match[1]!.replace(",", ".")) * 100));

    expect(quoted.length).toBeGreaterThan(0);
    for (const value of quoted) {
      expect(grid, `${value / 100} € annoncé comme tarif horaire`).toContain(
        value,
      );
    }
  });

  it("date, décrit et structure chaque article", () => {
    for (const article of ALL_ARTICLES) {
      expect(article.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(article.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(
        Date.parse(article.updatedAt) >= Date.parse(article.publishedAt),
        article.slug,
      ).toBe(true);
      expect(article.description.length, article.slug).toBeGreaterThan(80);
      expect(article.faq.length, article.slug).toBeGreaterThanOrEqual(3);
      expect(readingMinutes(article), article.slug).toBeGreaterThanOrEqual(2);

      // Une hiérarchie de titres, pas un bloc de prose.
      const headings = article.blocks.filter(
        (block) => block.type === "heading",
      );
      expect(headings.length, article.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it("ne renvoie que vers des communes réellement publiées", () => {
    for (const article of ALL_ARTICLES) {
      expect(article.relatedCommuneSlugs.length).toBeGreaterThan(0);
      for (const slug of article.relatedCommuneSlugs) {
        expect(getPublishedCommune(slug), slug).toBeDefined();
      }
    }
  });

  it("ne pose jamais deux fois la même question", () => {
    const questions = ALL_ARTICLES.flatMap((article) =>
      article.faq.map((entry) => entry.question),
    );
    expect(new Set(questions).size).toBe(questions.length);
  });
});
