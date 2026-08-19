import { MapPinIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CommuneStart } from "@/components/commune-start";
import { ListeAttente } from "@/components/liste-attente";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { publishedCommunes } from "@/lib/communes-content";
import { publishedIntentionPages } from "@/lib/intentions";
import { formatHourlyRate } from "@/lib/pricing";
import { LOWEST_HOURLY_RATE_CENTS } from "@/lib/pricing/public-grid";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import {
  COMMUNES,
  COMMUNES_BY_POPULATION,
  MONTESQUIEU_COMMUNES,
  TERRITORY_POPULATION,
  coverageRadiusKm,
} from "@/lib/territory";

/**
 * Page pivot du maillage interne.
 *
 * Le pied de page exposait quarante liens depuis chaque page du site, ce qui
 * répartissait l'autorité en parts si petites qu'aucune page locale n'en
 * bénéficiait. Il n'en porte plus que six, et pointe ici : c'est cette page qui
 * porte le maillage exhaustif, et elle seule.
 *
 * Elle a aussi une valeur propre, indépendante du référencement. « Est-ce que
 * vous venez chez moi ? » est la première question de quelqu'un qui découvre un
 * service local, et jusqu'ici la réponse complète n'existait qu'éparpillée
 * entre le pied de page et l'index des communes.
 */

export const metadata: Metadata = pageMetadata({
  path: "/zones-desservies",
  summary: `Léo Clean dessert ${COMMUNES.length} communes du sud de Bordeaux, soit ${TERRITORY_POPULATION.toLocaleString("fr-FR")} habitants, dans un rayon de ${coverageRadiusKm()} kilomètres autour de Léognan (33850).`,
  title: `Zones desservies : les ${COMMUNES.length} communes`,
  description:
    `Léo Clean fait le ménage à domicile dans ${COMMUNES.length} communes du sud de Bordeaux, ` +
    `de Villenave-d'Ornon à Cabanac-et-Villagrains, au même tarif partout : ` +
    `à partir de ${formatHourlyRate(LOWEST_HOURLY_RATE_CENTS)}.`,
});

export const revalidate = 86_400;

export default function ZonesDesserviesPage() {
  const published = new Set(
    publishedCommunes().map(({ commune }) => commune.slug),
  );
  const intentions = publishedIntentionPages();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            organizationJsonLd(),
            breadcrumbJsonLd([
              { name: "Accueil", path: "/" },
              { name: "Zones desservies", path: "/zones-desservies" },
            ]),
          ]),
        }}
      />

      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-black tracking-tight text-balance sm:text-4xl">
          Les {COMMUNES.length} communes desservies
        </h1>
        <p className="mt-5 max-w-prose text-lg text-pretty text-muted-foreground">
          Léo Clean intervient dans un rayon de {coverageRadiusKm()} kilomètres
          autour de Léognan, au sud de Bordeaux : {MONTESQUIEU_COMMUNES.length}{" "}
          communes de la Communauté de communes de Montesquieu, plus Gradignan,
          Villenave-d&apos;Ornon et Cestas. Cela représente{" "}
          {TERRITORY_POPULATION.toLocaleString("fr-FR")} habitants, et le tarif
          y est le même partout.
        </p>

        <CommuneStart className="mt-10" />

        {/* Le tableau porte ce que quelqu'un veut savoir avant de cliquer :
            son code postal, la distance, et si sa commune a une page. */}
        <div className="mt-12 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Communes desservies par Léo Clean, par population décroissante
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-3 pr-4 font-medium">
                  Commune
                </th>
                <th scope="col" className="py-3 pr-4 font-medium">
                  Code postal
                </th>
                <th scope="col" className="py-3 font-medium">
                  Habitants
                </th>
              </tr>
            </thead>
            <tbody>
              {COMMUNES_BY_POPULATION.map((commune) => (
                <tr key={commune.slug} className="border-b border-border/60">
                  <th scope="row" className="py-3 pr-4 font-normal">
                    {published.has(commune.slug) ? (
                      <Link
                        href={`/menage-a-domicile/${commune.slug}`}
                        className="font-medium text-brand hover:underline"
                      >
                        Ménage à domicile à {commune.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{commune.name}</span>
                    )}
                    {commune.isHeadquarters ? (
                      <span className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPinIcon className="size-3.5" aria-hidden />
                        Notre commune siège
                      </span>
                    ) : null}
                  </th>
                  <td className="py-3 pr-4 tabular-nums">
                    {commune.postalCode}
                  </td>
                  <td className="py-3 tabular-nums">
                    {commune.population.toLocaleString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-14 text-2xl font-black tracking-tight">
          Autres prestations, par commune
        </h2>
        <p className="mt-3 max-w-prose text-pretty text-muted-foreground">
          Le repassage et l&apos;emploi d&apos;une femme de ménage ne posent pas
          les mêmes questions que l&apos;entretien courant. Ces pages y
          répondent, là où l&apos;intention a quelque chose de particulier à
          dire.
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {intentions.map(({ intention, commune }) => (
            <li key={`${intention.slug}-${commune.slug}`}>
              <Link
                href={`/${intention.slug}/${commune.slug}`}
                className="text-brand hover:underline"
              >
                {intention.slug === "repassage"
                  ? `Repassage à ${commune.name}`
                  : `Femme de ménage à ${commune.name}`}
              </Link>
            </li>
          ))}
        </ul>

        <h2 className="mt-14 text-2xl font-black tracking-tight">
          Pourquoi cette zone et pas une autre
        </h2>
        <p className="mt-3 max-w-prose text-pretty text-muted-foreground">
          Léo Clean s&apos;interdit d&apos;intervenir au-delà d&apos;une
          vingtaine de minutes de route de Léognan. Cette contrainte garde les
          trajets courts entre deux interventions, et c&apos;est elle qui rend
          possible d&apos;affecter durablement le même intervenant à un même
          client, plutôt que de recomposer un planning chaque semaine. Étendre
          la zone reviendrait à renoncer à la promesse qui fait le service.
        </p>
        <ListeAttente sourcePath="/zones-desservies" className="mt-14" />
      </main>

      <SiteFooter />
    </>
  );
}
