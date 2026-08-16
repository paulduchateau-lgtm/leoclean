import path from "node:path";

import type { NextConfig } from "next";

/**
 * Export statique de démonstration.
 *
 * GitHub Pages ne sert que des fichiers : ni serveur, ni base, ni server
 * action. Ce mode produit donc une vitrine complète dont le tunnel de
 * réservation tourne entièrement dans le navigateur, les moteurs de
 * tarification et de disponibilité étant purs.
 *
 * `basePath` est indispensable : une page servie depuis
 * `<compte>.github.io/<dépôt>/` doit préfixer toutes ses URL, faute de quoi
 * les liens et les feuilles de style pointent à la racine du domaine.
 */
const demoStatique = process.env.NEXT_PUBLIC_DEMO_STATIQUE === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Pages d'intention retirées le 16 août 2026, et où les envoyer.
 *
 * `femme-de-menage` et `repassage` étaient publiées sur six communes chacune,
 * choisies pour leur population. Le relevé de duplication a montré que ces
 * pages partageaient 84 % de leur texte entre elles : chapeau, sections et FAQ
 * communes étaient écrits une fois pour l'intention, et la part propre à la
 * commune pesait une centaine de mots sur neuf cents. Trois pages fortes
 * valent mieux que six tièdes — voir `docs/AUDIT-DUPLICATION.md`.
 *
 * Ces URL étaient indexables : les laisser répondre 404 perdrait sèchement ce
 * qu'elles avaient acquis. Une redirection permanente transmet ce capital à la
 * page commune correspondante, qui traite le même lieu et existe toujours.
 * Permanente et non temporaire : la décision est prise, et un 307 laisserait
 * les moteurs conserver l'ancienne URL indéfiniment.
 */
const INTENTIONS_RETIREES = [
  { from: "/femme-de-menage/cestas", to: "/menage-a-domicile/cestas" },
  { from: "/femme-de-menage/cadaujac", to: "/menage-a-domicile/cadaujac" },
  { from: "/femme-de-menage/la-brede", to: "/menage-a-domicile/la-brede" },
  { from: "/repassage/cadaujac", to: "/menage-a-domicile/cadaujac" },
  { from: "/repassage/saint-selve", to: "/menage-a-domicile/saint-selve" },
  { from: "/repassage/martillac", to: "/menage-a-domicile/martillac" },
] as const;

const nextConfig: NextConfig = {
  /**
   * Ancre la racine du workspace sur ce dossier. Next.js la déduit sinon du
   * lockfile le plus proche en remontant l'arborescence — ce qui vise juste
   * tant que le projet est seul, mais le désignait au voisin du temps où il
   * vivait dans un sous-dossier du dépôt `famille`. L'ancre coûte une ligne
   * et retire la question.
   */
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },

  typescript: {
    // Une erreur de type doit casser le build, jamais être ignorée.
    ignoreBuildErrors: false,
  },

  /*
   * L'export statique de la vitrine ne sait pas rediriger — GitHub Pages ne
   * sert que des fichiers. Les redirections n'existent donc qu'en production,
   * là où elles ont un sens : la démonstration est en `noindex`, aucune de ces
   * URL n'y a jamais été indexée.
   */
  ...(demoStatique
    ? {}
    : {
        redirects: () =>
          Promise.resolve(
            INTENTIONS_RETIREES.map(({ from, to }) => ({
              source: from,
              destination: to,
              permanent: true,
            })),
          ),
      }),

  images: demoStatique
    ? // L'optimiseur d'images de Next exige un serveur ; en export statique
      // les fichiers sont servis tels quels.
      { unoptimized: true }
    : {
        // AVIF d'abord : les photos d'intervenants sont l'élément le plus lourd
        // des pages publiques, et le LCP mobile est un objectif produit.
        formats: ["image/avif", "image/webp"],
      },

  ...(demoStatique
    ? {
        output: "export" as const,
        basePath,
        // Sans cela, `/tarifs` renverrait 404 sur GitHub Pages, qui ne sert
        // un dossier que par son `index.html`.
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
