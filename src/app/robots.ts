import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { clientEnv } from "@/lib/env";
import { hostOf } from "@/lib/hosting";
import { PRO_ORIGIN, SITE, absoluteUrl } from "@/lib/site";

/**
 * Autorisations d'exploration.
 *
 * Les robots des modèles de langage sont explicitement autorisés. Le choix est
 * assumé : Léo Clean n'a rien à protéger sur ses pages publiques, et être cité
 * en réponse à « qui fait du ménage à Léognan ? » vaut davantage qu'un contenu
 * verrouillé que personne ne reprend. Refuser GPTBot ou ClaudeBot reviendrait à
 * se retirer d'un canal d'acquisition en croissance.
 *
 * Les espaces connectés et les points d'entrée techniques sont exclus : ils ne
 * répondent à aucune intention de recherche et diluent le maillage interne.
 */
const PRIVATE_PATHS = [
  "/api/",
  "/connexion",
  "/mon-compte",
  "/mon-espace",
  "/intervenant",
  "/rejoindre",
  "/gestion",
  "/administration",
];

/** Robots d'entraînement et de recherche des modèles de langage. */
const LLM_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "CCBot",
  "Applebot-Extended",
  "meta-externalagent",
  // Bing alimente Copilot autant que sa propre recherche : il est nommé ici
  // plutôt que laissé à la règle générale, pour que l'intention se lise.
  "Bingbot",
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  /*
   * Hors production, on refuse tout. L'en-tête `X-Robots-Tag` posé par le
   * proxy suffirait — il couvre ce fichier comme le reste — mais c'est ici
   * qu'un humain vient vérifier, et un `robots.txt` permissif servi par un
   * environnement de test se lit comme une autorisation. Deux refus valent
   * mieux qu'un seul, invisible.
   */
  if (clientEnv.NEXT_PUBLIC_ENVIRONMENT !== "production") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  /*
   * Chaque hôte annonce **son** sitemap et **son** origine canonique. Un
   * `robots.txt` servi par `pro.leoclean.fr` qui désignerait le sitemap de
   * `leoclean.fr` enverrait Google explorer un site dont aucune URL n'est la
   * sienne — et la directive `host` désignerait un domaine qui ne sert pas
   * cette page.
   *
   * Tant que `NEXT_PUBLIC_PRO_URL` est absente, `PRO_ORIGIN` vaut l'origine de
   * la vitrine : les deux branches se rejoignent, et rien ne change.
   */
  const requestHost = (await headers()).get("host");
  const proHost = hostOf(PRO_ORIGIN);
  const surLaFacePro =
    proHost !== null && proHost !== hostOf(SITE.url) && requestHost === proHost;
  const origine = surLaFacePro ? `${PRO_ORIGIN}/` : absoluteUrl("/");

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      ...LLM_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: `${origine}sitemap.xml`,
    host: origine,
  };
}
