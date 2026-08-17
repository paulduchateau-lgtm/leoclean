#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Construit la vitrine statique de démonstration.
 *
 * GitHub Pages ne sert que des fichiers. Or l'application contient trois
 * choses qu'un export statique ne peut pas produire : des server actions, des
 * pages qui lisent la session, et un middleware. Ce script les écarte le temps
 * du build, puis remet l'arbre en l'état.
 *
 * Le choix de déplacer des fichiers plutôt que de multiplier les conditions
 * dans le code est délibéré : une condition oubliée casse le build de
 * production, un fichier déplacé ne casse que celui-ci — et le `finally`
 * garantit que l'arbre est restauré même si le build échoue.
 *
 * Usage :
 *   node scripts/build-demo-statique.mjs [--base-path /depot] [--out chemin]
 */

const projet = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const remise = path.join(projet, ".demo-remise");

/** Chemins que l'export statique ne peut pas produire. */
const ECARTES = [
  // Espaces connectés : ils lisent la session, donc sont dynamiques par nature.
  "src/app/(app)",
  "src/app/(auth)",
  "src/app/api/auth",
  // Server actions : leur seule présence dans le graphe interdit l'export.
  "src/app/etre-rappele/actions.ts",
  "src/app/reserver/actions.ts",
  // La page d'offre porte sa propre server action, et elle n'a rien à faire
  // sur une vitrine destinée à montrer le parcours client. Ses composants
  // partent avec elle : ils n'ont pas d'autre consommateur, et le formulaire
  // de candidature importerait une action qui n'est plus là.
  "src/app/travailler-avec-nous",
  "src/components/intervenants",
  // Les pages société lisent la base pour lister les slugs publiables, et
  // `dynamicParams` est incompatible avec `output: export` — une page rendue
  // à la demande n'existe pas dans un site de fichiers.
  "src/app/pro",
  // Le middleware suppose un serveur devant les fichiers.
  "src/proxy.ts",
  // Un plan du site contredirait le `Disallow: /` de la vitrine.
  "src/app/sitemap.ts",
];

/** Fichiers de `demo/overlay` qui prennent la place de leur homonyme. */
const OVERLAY = path.join(projet, "demo/overlay");

function argument(nom, defaut) {
  const index = process.argv.indexOf(nom);
  return index === -1 ? defaut : (process.argv[index + 1] ?? defaut);
}

const basePath = argument("--base-path", "");
const sortie = argument("--out", path.join(projet, "out"));

/** Liste récursive des fichiers d'un dossier, en chemins relatifs. */
function fichiersDe(racine, prefixe = "") {
  const resultat = [];
  for (const entree of fs.readdirSync(path.join(racine, prefixe), {
    withFileTypes: true,
  })) {
    const relatif = path.join(prefixe, entree.name);
    if (entree.isDirectory()) {
      resultat.push(...fichiersDe(racine, relatif));
    } else {
      resultat.push(relatif);
    }
  }
  return resultat;
}

const deplaces = [];
const poses = [];

function ecarter(relatif) {
  const source = path.join(projet, relatif);
  if (!fs.existsSync(source)) return;
  const destination = path.join(remise, relatif);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(source, destination);
  deplaces.push(relatif);
}

function poser(relatif) {
  const source = path.join(OVERLAY, relatif);
  const destination = path.join(projet, relatif);
  if (fs.existsSync(destination)) {
    ecarter(relatif);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  poses.push(relatif);
}

function restaurer() {
  for (const relatif of poses) {
    fs.rmSync(path.join(projet, relatif), { force: true });
  }
  // Dans l'ordre inverse : un fichier peut avoir été écarté puis remplacé.
  for (const relatif of [...deplaces].reverse()) {
    const source = path.join(remise, relatif);
    const destination = path.join(projet, relatif);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.renameSync(source, destination);
  }
  fs.rmSync(remise, { recursive: true, force: true });
}

try {
  fs.rmSync(remise, { recursive: true, force: true });
  for (const relatif of ECARTES) ecarter(relatif);
  for (const relatif of fichiersDe(OVERLAY)) poser(relatif);

  console.log(
    `Vitrine statique : ${deplaces.length} chemins écartés, ` +
      `${poses.length} fichiers substitués.`,
  );

  /*
   * Les types de routes d'une construction précédente survivent dans `.next/`
   * et décrivent un arbre que celle-ci n'a plus : le validateur engendré par
   * `next typegen` importe chaque page qu'il a vue, y compris les espaces
   * connectés que le script vient d'écarter, et la construction échoue au
   * typage sur quatorze modules introuvables.
   *
   * On repart donc d'un cache vide. C'est le seul endroit du script où l'on
   * détruit quelque chose, et cela ne coûte qu'une reconstruction : `.next/`
   * est un artefact, jamais une source.
   */
  fs.rmSync(path.join(projet, ".next"), { recursive: true, force: true });

  execFileSync("npx", ["next", "build"], {
    cwd: projet,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_DEMO_STATIQUE: "true",
      // La vitrine n'est pas la production : une seule règle décide de
      // l'indexation, et elle passe par cette déclaration.
      NEXT_PUBLIC_ENVIRONMENT: "dev",
      NEXT_PUBLIC_BASE_PATH: basePath,
      NEXT_PUBLIC_SITE_URL:
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.invalid",
      // Le build ne touche pas la base, mais la validation d'environnement
      // exige les variables serveur : on la court-circuite explicitement.
      SKIP_ENV_VALIDATION: "1",
    },
  });
} finally {
  restaurer();
}

// GitHub Pages sert le dossier tel quel et ignorerait `_next/`, dont le nom
// commence par un tiret bas : Jekyll écarte ces dossiers. Ce fichier le
// désactive.
fs.writeFileSync(path.join(sortie, ".nojekyll"), "");

console.log(`\nVitrine statique écrite dans ${sortie}`);
