/**
 * Audit de similarité des pages programmatiques.
 *
 * Mesure ce que deux pages ont réellement en commun, hors en-tête, pied de
 * page et navigation : c'est le seul texte que les moteurs comparent quand ils
 * décident si un modèle de page produit du contenu ou des satellites.
 *
 * Deux mesures, parce qu'elles ne disent pas la même chose :
 *
 * - **Jaccard sur les mots** — vocabulaire partagé. Deux pages qui parlent du
 *   même service se ressemblent forcément un peu.
 * - **Recouvrement de 5-grammes** — phrases identiques. C'est celle qui compte :
 *   au-delà d'un certain seuil, les pages disent littéralement la même chose.
 */

const BASE = process.env.BASE ?? "http://127.0.0.1:3210";

const COMMUNES = [
  "villenave-d-ornon",
  "gradignan",
  "cestas",
  "leognan",
  "cadaujac",
  "la-brede",
  "saint-selve",
  "martillac",
  "saucats",
  "saint-medard-d-eyrans",
  "castres-gironde",
  "beautiran",
  "cabanac-et-villagrains",
  "saint-morillon",
  "ayguemorte-les-graves",
  "isle-saint-georges",
];

/** Texte du `<main>` seul, balises retirées. */
async function mainText(path) {
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) return null;
  const html = await response.text();
  const main = /<main[^>]*>([\s\S]*?)<\/main>/.exec(html)?.[1];
  if (!main) return null;
  return main
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const words = (text) => text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

function shingles(text, size = 5) {
  const tokens = words(text);
  const set = new Set();
  for (let i = 0; i + size <= tokens.length; i++) {
    set.add(tokens.slice(i, i + size).join(" "));
  }
  return set;
}

function jaccard(a, b) {
  const intersection = [...a].filter((entry) => b.has(entry)).length;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Part des 5-grammes de `a` qu'on retrouve dans `b`. */
function containment(a, b) {
  if (a.size === 0) return 0;
  return [...a].filter((entry) => b.has(entry)).length / a.size;
}

const pages = new Map();

for (const commune of COMMUNES) {
  for (const template of ["menage-a-domicile", "femme-de-menage", "repassage"]) {
    const path = `/${template}/${commune}`;
    const text = await mainText(path);
    if (text) pages.set(path, text);
  }
}

console.log(`${pages.size} pages relevées.\n`);

const entries = [...pages.entries()].map(([path, text]) => ({
  path,
  words: new Set(words(text)),
  shingles: shingles(text),
  length: words(text).length,
}));

const rows = [];
for (let i = 0; i < entries.length; i++) {
  for (let j = i + 1; j < entries.length; j++) {
    const a = entries[i];
    const b = entries[j];
    rows.push({
      a: a.path,
      b: b.path,
      mots: jaccard(a.words, b.words),
      // Le maximum des deux sens : une page courte entièrement contenue dans
      // une longue est un doublon, même si la réciproque est fausse.
      phrases: Math.max(
        containment(a.shingles, b.shingles),
        containment(b.shingles, a.shingles),
      ),
    });
  }
}

rows.sort((x, y) => y.phrases - x.phrases);

console.log("| Page A | Page B | Mots | Phrases |");
console.log("| --- | --- | ---: | ---: |");
for (const row of rows.slice(0, 30)) {
  console.log(
    `| ${row.a} | ${row.b} | ${(row.mots * 100).toFixed(0)} % | ${(row.phrases * 100).toFixed(0)} % |`,
  );
}

const seuil = rows.filter((row) => row.phrases > 0.7);
console.log(`\nPaires au-delà de 70 % de phrases communes : ${seuil.length}`);
console.log(
  `Maximum observé : ${(rows[0].phrases * 100).toFixed(0)} % (${rows[0].a} / ${rows[0].b})`,
);

const parGabarit = {};
for (const row of rows) {
  const ga = row.a.split("/")[1];
  const gb = row.b.split("/")[1];
  const key = [ga, gb].sort().join(" ↔ ");
  (parGabarit[key] ??= []).push(row.phrases);
}
console.log("\n| Paire de gabarits | Phrases communes, médiane | Maximum |");
console.log("| --- | ---: | ---: |");
for (const [key, values] of Object.entries(parGabarit)) {
  const sorted = [...values].sort((x, y) => x - y);
  const median = sorted[Math.floor(sorted.length / 2)];
  console.log(
    `| ${key} | ${(median * 100).toFixed(0)} % | ${(Math.max(...values) * 100).toFixed(0)} % |`,
  );
}

console.log("\n| Page | Mots dans le `<main>` |");
console.log("| --- | ---: |");
for (const entry of entries.slice(0, 5)) {
  console.log(`| ${entry.path} | ${entry.length} |`);
}
