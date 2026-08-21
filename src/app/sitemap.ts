import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { publishedArticles } from "@/lib/blog";
import { publishedCommunes } from "@/lib/communes-content";
import { clientEnv } from "@/lib/env";
import { INTERVENANT_PAGE_READY } from "@/lib/facts";
import { publishedIntentionPages } from "@/lib/intentions";
import { hostOf } from "@/lib/hosting";
import { PRO_ORIGIN, SITE, absoluteUrl } from "@/lib/site";

/**
 * Plan du site — un par hôte, parce qu'un sous-domaine est un site distinct.
 *
 * Les priorités reflètent l'intention réelle : les pages locales sont le point
 * d'entrée de l'acquisition, la page tarifs celle qui convertit, les pages
 * légales n'ont pas vocation à ressortir. Un sitemap qui déclare tout à 1.0 ne
 * transmet aucune information.
 *
 * **La route est dynamique, et c'est le prix à payer.** Un `sitemap.ts` est
 * mis en cache par défaut ; lire l'en-tête `host` en fait une route servie à
 * la demande. C'est nécessaire : le même déploiement répond sur la vitrine et
 * sur la face pro, et servir à `pro.leoclean.fr` la liste des pages de
 * `leoclean.fr` déclarerait à Google un site dont aucune URL ne lui
 * appartient. Le coût est nul sur le chemin de conversion — un sitemap n'est
 * lu que par des robots.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const requestHost = (await headers()).get("host");
  const proHost = hostOf(PRO_ORIGIN);

  /*
   * La face pro n'a un sitemap à elle que si elle a un hôte à elle. Tant que
   * `NEXT_PUBLIC_PRO_URL` est absente, `PRO_ORIGIN` vaut l'origine de la
   * vitrine : les deux hôtes coïncident, et la page d'offre reste dans le
   * sitemap unique, exactement comme la veille.
   */
  const surLaFacePro =
    proHost !== null && proHost !== hostOf(SITE.url) && requestHost === proHost;

  if (surLaFacePro) {
    // Une seule page indexable de ce côté : `/rejoindre` et `/intervenant`
    // sont en `noindex`, l'une étant un tunnel et l'autre un espace connecté.
    return INTERVENANT_PAGE_READY
      ? [
          {
            url: `${PRO_ORIGIN}/travailler-avec-nous`,
            lastModified,
            changeFrequency: "monthly",
            priority: 1,
          },
        ]
      : [];
  }

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
    // Page pivot du maillage : c'est elle qui porte la liste exhaustive
    // depuis que le pied de page n'en montre plus que six.
    {
      url: absoluteUrl("/zones-desservies"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...publishedCommunes().map(({ commune }) => ({
      url: absoluteUrl(`/menage-a-domicile/${commune.slug}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    // Intentions secondaires : même valeur commerciale, volume plus faible.
    ...publishedIntentionPages().map(({ intention, commune }) => ({
      url: absoluteUrl(`/${intention.slug}/${commune.slug}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
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
      url: absoluteUrl("/blog"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // Les articles portent leur propre date de révision plutôt que celle du
    // build : annoncer une modification qui n'a pas eu lieu use la confiance
    // que le sitemap sert précisément à établir.
    ...publishedArticles(clientEnv.NEXT_PUBLIC_SAP_DECLARED).map((article) => ({
      url: absoluteUrl(`/blog/${article.slug}`),
      lastModified: new Date(article.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    {
      url: absoluteUrl("/a-propos"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    /*
     * Page d'offre : elle n'entre au sitemap qu'une fois ses conditions
     * arbitrées — se classer sur « missions ménage Gironde » sans pouvoir dire
     * ce qu'on paie ferait venir précisément les gens qu'on décevrait.
     *
     * Elle n'y figure que tant qu'elle est servie par la vitrine. Une fois la
     * face pro dotée de son hôte, elle passe dans le sitemap de celui-ci :
     * déclarer dans le sitemap d'un domaine une URL d'un autre est ignoré au
     * mieux, tenu pour une tentative de manipulation au pire.
     */
    ...(INTERVENANT_PAGE_READY && proHost === hostOf(SITE.url)
      ? [
          {
            url: absoluteUrl("/travailler-avec-nous"),
            lastModified,
            changeFrequency: "monthly" as const,
            priority: 0.7,
          },
        ]
      : []),
  ];
}
