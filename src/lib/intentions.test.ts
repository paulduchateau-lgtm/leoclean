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
    text: string;
    faq: readonly { question: string; answer: string }[];
  }): number {
    return (
      local.text.length +
      local.faq.reduce(
        (total, entry) => total + entry.question.length + entry.answer.length,
        0,
      )
    );
  }

  /**
   * Plancher, et non objectif.
   *
   * La page la plus pauvre aujourd'hui — `femme-de-menage/leognan` — tient
   * 16,9 % de texte propre. Le seuil est posé juste en dessous : ce test
   * n'atteste pas que les pages vont bien, il interdit qu'elles aillent plus
   * mal. Une page saine serait au tiers, ce qui ferait tomber le recouvrement
   * mesuré sous 60 % ; y arriver demande de la connaissance de terrain, et
   * c'est l'arbitrage ouvert dans `docs/AUDIT-DUPLICATION.md`.
   */
  const MINIMUM_OWN_SHARE = 0.16;

  it("ne laisse aucune page descendre sous le plancher constaté", () => {
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
