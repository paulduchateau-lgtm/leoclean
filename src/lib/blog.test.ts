import { describe, expect, it } from "vitest";

import {
  ALL_ARTICLES,
  getPublishedArticle,
  publishedArticles,
  readingMinutes,
} from "@/lib/blog";
import { getPublishedCommune } from "@/lib/communes-content";
import { formatHourlyRate, estimateDuration } from "@/lib/pricing";
import {
  PUBLIC_RATES,
  STANDARD_SQM_PER_HOUR,
  STANDARD_SQM_PER_HOUR_AFFICHE,
  MINIMUM_BILLABLE_MINUTES,
} from "@/lib/pricing/public-grid";

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

  it("n'écrit aucun rendement étranger à la grille publique", () => {
    // Même piège que les tarifs, et il s'est refermé : le rendement est passé
    // de 25 à 100 m² pour trois heures, et trois tableaux plus deux phrases ont
    // continué d'annoncer 25 m²/h et 3 h 30 pour 80 m². Le tunnel en chiffrait
    // 2 h 30. Une durée recopiée est une durée qui finit par contredire ce
    // qu'on facture.
    const source = JSON.stringify(ALL_ARTICLES);
    // Ce que le corpus présente comme **notre** rendement doit être celui de
    // la grille, au chiffre près.
    const notre = [...source.matchAll(/(\d+) m² traités par heure/g)];
    expect(notre.length).toBeGreaterThan(0);
    for (const trouve of notre) {
      expect(
        Number(trouve[1]),
        `rendement ${trouve[1]} m²/h annoncé hors de la grille`,
      ).toBe(STANDARD_SQM_PER_HOUR_AFFICHE);
    }

    // Les variations citées — bâti ancien, logement encombré — n'ont pas à
    // valoir le standard, mais elles doivent rester **plus lentes** que lui.
    // Une variation plus rapide que le rendement de référence contredirait le
    // devis sans que personne ne s'en aperçoive.
    const variations = [...source.matchAll(/(\d+) m² par heure/g)];
    for (const trouve of variations) {
      expect(
        Number(trouve[1]),
        `variation ${trouve[1]} m²/h plus rapide que le rendement de référence`,
      ).toBeLessThanOrEqual(STANDARD_SQM_PER_HOUR_AFFICHE);
    }
  });

  it("n'annonce aucune durée que le moteur ne calculerait pas", () => {
    // On relit le corpus à la recherche de couples « surface → durée » et on
    // les repasse dans le moteur. C'est ce qui rattraperait une prose écrite à
    // la main à côté d'un tableau dérivé.
    const service = {
      sqmPerHour: STANDARD_SQM_PER_HOUR,
      minDurationMinutes: MINIMUM_BILLABLE_MINUTES,
    };
    const source = JSON.stringify(ALL_ARTICLES);
    const couples = [
      ...source.matchAll(/(\d+) m²[^0-9]{0,40}?(\d+) h(?: (30))?/g),
    ];

    expect(couples.length).toBeGreaterThan(0);
    for (const couple of couples) {
      const surface = Number(couple[1]);
      const annonce = Number(couple[2]) * 60 + (couple[3] ? 30 : 0);
      const calcule = estimateDuration({
        surfaceSqm: surface,
        service,
      }).durationMinutes;

      expect(
        annonce,
        `${surface} m² annoncés en ${annonce} min, le moteur en calcule ${calcule}`,
      ).toBe(calcule);
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
