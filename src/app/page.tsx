import { CheckIcon, MapPinIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { ContactChannels } from "@/components/contact-channels";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { publishedCommunes } from "@/lib/communes-content";
import { formatHourlyRate } from "@/lib/pricing";
import {
  MINIMUM_BILLABLE_MINUTES,
  PUBLIC_RATES,
} from "@/lib/pricing/public-grid";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { SITE } from "@/lib/site";
import {
  COMMUNES,
  COMMUNES_BY_POPULATION,
  TERRITORY_POPULATION,
} from "@/lib/territory";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export const revalidate = 86_400;

/** Ce qui distingue LéoClean d'une plateforme nationale. */
const PROMISES = [
  {
    title: "Le même intervenant, chaque semaine",
    body: "Sur une formule régulière, vous retrouvez la même personne à chaque passage. Elle finit par connaître votre logement, vos habitudes et votre chien.",
  },
  {
    title: "Des gens qui habitent à côté",
    body: "Nos intervenants vivent dans les communes où ils travaillent. Quinze minutes de route, pas quarante : c'est ce qui rend possible de tenir un créneau.",
  },
  {
    title: "Un vrai numéro, une vraie personne",
    body: "Vous appelez, quelqu'un décroche. Pas de standard, pas de formulaire resté sans réponse.",
  },
  {
    title: "Des professionnels vérifiés",
    body: "SIRET actif, attestation d'assurance responsabilité civile professionnelle, pièce d'identité et RIB contrôlés avant la première intervention.",
  },
];

export default function Home() {
  const published = publishedCommunes();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            organizationJsonLd(),
            breadcrumbJsonLd([{ name: "Accueil", path: "/" }]),
          ]),
        }}
      />

      <SiteHeader />

      <main className="flex flex-1 flex-col">
        <section className="border-b border-border bg-secondary/40">
          <div className="mx-auto w-full max-w-4xl px-6 py-16 sm:py-24">
            <Badge variant="secondary" className="mb-6 gap-1.5">
              <MapPinIcon className="size-3.5" aria-hidden />
              {COMMUNES.length} communes au sud de Bordeaux
            </Badge>

            <h1 className="font-heading text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
              Le ménage à domicile, par des personnes qui habitent à côté de
              chez vous.
            </h1>

            <p className="mt-6 max-w-prose text-lg text-pretty text-muted-foreground">
              {SITE.description}
            </p>

            <ContactChannels className="mt-8 [&>div]:sm:justify-start" />

            <p className="mt-6">
              <Link href="/tarifs" className="text-primary underline">
                Voir le détail des tarifs
              </Link>
            </p>

            <p className="mt-4 text-sm text-muted-foreground">
              À partir de {formatHourlyRate(PUBLIC_RATES[0]!.hourlyRateCents)},
              minimum {MINIMUM_BILLABLE_MINUTES / 60} heures. Du lundi au
              vendredi de 8 h à 19 h, le samedi de 9 h à 13 h.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-6 py-16">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Pourquoi LéoClean plutôt qu&apos;une plateforme nationale
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {PROMISES.map((promise) => (
              <div key={promise.title}>
                <h3 className="flex items-baseline gap-2 font-heading text-lg font-semibold">
                  <CheckIcon
                    className="size-4 shrink-0 translate-y-0.5 text-primary"
                    aria-hidden
                  />
                  {promise.title}
                </h3>
                <p className="mt-2 text-pretty text-muted-foreground">
                  {promise.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-secondary/30">
          <div className="mx-auto w-full max-w-4xl px-6 py-16">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              Où nous intervenons
            </h2>
            <p className="mt-2 max-w-prose text-muted-foreground">
              {COMMUNES.length} communes du sud de Bordeaux, soit{" "}
              {TERRITORY_POPULATION.toLocaleString("fr-FR")} habitants. Nous ne
              dépassons pas une vingtaine de minutes de route depuis Léognan :
              c&apos;est cette limite qui nous permet de vous envoyer toujours
              la même personne.
            </p>

            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {published.map(({ commune, content }) => (
                <li key={commune.slug}>
                  <Link
                    href={`/menage-a-domicile/${commune.slug}`}
                    className="flex items-baseline justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary"
                  >
                    <span className="font-medium">Ménage à {commune.name}</span>
                    <span className="text-sm whitespace-nowrap text-muted-foreground">
                      {commune.isHeadquarters
                        ? "siège"
                        : `${content.driveMinutesFromLeognan} min`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-sm text-muted-foreground">
              Également desservies :{" "}
              {COMMUNES_BY_POPULATION.filter(
                (commune) =>
                  !published.some(
                    (entry) => entry.commune.slug === commune.slug,
                  ),
              )
                .map((commune) => commune.name)
                .join(", ")}
              .
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
