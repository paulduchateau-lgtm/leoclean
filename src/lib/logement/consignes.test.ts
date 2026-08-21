import { describe, expect, it } from "vitest";

import {
  CONSIGNES_VIDES,
  LONGUEUR_MAX_TEXTE,
  RUBRIQUES,
  TOUTES_LES_QUESTIONS,
  consignesLisibles,
  lireLesConsignes,
  progression,
  validerUneReponse,
} from "@/lib/logement/consignes";

const AVEC = {
  actif: true,
  reponses: {
    four: { type: "rythme", valeur: "mensuel" },
    vitres: { type: "rythme", valeur: "jamais" },
    facades: { type: "texte", valeur: "Chêne huilé, savon noir dilué." },
    repassage: { type: "oui-non", valeur: false },
  },
  majAt: "2026-08-21T10:00:00.000Z",
};

describe("catalogue de consignes", () => {
  it("ne pose que des questions dont la réponse change un geste", () => {
    // Le questionnaire est court par contrainte : une liste de quarante
    // questions serait abandonnée au quart, et une consigne à moitié remplie
    // vaut moins qu'un champ libre honnête.
    expect(TOUTES_LES_QUESTIONS.length).toBeLessThanOrEqual(14);
    expect(TOUTES_LES_QUESTIONS.length).toBeGreaterThan(0);
  });

  it("porte des identifiants uniques", () => {
    // Un doublon écraserait silencieusement une réponse par une autre.
    const ids = TOUTES_LES_QUESTIONS.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("distingue la question posée du sujet lu par l'intervenant", () => {
    // « Faut-il laver le four ? » se pose au client ; l'intervenant a besoin
    // de « Four ». Lui servir la question l'obligerait à la relire pour en
    // extraire la consigne.
    for (const question of TOUTES_LES_QUESTIONS) {
      expect(question.sujet).not.toContain("?");
      expect(question.question.endsWith("?")).toBe(true);
    }
  });

  it("donne un exemple à chaque question ouverte", () => {
    // Un champ libre sans exemple reçoit « RAS ». C'est la question la plus
    // coûteuse à poser et la plus facile à rater.
    for (const question of TOUTES_LES_QUESTIONS) {
      if (question.type === "texte") {
        expect(question.exemple, question.id).toBeTruthy();
      }
    }
  });
});

describe("lecture de ce que porte la base", () => {
  it("rend des consignes vides sur une colonne absente ou abîmée", () => {
    for (const brut of [null, undefined, 42, "consignes", []]) {
      expect(lireLesConsignes(brut).reponses).toEqual({});
    }
  });

  it("ignore une réponse dont la question a disparu du catalogue", () => {
    // Le catalogue évolue ; une colonne `Json` ne suit pas. Faire échouer la
    // lecture rendrait le logement inaccessible pour une question retirée.
    const relu = lireLesConsignes({
      actif: true,
      reponses: {
        four: { type: "rythme", valeur: "mensuel" },
        "question-supprimee": { type: "texte", valeur: "..." },
      },
      majAt: null,
    });

    expect(Object.keys(relu.reponses)).toEqual(["four"]);
  });

  it("ignore une réponse dont le type ne correspond plus", () => {
    const relu = lireLesConsignes({
      actif: true,
      reponses: { four: { type: "texte", valeur: "oui" } },
      majAt: null,
    });

    expect(relu.reponses.four).toBeUndefined();
  });

  it("refuse un rythme inconnu", () => {
    const question = TOUTES_LES_QUESTIONS.find((q) => q.type === "rythme")!;
    expect(
      validerUneReponse(question, { type: "rythme", valeur: "quotidien" }),
    ).toBeNull();
  });

  it("ne garde pas un champ libre vide", () => {
    // Une réponse vide n'est pas une réponse : la compter annoncerait au
    // client une consigne que l'intervenant ne lira jamais.
    const question = TOUTES_LES_QUESTIONS.find((q) => q.type === "texte")!;
    expect(
      validerUneReponse(question, { type: "texte", valeur: "   " }),
    ).toBeNull();
  });

  it("borne un champ libre plus long qu'un écran", () => {
    const question = TOUTES_LES_QUESTIONS.find((q) => q.type === "texte")!;
    const reponse = validerUneReponse(question, {
      type: "texte",
      valeur: "a".repeat(LONGUEUR_MAX_TEXTE + 200),
    });

    expect(reponse).not.toBeNull();
    expect((reponse as { valeur: string }).valeur).toHaveLength(
      LONGUEUR_MAX_TEXTE,
    );
  });
});

describe("ce que l'intervenant lit", () => {
  it("ne montre rien tant que l'aide n'est pas activée", () => {
    // Couper l'aide ne doit rien effacer, mais ne doit rien montrer non plus :
    // montrer quand même reviendrait à retirer l'interrupteur qu'on a donné.
    const relu = lireLesConsignes({ ...AVEC, actif: false });

    expect(relu.reponses.four).toBeDefined();
    expect(consignesLisibles(relu)).toEqual([]);
  });

  it("garde « jamais », qui est une consigne à part entière", () => {
    // Sans elle, quelqu'un de consciencieux ferait les vitres, prendrait le
    // temps qu'il n'a pas, et s'entendrait dire qu'on ne lui demandait rien.
    const lignes = consignesLisibles(lireLesConsignes(AVEC));
    const vitres = lignes.find((ligne) => ligne.sujet === "Vitres");

    expect(vitres?.reponse).toBe("Jamais");
  });

  it("rend un libellé lisible, jamais une clé technique", () => {
    const lignes = consignesLisibles(lireLesConsignes(AVEC));

    for (const ligne of lignes) {
      expect(ligne.reponse).not.toMatch(/^[a-z-]+$/);
      expect(ligne.reponse.length).toBeGreaterThan(0);
    }
    expect(lignes.find((l) => l.sujet === "Repassage")?.reponse).toBe("Non");
  });

  it("suit l'ordre du questionnaire, pas celui de la saisie", () => {
    // Le client répond dans le désordre ; l'intervenant lit par pièce.
    const lignes = consignesLisibles(lireLesConsignes(AVEC));
    const rubriques = [...new Set(lignes.map((ligne) => ligne.rubrique))];
    const attendu = RUBRIQUES.map((r) => r.titre).filter((titre) =>
      rubriques.includes(titre),
    );

    expect(rubriques).toEqual(attendu);
  });

  it("compte ce qui est réellement répondu", () => {
    expect(progression(lireLesConsignes(AVEC)).repondues).toBe(4);
    expect(progression(CONSIGNES_VIDES).repondues).toBe(0);
    expect(progression(CONSIGNES_VIDES).total).toBe(
      TOUTES_LES_QUESTIONS.length,
    );
  });
});
