import { describe, expect, it } from "vitest";

import { withoutEmptyValues } from "@/lib/env";

/**
 * Normalisation des variables d'environnement.
 *
 * Une seule règle, mais elle a cassé une mise en production : une variable
 * laissée vide n'est pas une variable absente pour Zod, et ni `optional()` ni
 * `default()` ne s'y déclenchent.
 */
describe("variables vides", () => {
  it("assimile une chaîne vide à une absence", () => {
    expect(withoutEmptyValues({ DIRECT_URL: "" })).toEqual({
      DIRECT_URL: undefined,
    });
  });

  it("laisse intact tout le reste, espaces compris", () => {
    // Une valeur réduite à un espace est suspecte mais ce n'est pas à cette
    // fonction d'en juger : elle ne traite que le vide franc.
    expect(
      withoutEmptyValues({
        NEXT_PUBLIC_SAP_DECLARED: "false",
        EMAIL_FROM: "Léo Clean <menage@leoclean.fr>",
        BLANC: " ",
        ABSENTE: undefined,
      }),
    ).toEqual({
      NEXT_PUBLIC_SAP_DECLARED: "false",
      EMAIL_FROM: "Léo Clean <menage@leoclean.fr>",
      BLANC: " ",
      ABSENTE: undefined,
    });
  });

  it("ne perd aucune clé", () => {
    const source = { A: "", B: "b", C: undefined };
    expect(Object.keys(withoutEmptyValues(source))).toEqual(["A", "B", "C"]);
  });
});
