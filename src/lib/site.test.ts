import { describe, expect, it } from "vitest";

import { PENDING_IDENTITY_FIELDS, SITE, absoluteUrl } from "@/lib/site";

describe("identité publique", () => {
  it("ancre la description sur des entités géographiques nommées", () => {
    // Ces ancrages sont ce sur quoi s'appuient les moteurs et les modèles de
    // langage pour rattacher LéoClean à un territoire.
    for (const entity of [
      "Léognan",
      "33850",
      "La Brède",
      "Gironde",
      "Montesquieu",
      "Bordeaux",
    ]) {
      expect(SITE.description).toContain(entity);
    }
  });

  it("expose une URL canonique sans slash final", () => {
    expect(SITE.url.endsWith("/")).toBe(false);
    expect(absoluteUrl("/a-propos")).toBe(`${SITE.url}/a-propos`);
    expect(absoluteUrl("a-propos")).toBe(`${SITE.url}/a-propos`);
  });

  it("situe le siège à Léognan", () => {
    expect(SITE.address.city).toBe("Léognan");
    expect(SITE.address.postalCode).toBe("33850");
  });

  it("recense les champs de NAP encore manquants", () => {
    // Ce test documente l'état : il devra être mis à jour au fur et à mesure
    // que LéoClean fournit ses informations légales.
    expect(PENDING_IDENTITY_FIELDS).toContain("numéro de téléphone local");
    expect(PENDING_IDENTITY_FIELDS).toContain("SIRET");
  });
});
