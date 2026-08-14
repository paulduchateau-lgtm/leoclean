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
