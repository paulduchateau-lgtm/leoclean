import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { publishedCommunes } from "@/lib/communes-content";
import { formatHourlyRate } from "@/lib/pricing";
import { PUBLIC_RATES } from "@/lib/pricing/public-grid";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import {
  COMMUNES,
  MONTESQUIEU_COMMUNES,
  TERRITORY_POPULATION,
} from "@/lib/territory";

export const metadata: Metadata = {
  title: "Ménage à domicile au sud de Bordeaux",
  description:
    "Léo Clean fait le ménage à domicile dans 16 communes du sud de Bordeaux, de Villenave-d'Ornon à Saucats, à partir de 29 €/h.",
  alternates: { canonical: "/menage-a-domicile" },
};

export const revalidate = 86_400;

export default function CommunesHubPage() {
  const published = publishedCommunes();
  const upcoming = COMMUNES.filter(
    (commune) =>
      !published.some((entry) => entry.commune.slug === commune.slug),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            organizationJsonLd(),
            breadcrumbJsonLd([
              { name: "Accueil", path: "/" },
              { name: "Ménage à domicile", path: "/menage-a-domicile" },
            ]),
          ]),
        }}
      />

      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Ménage à domicile au sud de Bordeaux
        </h1>
        <p className="mt-5 max-w-prose text-lg text-pretty text-muted-foreground">
          Léo Clean intervient dans {COMMUNES.length} communes du sud de
          Bordeaux : les {MONTESQUIEU_COMMUNES.length} communes de la Communauté
          de communes de Montesquieu, ainsi que Gradignan,
          Villenave-d&apos;Ornon et Cestas. Soit{" "}
          {TERRITORY_POPULATION.toLocaleString("fr-FR")} habitants desservis, à
          partir de {formatHourlyRate(PUBLIC_RATES[0]!.hourlyRateCents)}.
        </p>

        <h2 className="mt-12 font-heading text-2xl font-semibold tracking-tight">
          Choisissez votre commune
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {published.map(({ commune, content }) => (
            <li key={commune.slug}>
              <Link
                href={`/menage-a-domicile/${commune.slug}`}
                className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary"
              >
                <span className="font-heading text-lg font-semibold">
                  Ménage à {commune.name}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {commune.postalCode} ·{" "}
                  {commune.population.toLocaleString("fr-FR")} habitants ·{" "}
                  {commune.isHeadquarters
                    ? "notre commune siège"
                    : `${content.driveMinutesFromLeognan} min de Léognan`}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Les seize communes ont leur page. Ce bloc reste pour le jour où le
            territoire s'étendra : une commune desservie sans page dédiée doit
            être annoncée, pas passée sous silence. */}
        {upcoming.length > 0 ? (
          <>
            <h2 className="mt-12 font-heading text-xl font-semibold tracking-tight">
              Également desservies
            </h2>
            <p className="mt-2 text-muted-foreground">
              Nous intervenons dans ces communes aux mêmes conditions. Leur page
              dédiée est en cours de rédaction — appelez-nous en attendant.
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-muted-foreground">
              {upcoming.map((commune) => (
                <li key={commune.slug}>
                  {commune.name} ({commune.postalCode})
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
