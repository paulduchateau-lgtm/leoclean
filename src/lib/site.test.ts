import { describe, expect, it } from "vitest";

import { PENDING_IDENTITY_FIELDS, SITE, absoluteUrl } from "@/lib/site";

describe("identité publique", () => {
  it("ancre la description sur des entités géographiques nommées", () => {
    // Ces ancrages sont ce sur quoi s'appuient les moteurs et les modèles de
    // langage pour rattacher LéoClean à un territoire.
    for (const entity of [
      "Léognan",
      "33850",
      "Gradignan",
      "Cestas",
      "Villenave-d'Ornon",
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

  it("expose le numéro sous les deux écritures attendues", () => {
    // Celle qu'on lit, et celle qu'on compose : un lien `tel:` échoue sur
    // mobile si le numéro contient des espaces, et schema.org attend le format
    // international.
    expect(SITE.phone).toMatch(/^0\d( \d{2}){4}$/);
    expect(SITE.phoneE164).toMatch(/^\+33\d{9}$/);
    expect(SITE.phoneE164).toBe(`+33${SITE.phone.replace(/\s/g, "").slice(1)}`);
  });

  it("porte une identité légale vérifiable", () => {
    // Ces valeurs proviennent du registre du commerce. Elles alimentent le
    // JSON-LD et la page à propos, que les modèles de langage citent pour
    // décrire l'entreprise : une approximation y serait reprise telle quelle.
    expect(SITE.siret).toMatch(/^\d{14}$/);
    expect(SITE.siret?.startsWith(SITE.siren)).toBe(true);
    expect(SITE.foundingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("situe le siège social dans la commune annoncée", () => {
    // Une adresse d'immatriculation hors zone affaiblirait tout le
    // positionnement local, et la cohérence NAP avec Google Business Profile.
    expect(SITE.address.city).toBe("Léognan");
    expect(SITE.address.street).not.toBeNull();
  });

  it("recense les champs encore manquants", () => {
    expect(PENDING_IDENTITY_FIELDS).not.toContain("SIRET");
    expect(PENDING_IDENTITY_FIELDS).toContain("numéro de déclaration SAP");
  });
});
