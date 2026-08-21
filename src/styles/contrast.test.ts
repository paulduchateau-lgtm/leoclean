import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Contraste des couples de couleurs réellement employés.
 *
 * Le design system fait foi : ce test **constate**, il ne corrige pas. S'il
 * échoue, la question remonte au système, elle ne se règle pas en changeant
 * une valeur dans le code — c'est la règle du dépôt, et c'est aussi ce que
 * demande le brief.
 *
 * Les valeurs sont lues dans `tokens/colors.css` plutôt que recopiées ici :
 * un test de contraste qui porterait sa propre copie de la palette cesserait
 * de dire quoi que ce soit dès la première évolution.
 */

const TOKENS = fs.readFileSync(
  path.join(process.cwd(), "src/styles/tokens/colors.css"),
  "utf8",
);

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(TOKENS);
  if (!match) throw new Error(`Token introuvable ou non littéral : --${name}`);
  return match[1]!;
}

/** Luminance relative, WCAG 2.1 §relative luminance. */
function luminance(hex: string): number {
  const canal = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = canal(parseInt(hex.slice(1, 3), 16));
  const g = canal(parseInt(hex.slice(3, 5), 16));
  const b = canal(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair! + 0.05) / (sombre! + 0.05);
}

/**
 * Les couples effectivement posés à l'écran, texte courant.
 *
 * Le seuil est 4,5:1 — AA sur du texte de taille normale.
 */
const TEXTE = [
  { nom: "encre sur blanc", avant: "ink-900", arriere: "ink-0" },
  { nom: "texte secondaire sur blanc", avant: "ink-600", arriere: "ink-0" },
  // L'action : mangue pleine, texte encre — le bouton du tropical punch.
  { nom: "encre sur mangue pleine", avant: "ink-900", arriere: "mango-400" },
  // La sélection : sarcelle pleine, texte encre — cases cochées, créneaux.
  { nom: "encre sur sarcelle pleine", avant: "ink-900", arriere: "teal-400" },
  // La marque en texte : liens et `text-brand`.
  { nom: "sarcelle 600 sur blanc", avant: "teal-600", arriere: "ink-0" },
  { nom: "sarcelle 700 sur blanc", avant: "teal-700", arriere: "ink-0" },
  {
    nom: "sarcelle 800 sur sarcelle 50",
    avant: "teal-800",
    arriere: "teal-50",
  },
  // La bande sombre du déroulé et son texte secondaire.
  { nom: "blanc sur sarcelle 900", avant: "ink-0", arriere: "teal-900" },
  {
    nom: "sarcelle 200 sur sarcelle 900",
    avant: "teal-200",
    arriere: "teal-900",
  },
  // Les surfaces douces qui portent du texte courant.
  { nom: "encre sur papaye 200", avant: "ink-900", arriere: "papaya-200" },
  { nom: "encre sur ananas 300", avant: "ink-900", arriere: "pineapple-300" },
  { nom: "encre sur crème", avant: "ink-900", arriere: "cream-50" },
  { nom: "encre sur ink-50", avant: "ink-900", arriere: "ink-50" },
  { nom: "texte secondaire sur ink-50", avant: "ink-600", arriere: "ink-50" },
];

describe("contraste des couples employés", () => {
  it.each(TEXTE)(
    "$nom tient le 4,5:1 du texte courant",
    ({ avant, arriere }) => {
      expect(ratio(token(avant), token(arriere))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("la mangue pleine ne porte jamais de blanc", () => {
    // Règle du système, ici rendue vérifiable : à 400 la mangue est trop
    // claire pour tenir le contraste avec du blanc — même règle que la
    // menthe qu'elle remplace.
    expect(ratio(token("mango-400"), token("ink-0"))).toBeLessThan(4.5);
    expect(ratio(token("ink-900"), token("mango-400"))).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("la sarcelle pleine ne porte jamais de blanc", () => {
    expect(ratio(token("teal-400"), token("ink-0"))).toBeLessThan(4.5);
    expect(ratio(token("ink-900"), token("teal-400"))).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});

describe("écart connu, non corrigé", () => {
  /**
   * **`--text-tertiary` sur blanc ne tient pas le seuil AA.**
   *
   * `ink-500` (#74857e) sur `ink-0` vaut 3,89:1, là où le texte courant en
   * demande 4,5. Le token n'est employé que par la classe `.overline` — les
   * surtitres en capitales, à 12 px et en graisse bold. C'est du texte de
   * petite taille : la règle des « grands textes » à 3:1 ne s'y applique pas,
   * et l'écart est donc réel.
   *
   * **Il n'est pas corrigé ici, délibérément.** La couleur appartient au
   * design system : la changer dans le code ferait diverger le produit de sa
   * source, ce que le dépôt interdit, et la même valeur reviendrait à la
   * prochaine reprise du système. `ink-600` (#5a6b65) tiendrait 5,7:1 et
   * resterait dans la même famille — c'est la piste à soumettre.
   *
   * Ce test verrouille le constat dans les deux sens : il rougira le jour où
   * la palette bougera, dans un sens comme dans l'autre, et la question
   * reviendra sur la table au lieu de se perdre.
   */
  it("ink-500 sur blanc reste sous le seuil, et ink-600 le passerait", () => {
    const actuel = ratio(token("ink-500"), token("ink-0"));
    expect(actuel).toBeGreaterThan(3.8);
    expect(actuel).toBeLessThan(4.5);

    expect(ratio(token("ink-600"), token("ink-0"))).toBeGreaterThanOrEqual(4.5);
  });
});
