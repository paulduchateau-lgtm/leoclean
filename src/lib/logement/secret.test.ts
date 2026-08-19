import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Le secret d'accès ne se déchiffre qu'à un seul endroit.
 *
 * Ce test ne vérifie pas un comportement, il vérifie une **frontière**. Un code
 * de porte lu depuis trois modules finit par être lu depuis un quatrième où
 * personne n'a pensé à la fenêtre temporelle — et cela ne se voit dans aucun
 * test fonctionnel, puisque chacun des quatre marche.
 */

function fichiersSources(racine: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(racine)) {
    const chemin = join(racine, entree);
    if (statSync(chemin).isDirectory()) {
      trouves.push(...fichiersSources(chemin));
    } else if (/\.tsx?$/.test(entree)) {
      trouves.push(chemin);
    }
  }
  return trouves;
}

describe("frontière du secret d'accès", () => {
  const sources = fichiersSources(join(process.cwd(), "src"));

  it("balaie effectivement le dépôt", () => {
    expect(sources.length).toBeGreaterThan(80);
  });

  it("n'autorise que `logement/secret.ts` à déchiffrer", () => {
    const coupables = sources
      .filter((chemin) => !chemin.endsWith("logement/secret.ts"))
      .filter((chemin) => !chemin.endsWith("logement/chiffrement.ts"))
      .filter((chemin) => !chemin.endsWith("logement/secret.test.ts"))
      .filter((chemin) => !chemin.endsWith("logement/chiffrement.test.ts"))
      .filter((chemin) =>
        /from\s+"@\/lib\/logement\/chiffrement"/.test(
          readFileSync(chemin, "utf8"),
        ),
      );

    expect(
      coupables.map((c) => c.replace(process.cwd(), "")),
      "seul `logement/secret.ts` peut importer le chiffrement",
    ).toEqual([]);
  });

  /*
   * La colonne chiffrée ne doit apparaître dans aucun `select` hors du module
   * gardien : la sélectionner ailleurs la ferait voyager jusqu'à un composant,
   * où elle finirait sérialisée dans le HTML.
   */
  it("ne sélectionne `accessSecretEnc` que dans le module gardien", () => {
    const coupables = sources
      .filter((chemin) => !chemin.includes("logement/"))
      .filter((chemin) =>
        readFileSync(chemin, "utf8").includes("accessSecretEnc"),
      );

    expect(coupables.map((c) => c.replace(process.cwd(), ""))).toEqual([]);
  });
});
