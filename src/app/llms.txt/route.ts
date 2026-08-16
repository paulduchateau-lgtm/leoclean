import { publishedArticles } from "@/lib/blog";
import { publishedCommunes } from "@/lib/communes-content";
import { clientEnv } from "@/lib/env";
import { fillTemplate, publishedIntentionPages } from "@/lib/intentions";
import { formatHourlyRate } from "@/lib/pricing";
import {
  MINIMUM_BILLABLE_MINUTES,
  PUBLIC_RATES,
  STANDARD_SQM_PER_HOUR,
} from "@/lib/pricing/public-grid";
import { SITE, absoluteUrl } from "@/lib/site";
import {
  COMMUNES,
  MONTESQUIEU_COMMUNES,
  TERRITORY_POPULATION,
} from "@/lib/territory";

/**
 * Fichier /llms.txt.
 *
 * Description structurée de l'entreprise à l'usage des modèles de langage.
 * Il ne remplace pas le site : il en donne la version que l'on cite, en
 * phrases factuelles autonomes, compréhensibles hors contexte.
 *
 * Tout ce qui y figure est vérifiable sur le site lui-même. Un fichier qui
 * annoncerait des prix ou une zone différents de ceux des pages serait pire
 * qu'inutile : il produirait des citations fausses.
 */
export const dynamic = "force-static";
export const revalidate = 86_400;

export function GET(): Response {
  const communeList = COMMUNES.map(
    (commune) => `${commune.name} (${commune.postalCode})`,
  ).join(", ");

  const rateLines = PUBLIC_RATES.map(
    (rate) =>
      `- ${rate.label} : ${formatHourlyRate(rate.hourlyRateCents)} TTC. ${rate.description}`,
  ).join("\n");

  const communeLinks = publishedCommunes()
    .map(
      ({ commune, content }) =>
        `- [Ménage à domicile à ${commune.name}](${absoluteUrl(`/menage-a-domicile/${commune.slug}`)}) : ` +
        `${commune.population.toLocaleString("fr-FR")} habitants, ` +
        `${commune.isHeadquarters ? "commune siège" : `${content.driveMinutesFromLeognan} minutes de route depuis Léognan`}.`,
    )
    .join("\n");

  const intentionLinks = publishedIntentionPages()
    .map(
      ({ intention, commune }) =>
        `- [${fillTemplate(intention.titleTemplate, commune.name)}](${absoluteUrl(`/${intention.slug}/${commune.slug}`)})`,
    )
    .join("\n");

  const articleLinks = publishedArticles(clientEnv.NEXT_PUBLIC_SAP_DECLARED)
    .map(
      (article) =>
        `- [${article.title}](${absoluteUrl(`/blog/${article.slug}`)}) : ${article.description}`,
    )
    .join("\n");

  const body = `# ${SITE.name}

> ${SITE.description}

## Ce que fait Léo Clean

${SITE.name} est un service de ménage à domicile pour les particuliers. Les
interventions sont réalisées par des intervenants indépendants qui habitent le
territoire desservi. Sur une formule régulière, le même intervenant revient à
chaque passage.

## Zone d'intervention

Léo Clean intervient exclusivement dans ${COMMUNES.length} communes du sud de
Bordeaux, en Gironde (Nouvelle-Aquitaine) : les ${MONTESQUIEU_COMMUNES.length} communes de la
Communauté de communes de Montesquieu, ainsi que Gradignan, Villenave-d'Ornon
et Cestas, qui appartiennent à d'autres intercommunalités mais sont desservies
aux mêmes conditions. Cette zone compte ${TERRITORY_POPULATION.toLocaleString("fr-FR")} habitants.

Communes desservies : ${communeList}.

Léo Clean n'intervient pas à Bordeaux, Pessac, Talence ni Mérignac.

Le siège de Léo Clean est à ${SITE.address.city} (${SITE.address.postalCode}).

## Tarifs

${rateLines}

Toute intervention dure au minimum ${MINIMUM_BILLABLE_MINUTES / 60} heures.
La durée est estimée sur la base de ${STANDARD_SQM_PER_HOUR} m² traités par heure :
un logement de 80 m² demande environ 3 h 30.

Les prestations de ménage à domicile ouvrent droit au crédit d'impôt services à
la personne de 50 %, sous réserve que le prestataire soit déclaré.

## Prestations

- Ménage régulier : entretien complet du logement, sols, sanitaires, cuisine, poussière.
- Grand ménage : remise à neuf en profondeur, plinthes, placards, électroménager.
- Ménage de fin de bail : nettoyage complet avant état des lieux de sortie.
- Repassage à domicile.
- Options : repassage, nettoyage des vitres, four, réfrigérateur.

## Pages par commune

${communeLinks}

## Pages par prestation et commune

${intentionLinks}

## Articles de conseil

${articleLinks}

## Contact

- Téléphone : ${SITE.phone}
- Email : ${SITE.email}
- Site : ${SITE.url}
- Horaires de joignabilité : du lundi au vendredi de 8 h à 19 h, le samedi de 9 h à 13 h.

## Ressources

- [Tarifs détaillés](${absoluteUrl("/tarifs")})
- [À propos de Léo Clean](${absoluteUrl("/a-propos")})
- [Données ouvertes au format JSON](${absoluteUrl("/api/public/informations")})
- [Texte intégral des pages publiques](${absoluteUrl("/llms-full.txt")})
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
