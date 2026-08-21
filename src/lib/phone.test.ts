import { describe, expect, it } from "vitest";

import {
  formatFrenchPhone,
  isValidFrenchPhone,
  normalizePhone,
  formatFrenchPhoneAsTyped,
  diagnosticPhone,
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

describe("mise en forme pendant la frappe", () => {
  it("groupe par paires au fil de la saisie", () => {
    const attendu: [string, string][] = [
      ["", ""],
      ["0", "0"],
      ["06", "06"],
      ["068", "06 8"],
      ["0684", "06 84"],
      ["0684363862", "06 84 36 38 62"],
    ];
    for (const [saisi, rendu] of attendu) {
      expect(formatFrenchPhoneAsTyped(saisi)).toBe(rendu);
    }
  });

  it("n'ajoute jamais d'espace en attente du chiffre suivant", () => {
    // Un espace final que l'effacement doit franchir donne l'impression d'une
    // touche morte : on efface, rien ne bouge, on efface encore.
    for (const saisi of ["06", "0684", "068436"]) {
      expect(formatFrenchPhoneAsTyped(saisi)).not.toMatch(/\s$/);
    }
  });

  it("conserve le « + » qu'on vient de taper", () => {
    // Le convertir en 0 à la volée ferait disparaître sous les doigts le
    // caractère qu'on saisit — le plus sûr moyen de faire abandonner le champ.
    expect(formatFrenchPhoneAsTyped("+")).toBe("+");
    expect(formatFrenchPhoneAsTyped("+33")).toBe("+33");
    expect(formatFrenchPhoneAsTyped("+336")).toBe("+33 6");
    expect(formatFrenchPhoneAsTyped("+33684363862")).toBe("+33 6 84 36 38 62");
  });

  it("ne double pas le zéro national derrière l'indicatif", () => {
    expect(formatFrenchPhoneAsTyped("+330684363862")).toBe("+33 6 84 36 38 62");
  });

  it("est idempotente : reformater le rendu ne le change pas", () => {
    // La fonction est rappelée à chaque frappe sur sa propre sortie. Si elle
    // n'était pas idempotente, le champ dériverait tout seul.
    for (const saisi of ["0684363862", "+33684363862", "068", "06 84 36"]) {
      const une = formatFrenchPhoneAsTyped(saisi);
      expect(formatFrenchPhoneAsTyped(une)).toBe(une);
    }
  });

  it("accepte toutes les formes que les gens écrivent", () => {
    for (const saisi of ["06.84.36.38.62", "06-84-36-38-62", "0684 363862"]) {
      expect(formatFrenchPhoneAsTyped(saisi)).toBe("06 84 36 38 62");
    }
  });

  it("ne perd jamais un chiffre en trop, elle le montre", () => {
    // Tronquer ferait disparaître de la saisie sans rien dire ; c'est le
    // diagnostic qui signale la faute, pas la mise en forme qui la masque.
    expect(formatFrenchPhoneAsTyped("06843638621")).toContain("1");
  });
});

describe("diagnostic d'un numéro", () => {
  it("ne reproche rien à un champ vide", () => {
    // L'obligation de remplir est dite par le formulaire, pas par le
    // validateur : afficher une erreur sur un champ jamais touché est hostile.
    expect(diagnosticPhone("")).toBeNull();
    expect(diagnosticPhone("   ")).toBeNull();
  });

  it("ne reproche rien à un numéro valide, quelle que soit sa forme", () => {
    for (const bon of [
      "0684363862",
      "06 84 36 38 62",
      "+33 6 84 36 38 62",
      "06.84.36.38.62",
    ]) {
      expect(diagnosticPhone(bon)).toBeNull();
    }
  });

  it("dit combien de chiffres manquent, plutôt que « invalide »", () => {
    // C'est la faute la plus fréquente, et « numéro invalide » n'apprend rien
    // à quelqu'un qui a tapé neuf chiffres.
    expect(diagnosticPhone("068436386")).toBe("Il manque 1 chiffre.");
    expect(diagnosticPhone("06843638")).toBe("Il manque 2 chiffres.");
  });

  it("signale un numéro trop long", () => {
    expect(diagnosticPhone("06843638621")).toBe(
      "Ce numéro a trop de chiffres.",
    );
  });

  it("signale un numéro qui ne commence pas comme un numéro français", () => {
    expect(diagnosticPhone("1684363862")).toContain("commence par 0");
    expect(diagnosticPhone("0084363862")).toContain("ne peut pas être un 0");
  });
});
