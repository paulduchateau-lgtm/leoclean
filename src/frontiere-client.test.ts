import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Aucun composant client ne doit atteindre un module `server-only`.
 *
 * **Cette frontière s'est vengée trois fois dans la même journée** — le
 * vocabulaire des réclamations, celui de la messagerie, le plafond du rapport
 * photo. À chaque fois le même geste : une constante ou un type lu depuis un
 * module qui, lui, importe Prisma ou le SDK S3. Le typage ne voit rien, `tsc`
 * passe, et c'est la **construction** qui s'arrête — ou pire, le serveur de
 * développement qui refuse de démarrer, plusieurs minutes plus tard, sur une
 * trace qui ne nomme pas le geste fautif.
 *
 * Le remède n'est pas la vigilance, c'est ce test. Il rend l'erreur visible en
 * une seconde, avec la chaîne d'imports complète.
 *
 * **La traversée s'arrête aux server actions.** Un fichier `"use server"` est
 * la frontière RPC prévue par React : un composant client a le droit de
 * l'importer, et cette action a le droit d'atteindre la base. C'est
 * exactement ce qui distingue un appel légitime d'une fuite de dépendance.
 */

const RACINE = resolve(import.meta.dirname);
const EXTENSIONS = [".ts", ".tsx"];

function fichiersDeSource(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      trouves.push(...fichiersDeSource(chemin));
    } else if (
      EXTENSIONS.some((extension) => chemin.endsWith(extension)) &&
      !chemin.endsWith(".test.ts") &&
      !chemin.endsWith(".test.tsx")
    ) {
      trouves.push(chemin);
    }
  }
  return trouves;
}

/** Le premier caractère utile d'un fichier, directives comprises. */
function directive(contenu: string, nom: string): boolean {
  const tete = contenu.slice(0, 400);
  return tete.includes(`"${nom}"`) || tete.includes(`'${nom}'`);
}

/**
 * Les imports d'un fichier, résolus en chemins absolus.
 *
 * On ne suit que ce qui appartient au dépôt : `@/…` et le relatif. Une
 * dépendance de `node_modules` ne porte pas `server-only`, et la suivre ferait
 * exploser la traversée pour rien.
 */
function importsDe(chemin: string, contenu: string): string[] {
  const cibles: string[] = [];

  /*
   * `import type { … } from "…"` est **effacé à la compilation** : il ne tire
   * rien dans le paquet du navigateur, et le suivre produirait un faux positif.
   * C'est le cas de `sign-in-form.tsx`, qui lit le type `ActionResult` depuis
   * un module `server-only` sans jamais en charger une ligne.
   *
   * Un `import { type A, B }` compte en revanche : `B` est une valeur.
   */
  const motif =
    /(?:^|\n)\s*(?:import|export)\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']|(?:^|\n)\s*import\s+["']([^"']+)["']/g;

  for (const correspondance of contenu.matchAll(motif)) {
    if (correspondance[1]) continue;
    const specificateur = correspondance[2] ?? correspondance[3]!;

    let base: string;
    if (specificateur.startsWith("@/")) {
      base = join(RACINE, specificateur.slice(2));
    } else if (specificateur.startsWith(".")) {
      base = resolve(dirname(chemin), specificateur);
    } else {
      continue;
    }

    const candidats = [
      ...EXTENSIONS.map((extension) => base + extension),
      ...EXTENSIONS.map((extension) => join(base, `index${extension}`)),
      base,
    ];

    const resolu = candidats.find((candidat) => {
      try {
        return statSync(candidat).isFile();
      } catch {
        return false;
      }
    });

    if (resolu) cibles.push(resolu);
  }

  return cibles;
}

interface Fichier {
  contenu: string;
  serverOnly: boolean;
  useClient: boolean;
  useServer: boolean;
  imports: string[];
}

const FICHIERS = new Map<string, Fichier>();

for (const chemin of fichiersDeSource(RACINE)) {
  const contenu = readFileSync(chemin, "utf8");
  FICHIERS.set(chemin, {
    contenu,
    serverOnly: directive(contenu, "server-only"),
    useClient: directive(contenu, "use client"),
    useServer: directive(contenu, "use server"),
    imports: importsDe(chemin, contenu),
  });
}

/** Le premier chemin trouvé d'un composant client vers un module server-only. */
function chaineVersServerOnly(depart: string): string[] | null {
  const vus = new Set<string>([depart]);
  const file: { chemin: string; chaine: string[] }[] = [
    { chemin: depart, chaine: [depart] },
  ];

  while (file.length > 0) {
    const { chemin, chaine } = file.shift()!;
    const fichier = FICHIERS.get(chemin);
    if (!fichier) continue;

    for (const cible of fichier.imports) {
      if (vus.has(cible)) continue;
      vus.add(cible);

      const importe = FICHIERS.get(cible);
      if (!importe) continue;

      if (importe.serverOnly) return [...chaine, cible];

      /*
       * Une server action est la frontière prévue : on ne traverse pas au-delà.
       * C'est ce qui distingue un appel RPC légitime d'une fuite de dépendance.
       */
      if (importe.useServer) continue;

      file.push({ chemin: cible, chaine: [...chaine, cible] });
    }
  }

  return null;
}

describe("frontière client / serveur", () => {
  it("recense bien les composants clients et les modules server-only", () => {
    const clients = [...FICHIERS.values()].filter((f) => f.useClient);
    const serveurs = [...FICHIERS.values()].filter((f) => f.serverOnly);

    /*
     * Garde-fou du garde-fou : si la détection tombait à zéro — une directive
     * déplacée, une extension oubliée — le test passerait en ne vérifiant rien.
     */
    expect(clients.length).toBeGreaterThan(10);
    expect(serveurs.length).toBeGreaterThan(10);
  });

  it("aucun composant client n'atteint un module server-only", () => {
    const fautes: string[] = [];

    for (const [chemin, fichier] of FICHIERS) {
      if (!fichier.useClient) continue;

      const chaine = chaineVersServerOnly(chemin);
      if (chaine) {
        fautes.push(
          chaine.map((etape) => relative(RACINE, etape)).join("\n     → "),
        );
      }
    }

    expect(
      fautes,
      fautes.length === 0
        ? ""
        : "Un composant client atteint un module `server-only`. Le typage ne le " +
            "voit pas, la construction s'arrête. Sortez ce qui est partagé — " +
            "constantes, types, libellés — dans un module pur.\n\n" +
            fautes.join("\n\n"),
    ).toEqual([]);
  });
});
