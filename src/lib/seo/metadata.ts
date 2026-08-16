import type { Metadata } from "next";

import { SITE, absoluteUrl } from "@/lib/site";

/**
 * Format attendu par Facebook, WhatsApp, LinkedIn et X.
 *
 * Déclaré ici plutôt que dans `og.tsx`, qui charge les polices au premier
 * import : une page qui a seulement besoin de connaître les dimensions de la
 * carte n'a pas à embarquer son moteur de rendu.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

/**
 * Carte de partage générique, celle de la racine.
 *
 * `alt` y est posé une fois : `src/app/opengraph-image.tsx` le relit, et
 * `pageMetadata` le renvoie aux pages qui n'ont pas de carte à elles.
 */
export const SITE_OG_CARD = {
  path: "/opengraph-image",
  title: "Ménage à domicile dans le sud de Bordeaux",
} as const;

/** Texte alternatif d'une carte de partage, repris par `og:image:alt`. */
export function ogAlt(title: string): string {
  return `${title} — ${SITE.name}`;
}

/**
 * Métadonnées d'une page publique.
 *
 * Un seul endroit décide que `canonical` et `og:url` désignent la même chose,
 * parce qu'ils ne peuvent pas dire autre chose l'un que l'autre sans casser
 * quelque chose. Le `canonical` dit aux moteurs quelle URL indexer ; `og:url`
 * dit aux réseaux sociaux à quelle URL rattacher les partages. Les deux
 * pointaient sur l'accueil pour toute page ne déclarant pas son propre bloc
 * `openGraph` — hérité du gabarit racine — ce qui consolidait sur `/` les
 * partages de `/tarifs` comme ceux d'une page commune.
 *
 * D'où la règle : aucune page ne construit son `og:url` à la main, et le
 * gabarit racine n'en porte plus.
 *
 * Le chemin est passé en relatif. `metadataBase` le résout pour le
 * `canonical`, mais `og:url` doit être absolu pour les moteurs de
 * prévisualisation, qui ne relisent pas la page.
 */
export function pageMetadata({
  path,
  title,
  description,
  openGraphTitle,
  openGraphDescription,
  hasOwnOpenGraphImage = false,
  summary,
  article,
}: {
  /** Chemin de la page, à partir de la racine du site. */
  path: string;
  title?: string;
  description?: string;
  /** Titre de la carte de partage, s'il gagne à être plus court. */
  openGraphTitle?: string;
  /** Description de la carte, si celle des moteurs est trop technique. */
  openGraphDescription?: string;
  /**
   * La page a son propre `opengraph-image.tsx`.
   *
   * Il faut le dire, parce que Next remplace le bloc `openGraph` hérité au
   * lieu de le compléter : dès qu'une page en déclare un — et toutes en
   * déclarent un ici, ne serait-ce que pour `og:url` — l'image du gabarit
   * racine disparaît. On la repose donc explicitement, sauf quand la page a
   * mieux à proposer : une `images` posée à la main gagne sur le fichier de
   * la route et effacerait la carte de la commune.
   */
  hasOwnOpenGraphImage?: boolean;
  /**
   * Résumé factuel de la page, en une phrase.
   *
   * Destiné aux modèles de langage, qui n'ont pas de « position 1 » : ils
   * citent la phrase qui répond, ou ils ne citent rien. Elle doit donc contenir
   * le service, le lieu et le chiffre clé, et rester vraie hors de sa page.
   *
   * Deux noms pour la même valeur — `llm-summary` et `ai:content` — parce
   * qu'aucun n'est normalisé et que les deux circulent. Le coût est nul, et
   * une balise ignorée ne fait de mal à personne.
   */
  summary?: string;
  /**
   * Dates d'un article, si la page en est un.
   *
   * Elles font passer `og:type` de `website` à `article`, le seul type qui
   * porte une date de publication. Les réseaux s'en servent pour dater ce
   * qu'ils affichent, et un conseil daté vieillit visiblement — ce qui est
   * préférable à un conseil qu'on croit à jour.
   */
  article?: { publishedTime: string; modifiedTime: string };
}): Metadata {
  const ogTitle = openGraphTitle ?? title;
  const ogDescription = openGraphDescription ?? description;

  return {
    ...(title === undefined ? {} : { title }),
    ...(description === undefined ? {} : { description }),
    alternates: { canonical: path },
    ...(summary === undefined
      ? {}
      : { other: { "llm-summary": summary, "ai:content": summary } }),
    openGraph: {
      ...(article
        ? {
            type: "article",
            publishedTime: article.publishedTime,
            modifiedTime: article.modifiedTime,
          }
        : { type: "website" }),
      url: absoluteUrl(path),
      ...(ogTitle === undefined ? {} : { title: ogTitle }),
      ...(ogDescription === undefined ? {} : { description: ogDescription }),
      ...(hasOwnOpenGraphImage
        ? {}
        : {
            images: [
              {
                url: SITE_OG_CARD.path,
                ...OG_SIZE,
                alt: ogAlt(SITE_OG_CARD.title),
              },
            ],
          }),
    },
  };
}
