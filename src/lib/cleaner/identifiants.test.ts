import { describe, expect, it } from "vitest";

import {
  INSURANCE_MIN_REMAINING_DAYS,
  checkInsurance,
  checkSapNumber,
  checkSiret,
  identifiantRefusalMessage,
  sirenOf,
} from "@/lib/cleaner/identifiants";

/** Le SIRET de PAPER PLANE, la société qui exploite Léo Clean. */
const SIRET_VALIDE = "89822870500015";

describe("SIRET", () => {
  it("accepte un SIRET réel", () => {
    expect(checkSiret(SIRET_VALIDE).valid).toBe(true);
  });

  it("accepte les séparateurs que les gens écrivent", () => {
    // « 898 228 705 00015 » est la forme lisible : la refuser ferait perdre
    // une candidature pour une raison incompréhensible.
    for (const forme of [
      "898 228 705 00015",
      "898.228.705.00015",
      "898-228-705-00015",
    ]) {
      const check = checkSiret(forme);
      expect(check.valid).toBe(true);
      expect(check.normalized).toBe(SIRET_VALIDE);
    }
  });

  it("rejette une longueur impossible", () => {
    for (const mauvais of ["898228705", "8982287050001", "898228705000155"]) {
      expect(checkSiret(mauvais).refusal).toBe("LONGUEUR");
    }
  });

  it("attrape une faute de frappe par la clé de contrôle", () => {
    // C'est la vérification la plus rentable du formulaire : dix lignes, et un
    // aller-retour de vérification humaine évité.
    const faute = `${SIRET_VALIDE.slice(0, 5)}9${SIRET_VALIDE.slice(6)}`;
    expect(faute).not.toBe(SIRET_VALIDE);
    expect(checkSiret(faute).refusal).toBe("CLE_INVALIDE");
  });

  it("connaît l'exception de La Poste", () => {
    // Ses établissements ne respectent pas Luhn : la règle y est que la somme
    // des chiffres soit divisible par cinq. L'ignorer rejetterait des SIRET
    // parfaitement valides.
    // 3+5+6+9+7+5 = 35, divisible par cinq. Ce SIRET échouerait à Luhn.
    expect(checkSiret("35600000009075").valid).toBe(true);
    expect(checkSiret("35600000009076").valid).toBe(false);
  });

  it("extrait le SIREN", () => {
    expect(sirenOf(SIRET_VALIDE)).toBe("898228705");
    expect(sirenOf("898 228 705 00015")).toBe("898228705");
  });
});

describe("numéro de déclaration SAP", () => {
  it("accepte un numéro cohérent avec le SIRET", () => {
    const check = checkSapNumber("SAP898228705", SIRET_VALIDE);
    expect(check.valid).toBe(true);
    expect(check.normalized).toBe("SAP898228705");
  });

  it("normalise la casse et les séparateurs", () => {
    expect(checkSapNumber("sap 898 228 705", SIRET_VALIDE).valid).toBe(true);
  });

  it("rejette une forme qui n'est pas celle d'un numéro SAP", () => {
    for (const mauvais of ["898228705", "SAP12345678", "SAPABCDEFGHI"]) {
      expect(checkSapNumber(mauvais, SIRET_VALIDE).refusal).toBe("FORMAT");
    }
  });

  it("refuse un numéro qui ne porte pas le SIREN déclaré", () => {
    // Un numéro emprunté ouvrirait un crédit d'impôt indu au client, qui le
    // rembourserait. Le recoupement est gratuit : le numéro contient le SIREN.
    expect(checkSapNumber("SAP123456789", SIRET_VALIDE).refusal).toBe(
      "SIREN_DIFFERENT",
    );
  });

  it("se contente de la forme quand aucun SIRET n'est encore connu", () => {
    expect(checkSapNumber("SAP123456789", null).valid).toBe(true);
  });
});

describe("attestation de responsabilité civile professionnelle", () => {
  const NOW = new Date("2026-09-01T00:00:00Z");

  it("refuse une attestation absente", () => {
    expect(checkInsurance(null, NOW).valid).toBe(false);
  });

  it("refuse une attestation périmée", () => {
    expect(checkInsurance(new Date("2026-08-31T00:00:00Z"), NOW).valid).toBe(
      false,
    );
  });

  it("accepte une attestation en cours", () => {
    const check = checkInsurance(new Date("2027-06-01T00:00:00Z"), NOW);
    expect(check.valid).toBe(true);
    expect(check.expiringSoon).toBe(false);
  });

  it("signale une couverture qui s'arrête bientôt", () => {
    // Elle est encore valable, mais elle ne couvrirait pas une mission prise
    // pour le mois prochain : on prévient sans bloquer.
    const bientot = new Date(
      NOW.getTime() + (INSURANCE_MIN_REMAINING_DAYS - 5) * 86_400_000,
    );
    const check = checkInsurance(bientot, NOW);
    expect(check.valid).toBe(true);
    expect(check.expiringSoon).toBe(true);
  });
});

describe("messages", () => {
  it("explique au lieu d'afficher un code", () => {
    for (const refusal of [
      "LONGUEUR",
      "CLE_INVALIDE",
      "FORMAT",
      "SIREN_DIFFERENT",
    ] as const) {
      const message = identifiantRefusalMessage(refusal);
      expect(message.length).toBeGreaterThan(25);
      expect(message).not.toContain("_");
    }
  });
});
