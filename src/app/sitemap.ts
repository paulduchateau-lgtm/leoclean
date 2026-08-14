import type { MetadataRoute } from "next";

import { publishedCommunes } from "@/lib/communes-content";
import { absoluteUrl } from "@/lib/site";

/**
 * Plan du site.
 *
 * Les priorités reflètent l'intention réelle : les pages locales sont le point
 * d'entrée de l'acquisition, la page tarifs celle qui convertit, les pages
 * légales n'ont pas vocation à ressortir. Un sitemap qui déclare tout à 1.0 ne
 * transmet aucune information.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: absoluteUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/menage-a-domicile"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...publishedCommunes().map(({ commune }) => ({
      url: absoluteUrl(`/menage-a-domicile/${commune.slug}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    {
      url: absoluteUrl("/etre-rappele"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/tarifs"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/a-propos"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
