import { describe, expect, it } from "vitest";

import { getPublishedCommune } from "@/lib/communes-content";
import {
  ALL_INTENTIONS,
  fillTemplate,
  getIntentionPage,
  intentionPages,
  publishedIntentionPages,
} from "@/lib/intentions";

const pages = publishedIntentionPages();

describe("intentions secondaires", () => {
  it("ne cible que des communes ayant leur propre page", () => {
    // Une page d'intention renvoie vers la page commune : la publier sans elle
    // créerait un lien interne mort et une page orpheline.
    for (const { commune } of pages) {
      expect(getPublishedCommune(commune.slug), commune.slug).toBeDefined();
    }
  });

  it("reste un déploiement restreint, pas un produit cartésien", () => {
    // Seize communes multipliées par deux intentions donneraient trente-deux
    // pages dont la plupart n'auraient rien à dire. La retenue est le sujet.
    for (const intention of ALL_INTENTIONS) {
      const count = Object.keys(intention.communes).length;
      expect(count, intention.slug).toBeGreaterThanOrEqual(4);
      expect(count, intention.slug).toBeLessThanOrEqual(8);
    }

    // Et les deux intentions ne couvrent pas le même territoire.
    const femme = new Set(
      intentionPages("femme-de-menage").map((page) => page.commune.slug),
    );
    const repassage = new Set(
      intentionPages("repassage").map((page) => page.commune.slug),
    );
    expect([...femme].some((slug) => !repassage.has(slug))).toBe(true);
    expect([...repassage].some((slug) => !femme.has(slug))).toBe(true);
  });

  it("écrit un paragraphe propre à chaque commune", () => {
    const texts = pages.map((page) => page.local.text);
    expect(new Set(texts).size).toBe(texts.length);

    for (const { commune, local } of pages) {
      expect(local.text.length, commune.slug).toBeGreaterThan(200);
      expect(local.faq.length, commune.slug).toBeGreaterThanOrEqual(1);
    }
  });

  it("nomme la commune dans son paragraphe local", () => {
    for (const { commune, local } of pages) {
      expect(local.text, commune.slug).toContain(commune.name);
    }
  });

  it("ne pose jamais deux fois la même question locale", () => {
    const questions = pages.flatMap((page) =>
      page.local.faq.map((entry) => entry.question),
    );
    expect(new Set(questions).size).toBe(questions.length);
  });

  it("ne mélange pas les questions locales et les questions communes", () => {
    for (const intention of ALL_INTENTIONS) {
      const shared = new Set(
        intention.sharedFaq.map((entry) => entry.question),
      );
      for (const local of Object.values(intention.communes)) {
        for (const entry of local.faq) {
          expect(shared.has(entry.question), entry.question).toBe(false);
        }
      }
    }
  });

  it("produit des titres distincts après substitution", () => {
    const titles = pages.map((page) =>
      fillTemplate(page.intention.titleTemplate, page.commune.name),
    );
    expect(new Set(titles).size).toBe(titles.length);
    for (const title of titles) {
      expect(title).not.toContain("{commune}");
    }
  });

  it("résout une page par son couple intention/commune", () => {
    const first = pages[0]!;
    expect(
      getIntentionPage(first.intention.slug, first.commune.slug),
    ).toBeDefined();
    expect(getIntentionPage("inexistante", first.commune.slug)).toBeUndefined();
    expect(getIntentionPage(first.intention.slug, "bordeaux")).toBeUndefined();
  });

  it("ne promet pas le crédit d'impôt", () => {
    // Même règle que pour le blog : rien sur l'avantage fiscal tant que la
    // déclaration SAP n'est pas obtenue.
    expect(JSON.stringify(ALL_INTENTIONS)).not.toMatch(/crédit d['’]impôt/i);
  });
});
