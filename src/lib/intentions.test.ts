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

  it("reste un déploiement restreint : trois communes par intention", () => {
    /*
     * Le périmètre a été réduit de six à trois communes le 16 août 2026, après
     * le relevé de duplication : six pages tièdes valent moins que trois
     * fortes, et enrichir douze paragraphes à la main n'était pas tenable.
     * Voir `docs/AUDIT-DUPLICATION.md`.
     *
     * Les deux intentions visent désormais les **mêmes** communes — Léognan,
     * qui est le siège, et les deux communes les plus peuplées du territoire,
     * toutes deux à moins de huit kilomètres. Le test précédent exigeait des
     * ensembles différents ; c'était un garde-fou contre le produit cartésien,
     * et le plafond de trois le remplace avantageusement.
     */
    for (const intention of ALL_INTENTIONS) {
      const communes = Object.keys(intention.communes);
      expect(communes, intention.slug).toHaveLength(3);
      expect(communes, intention.slug).toContain("leognan");
    }
  });

  it("écrit plusieurs paragraphes propres à chaque commune", () => {
    const texts = pages.map((page) => page.local.paragraphs.join(" "));
    expect(new Set(texts).size).toBe(texts.length);

    for (const { commune, local } of pages) {
      // Trois paragraphes et trois questions : c'est ce qu'il faut pour que la
      // part propre pèse plus du tiers de la page, seuil retenu après le
      // relevé de duplication du 16 août 2026.
      expect(local.paragraphs.length, commune.slug).toBeGreaterThanOrEqual(3);
      expect(local.paragraphs.join(" ").length, commune.slug).toBeGreaterThan(
        900,
      );
      expect(local.faq.length, commune.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it("nomme la commune dans son paragraphe local", () => {
    for (const { commune, local } of pages) {
      expect(local.paragraphs.join(" "), commune.slug).toContain(commune.name);
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

describe("part propre à chaque commune", () => {
  /**
   * Ce qui est borné ici est la seule vraie exposition au contenu dupliqué du
   * site, relevée le 16 août 2026 : `femme-de-menage/gradignan` et
   * `femme-de-menage/la-brede` partagent 85 % de leurs suites de cinq mots.
   * La cause est structurelle — chapeau, sections et FAQ commune sont écrits
   * une fois pour l'intention, et seul `local` change d'une commune à l'autre.
   *
   * Le journal complet est dans `docs/AUDIT-DUPLICATION.md`, avec les trois
   * issues possibles. En attendant l'arbitrage, la situation ne doit pas
   * empirer : ces tests interdisent d'ajouter une commune à moindres frais que
   * les existantes, ce qui est exactement la pente qui a produit l'écart.
   */

  /** Longueur du bloc commun d'une intention, en caractères. */
  function sharedLength(intention: (typeof ALL_INTENTIONS)[number]): number {
    return (
      intention.lede.length +
      intention.sections.reduce(
        (total, section) =>
          total + section.heading.length + section.paragraphs.join(" ").length,
        0,
      ) +
      intention.sharedFaq.reduce(
        (total, entry) => total + entry.question.length + entry.answer.length,
        0,
      )
    );
  }

  function localLength(local: {
    paragraphs: readonly string[];
    faq: readonly { question: string; answer: string }[];
  }): number {
    return (
      local.paragraphs.join(" ").length +
      local.faq.reduce(
        (total, entry) => total + entry.question.length + entry.answer.length,
        0,
      )
    );
  }

  /**
   * Plancher, et non objectif.
   *
   * Le seuil était de 16 % tant que six communes se partageaient un même
   * gabarit : c'était un plancher constaté, pas un objectif. Après la
   * réduction à trois communes et l'enrichissement du 16 août 2026, les six
   * pages tiennent entre 44 et 47 % de texte propre. Le seuil est remonté au
   * tiers — la valeur à partir de laquelle une page cesse d'être la variante
   * de sa voisine — avec la marge qu'il faut pour qu'une correction
   * rédactionnelle ne le fasse pas rougir pour rien.
   */
  const MINIMUM_OWN_SHARE = 0.33;

  it("garde à chaque page plus du tiers de texte à elle", () => {
    for (const intention of ALL_INTENTIONS) {
      const shared = sharedLength(intention);
      for (const [slug, local] of Object.entries(intention.communes)) {
        const own = localLength(local);
        const share = own / (own + shared);
        expect(share, `${intention.slug}/${slug}`).toBeGreaterThan(
          MINIMUM_OWN_SHARE,
        );
      }
    }
  });

  it("n'admet pas de commune servie plus pauvrement que les autres", () => {
    // Une page ajoutée à moitié tire la moyenne vers le bas sans qu'aucun
    // seuil absolu ne s'en aperçoive.
    for (const intention of ALL_INTENTIONS) {
      const lengths = Object.values(intention.communes).map(localLength);
      const median = [...lengths].sort((a, b) => a - b)[
        Math.floor(lengths.length / 2)
      ]!;
      for (const [slug, local] of Object.entries(intention.communes)) {
        expect(localLength(local), `${intention.slug}/${slug}`).toBeGreaterThan(
          median * 0.5,
        );
      }
    }
  });
});
