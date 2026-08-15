import { describe, expect, it } from "vitest";

import {
  formatFrenchPhone,
  isValidFrenchPhone,
  normalizePhone,
} from "@/lib/phone";

describe("normalisation d'un numéro français", () => {
  it.each([
    ["06 84 36 38 62", "0684363862"],
    ["06.84.36.38.62", "0684363862"],
    ["06-84-36-38-62", "0684363862"],
    ["(06) 84 36 38 62", "0684363862"],
    ["+33 6 84 36 38 62", "0684363862"],
    ["0033 6 84 36 38 62", "0684363862"],
  ])("accepte « %s »", (written, expected) => {
    expect(normalizePhone(written)).toBe(expected);
    expect(isValidFrenchPhone(normalizePhone(written))).toBe(true);
  });

  it("refuse ce qui n'est pas un numéro français à dix chiffres", () => {
    expect(isValidFrenchPhone("12345")).toBe(false);
    expect(isValidFrenchPhone("0084363862")).toBe(false);
    expect(isValidFrenchPhone("06843638620")).toBe(false);
  });
});

describe("affichage d'un numéro", () => {
  it("groupe par deux, quelle que soit la forme reçue", () => {
    expect(formatFrenchPhone("0684363862")).toBe("06 84 36 38 62");
    expect(formatFrenchPhone("+33684363862")).toBe("06 84 36 38 62");
  });

  it("rend tel quel ce qu'il ne sait pas découper", () => {
    // Mieux vaut un affichage brut qu'un découpage qui inventerait des
    // groupes sur une donnée qu'on n'a pas su reconnaître.
    expect(formatFrenchPhone("12345")).toBe("12345");
    expect(formatFrenchPhone("")).toBe("");
  });
});
