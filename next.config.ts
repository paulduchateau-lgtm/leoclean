import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * LéoClean vit dans un sous-dossier d'un dépôt qui héberge une autre
   * application. Sans cette ancre, Next.js remonte au lockfile parent et
   * compile les fichiers de l'application voisine.
   */
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },

  typescript: {
    // Une erreur de type doit casser le build, jamais être ignorée.
    ignoreBuildErrors: false,
  },

  images: {
    // AVIF d'abord : les photos d'intervenants sont l'élément le plus lourd
    // des pages publiques, et le LCP mobile est un objectif produit.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
