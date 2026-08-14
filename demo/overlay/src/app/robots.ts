import type { MetadataRoute } from "next";

/**
 * Vitrine statique : tout est interdit à l'indexation.
 *
 * Ce n'est pas de la prudence, c'est une nécessité. Cette vitrine est un
 * double intégral du futur site : seize pages communes, douze pages
 * d'intention, quatre articles, tous rédigés pour se classer sur les mêmes
 * requêtes. Laissée indexable, elle entrerait en concurrence avec
 * `leoclean.fr` sur les requêtes mêmes qu'elle sert à gagner, et un
 * `github.io` établi de longue date part avec l'avantage d'ancienneté.
 *
 * Chaque page porte en outre son propre `noindex` : un robot qui ignore
 * `robots.txt` lit tout de même la balise.
 *
 * `force-static` est exigé par l'export : une route qui ne déclare pas
 * qu'elle est figée ne peut pas être produite en fichier.
 */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
