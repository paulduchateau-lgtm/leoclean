import { CheckIcon, MapPinIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CommuneStart } from "@/components/commune-start";
import { SiteFooter } from "@/components/site-footer";
import { ContactChannels } from "@/components/contact-channels";
import { SiteHeader } from "@/components/site-header";
import { StickyBookingCta } from "@/components/sticky-booking-cta";
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
import { pageMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";
import {
  COMMUNES,
  COMMUNES_BY_POPULATION,
  TERRITORY_POPULATION,
} from "@/lib/territory";

export const metadata: Metadata = pageMetadata({ path: "/" });

export const revalidate = 86_400;

/** Ce qui distingue Léo Clean d'une plateforme nationale. */
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
  const unpublished = COMMUNES_BY_POPULATION.filter(
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
            breadcrumbJsonLd([{ name: "Accueil", path: "/" }]),
          ]),
        }}
      />

      <SiteHeader />

      <main className="flex flex-1 flex-col">
        {/* Le fond menthe et ses taches colorées sont la signature du système :
            une pièce aérée, pas un bandeau. Elles se posent en absolu derrière
            le contenu, et `overflow-hidden` les empêche d'élargir la page. */}
        <section className="relative overflow-hidden border-b border-border-subtle bg-mint-50">
          <div
            className="blob top-[-160px] right-[-90px] size-[360px] bg-mint-200"
            aria-hidden
          />
          <div
            className="blob bottom-[-90px] left-[-60px] size-[230px] bg-lemon-200 opacity-70"
            aria-hidden
          />
          {/* La tache pêche passe derrière le titre : elle ne paraît qu'à
              partir du moment où la ligne de texte ne la traverse plus. */}
          <div
            className="blob top-[120px] left-[64%] hidden size-[150px] bg-peach-200 opacity-40 lg:block"
            aria-hidden
          />

          <div className="relative mx-auto w-full max-w-4xl px-6 py-10 sm:py-20">
            <Badge variant="secondary" className="mb-5 gap-1.5">
              <MapPinIcon className="size-3.5" aria-hidden />
              {COMMUNES.length} communes au sud de Bordeaux
            </Badge>

            {/* Un seul mot en Fraunces, en fin de phrase : c'est la respiration
                humaine qui empêche le rendu SaaS, et elle ne se répète pas. */}
            <h1 className="text-4xl leading-tight font-black tracking-tight text-balance sm:text-5xl">
              Le ménage à domicile, par des personnes qui habitent{" "}
              <span className="accent-word">à côté</span> de chez vous.
            </h1>

            {/* La réservation commence ici, pas trois écrans plus loin — et
                avant la description, qui sert le référencement plus qu'elle
                n'aide à décider. La repousser sous le bloc d'action est ce qui
                fait tenir la première étape dans un écran de 390 pixels. */}
            <CommuneStart className="mt-8" />

            <p className="mt-8 max-w-prose text-pretty text-muted-foreground">
              {SITE.description}
            </p>

            <p className="mt-6 text-sm text-muted-foreground">
              À partir de {formatHourlyRate(PUBLIC_RATES[0]!.hourlyRateCents)},
              minimum {MINIMUM_BILLABLE_MINUTES / 60} heures. Du lundi au
              vendredi de 8 h à 19 h, le samedi de 9 h à 13 h.{" "}
              <Link href="/tarifs" className="text-brand underline">
                Voir le détail des tarifs
              </Link>
              .
            </p>

            {/* Les trois canaux directs restent, en second rang : ils servent
                ceux qui ne réserveront pas seuls, pas ceux qui le feraient. */}
            <div className="mt-10 border-t border-border/60 pt-6">
              <p className="mb-4 text-sm text-muted-foreground">
                Vous préférez en parler à quelqu&apos;un ?
              </p>
              <ContactChannels className="[&>div]:sm:justify-start" />
            </div>
          </div>
        </section>

        <StickyBookingCta />

        <section className="mx-auto w-full max-w-4xl px-6 py-16">
          <h2 className="text-2xl font-black tracking-tight">
            Pourquoi Léo Clean plutôt qu&apos;une plateforme nationale
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {PROMISES.map((promise) => (
              <div key={promise.title}>
                <h3 className="flex items-baseline gap-2 text-lg font-extrabold">
                  <CheckIcon
                    className="size-4 shrink-0 translate-y-0.5 text-brand"
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

        <section className="border-y border-border-subtle bg-cream-50">
          <div className="mx-auto w-full max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-black tracking-tight">
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
                    className="flex items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-mint-400"
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

            {/* Les seize communes ont leur page : cette phrase n'a rien à
                annoncer aujourd'hui, et sans la garde elle s'affichait vide,
                réduite à « Également desservies : . ». Le bloc reste pour le
                jour où le territoire s'étendra — une commune desservie sans
                page dédiée doit être annoncée, pas passée sous silence. C'est
                la garde que porte déjà `/menage-a-domicile`. */}
            {unpublished.length > 0 && (
              <p className="mt-6 text-sm text-muted-foreground">
                Également desservies :{" "}
                {unpublished.map((commune) => commune.name).join(", ")}.
              </p>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
