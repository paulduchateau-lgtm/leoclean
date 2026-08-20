import { describe, expect, it } from "vitest";

import { reglesLisibles } from "./annonce";
import { REFERRAL_PROGRAMS } from "./rules";

/*
 * `Intl` sépare le montant de son symbole par une espace fine insécable, comme
 * la typographie française l'exige. Les tests comparent donc sur des espaces
 * normalisées plutôt que d'écrire un caractère invisible dans le littéral.
 */
function dit(regles: string[], attendu: string): boolean {
  return regles.some((regle) => regle.replace(/\s/g, " ").includes(attendu));
}

describe("reglesLisibles", () => {
  it("annonce le plafond du programme intervenant", () => {
    const regles = reglesLisibles(REFERRAL_PROGRAMS.CLEANER);
    expect(dit(regles, "150 €")).toBe(true);
    expect(regles.some((regle) => regle.includes("5 %"))).toBe(true);
    expect(regles.some((regle) => regle.includes("12 mois"))).toBe(true);
  });

  it("dit la non-rétroactivité quand le seuil dépasse une prestation", () => {
    const regles = reglesLisibles(REFERRAL_PROGRAMS.CLEANER);
    expect(regles.some((regle) => regle.includes("sans être comptées"))).toBe(
      true,
    );
  });

  it("n'invente pas de plafond quand le programme n'en a pas", () => {
    const regles = reglesLisibles(REFERRAL_PROGRAMS.CLIENT);
    expect(regles.some((regle) => regle.includes("plafonné"))).toBe(false);
  });

  it("annonce toujours l'unique niveau", () => {
    for (const programme of Object.values(REFERRAL_PROGRAMS)) {
      expect(
        reglesLisibles(programme).some((regle) =>
          regle.includes("Un seul niveau"),
        ),
      ).toBe(true);
    }
  });

  /*
   * Le garde-fou qui compte : aucune phrase ne doit pouvoir être écrite à la
   * main. Si un montant du programme change, la phrase change avec lui.
   */
  it("dérive les montants du programme, sans les recopier", () => {
    const modifie = { ...REFERRAL_PROGRAMS.CLEANER, monthlyCapCents: 9_900 };
    const regles = reglesLisibles(modifie);
    expect(dit(regles, "99 €")).toBe(true);
    expect(dit(regles, "150 €")).toBe(false);
  });
});
