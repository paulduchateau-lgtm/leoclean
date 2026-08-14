import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

/**
 * Autorisations d'exploration.
 *
 * Les robots des modèles de langage sont explicitement autorisés. Le choix est
 * assumé : LéoClean n'a rien à protéger sur ses pages publiques, et être cité
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
  "/intervenant",
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
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      ...LLM_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
