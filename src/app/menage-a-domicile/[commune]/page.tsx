import { CheckIcon, ClockIcon, MapPinIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/site-footer";
import { ContactChannels } from "@/components/contact-channels";
import { LeadForm } from "@/components/lead-form";
import { SiteHeader } from "@/components/site-header";
import { StickyBookingCta } from "@/components/sticky-booking-cta";
import { Badge } from "@/components/ui/badge";
import { clientEnv } from "@/lib/env";
import { fillTemplate, publishedIntentionPages } from "@/lib/intentions";
import {
  PUBLISHED_COMMUNE_SLUGS,
  directAnswers,
  getPublishedCommune,
} from "@/lib/communes-content";
import { formatEuros, formatHourlyRate } from "@/lib/pricing";
import {
  MINIMUM_BILLABLE_MINUTES,
  PUBLIC_RATES,
  STANDARD_SQM_PER_HOUR,
  TAX_CREDIT_RATE_BP,
} from "@/lib/pricing/public-grid";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  serviceJsonLd,
} from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { COMMUNES, nearestCommunes } from "@/lib/territory";

/**
 * Page locale « ménage à domicile à <commune> ».
 *
 * Rendue statiquement : le contenu ne dépend d'aucune session et l'acquisition
 * passe par le référencement, ce qui fait de la vitesse une contrainte produit.
 *
 * Chaque page dit des choses que les autres ne disent pas — temps de trajet
 * mesuré, typologie d'habitat, questions propres à la commune. C'est la
 * condition pour ne pas être traitée en page satellite.
 */

export function generateStaticParams() {
  return PUBLISHED_COMMUNE_SLUGS.map((commune) => ({ commune }));
}

/** Le contenu ne change qu'au rythme des tarifs et des avis. */
export const revalidate = 86_400;
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: PageProps<"/menage-a-domicile/[commune]">): Promise<Metadata> {
  const { commune: slug } = await params;
  const published = getPublishedCommune(slug);

  if (!published) {
    return {};
  }

  const { commune, content } = published;
  const path = `/menage-a-domicile/${commune.slug}`;

  return pageMetadata({
    path,
    title: `Ménage à domicile à ${commune.name} (${commune.postalCode})`,
    description:
      `Léo Clean fait le ménage à domicile à ${commune.name} à partir de ` +
      `${formatHourlyRate(PUBLIC_RATES[0]!.hourlyRateCents)}, avec un intervenant attitré ` +
      `qui habite le secteur. ${content.driveMinutesFromLeognan > 0 ? `À ${content.driveMinutesFromLeognan} minutes de notre siège de Léognan.` : "Notre commune siège."}`,
    summary:
      `Léo Clean fait le ménage à domicile à ${commune.name} (${commune.postalCode}) ` +
      `à partir de ${formatHourlyRate(PUBLIC_RATES[0]!.hourlyRateCents)}, minimum ` +
      `${MINIMUM_BILLABLE_MINUTES / 60} heures` +
      `${content.driveMinutesFromLeognan > 0 ? `, à ${content.driveMinutesFromLeognan} minutes de son siège de Léognan` : ", sa commune siège"}.`,
    openGraphTitle: `Ménage à domicile à ${commune.name}`,
    openGraphDescription: content.intro,
    // La carte est celle de la commune : voir `opengraph-image.tsx` à côté.
    hasOwnOpenGraphImage: true,
  });
}

export default async function CommunePage({
  params,
}: PageProps<"/menage-a-domicile/[commune]">) {
  const { commune: slug } = await params;
  const published = getPublishedCommune(slug);

  if (!published) {
    notFound();
  }

  const { commune, content } = published;
  const path = `/menage-a-domicile/${commune.slug}`;
  /**
   * Maillage latéral : les trois communes les plus proches, pas les quinze
   * autres.
   *
   * Lier chaque page locale à toutes les autres répartit l'autorité en parts
   * égales et n'aide personne : quelqu'un qui lit la page de Martillac ne
   * cherche pas Villenave-d'Ornon. Le reste du territoire reste atteignable
   * par la page `/zones-desservies`, qui est la cible du maillage exhaustif.
   */
  const neighbours = nearestCommunes(commune, 3)
    .map((entry) => getPublishedCommune(entry.slug))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
  const siblingIntentions = publishedIntentionPages().filter(
    (entry) => entry.commune.slug === commune.slug,
  );

  const showTaxCredit = clientEnv.NEXT_PUBLIC_SAP_DECLARED;
  /* Les mêmes trois réponses alimentent le bloc de tête et le `FAQPage` :
     un balisage qui annoncerait autre chose que la page est une divergence
     que Google sanctionne. */
  const answers = directAnswers(commune, content);

  const structuredData = [
    organizationJsonLd(),
    serviceJsonLd(
      `Ménage à domicile à ${commune.name}`,
      content.intro,
      PUBLIC_RATES.map((rate) => ({
        name: rate.label,
        description: rate.description,
        hourlyRateCents: rate.hourlyRateCents,
        unitLabel: "heure",
      })),
      path,
    ),
    breadcrumbJsonLd([
      { name: "Accueil", path: "/" },
      { name: "Ménage à domicile", path: "/menage-a-domicile" },
      { name: commune.name, path },
    ]),
    faqJsonLd(answers),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />

      <SiteHeader />

      <main className="flex flex-1 flex-col">
        <nav
          aria-label="Fil d'Ariane"
          className="mx-auto w-full max-w-4xl px-6 pt-6"
        >
          <ol className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="hover:text-brand">
                Accueil
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/menage-a-domicile" className="hover:text-brand">
                Ménage à domicile
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-foreground">
              {commune.name}
            </li>
          </ol>
        </nav>

        <section className="mx-auto w-full max-w-4xl px-6 py-10">
          <Badge variant="secondary" className="mb-5 gap-1.5">
            <MapPinIcon className="size-3.5" aria-hidden />
            {commune.name} · {commune.postalCode} · Gironde
          </Badge>

          <h1 className="text-3xl leading-tight font-black tracking-tight text-balance sm:text-4xl">
            Ménage à domicile à {commune.name}
          </h1>

          <p className="mt-5 max-w-prose text-lg text-pretty text-muted-foreground">
            {content.intro}
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="text-xs text-muted-foreground">À partir de</dt>
              <dd className="mt-1 text-xl font-extrabold">
                {formatHourlyRate(PUBLIC_RATES[0]!.hourlyRateCents)}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="text-xs text-muted-foreground">Habitants</dt>
              <dd className="mt-1 text-xl font-extrabold tabular-nums">
                {commune.population.toLocaleString("fr-FR")}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="text-xs text-muted-foreground">
                {commune.isHeadquarters ? "Notre siège" : "Depuis Léognan"}
              </dt>
              <dd className="mt-1 text-xl font-extrabold">
                {commune.isHeadquarters
                  ? commune.name
                  : `${content.driveMinutesFromLeognan} min`}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="text-xs text-muted-foreground">Durée minimale</dt>
              <dd className="mt-1 text-xl font-extrabold">
                {MINIMUM_BILLABLE_MINUTES / 60} h
              </dd>
            </div>
          </dl>
        </section>

        <StickyBookingCta communeSlug={commune.slug} />

        {/* Bloc de réponses directes, en tête de contenu.
            Chaque réponse est autosuffisante — entité, chiffre et lieu dans la
            même phrase — de sorte qu'elle reste vraie citée hors de sa page.
            C'est ce que reprennent les modèles de langage, et le placer après
            trois sections revenait à le leur cacher. */}
        <section className="mx-auto w-full max-w-4xl px-6 pb-12">
          <h2 className="text-2xl font-black tracking-tight">
            Questions fréquentes à {commune.name}
          </h2>

          <div className="mt-6 space-y-6">
            {answers.map((entry) => (
              <div key={entry.question}>
                {/* Question en h3, réponse en paragraphe : le couple le plus
                    fiablement extrait par les modèles de langage. */}
                <h3 className="text-lg font-extrabold">{entry.question}</h3>
                <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
                  {entry.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-6 pb-12">
          <h2 className="text-2xl font-black tracking-tight">
            Les logements de {commune.name}
          </h2>
          <p className="mt-3 max-w-prose text-pretty text-muted-foreground">
            {content.housing}
          </p>

          <ul className="mt-6 space-y-2">
            {content.landmarks.map((landmark) => (
              <li key={landmark} className="flex items-baseline gap-2">
                <CheckIcon
                  className="size-4 shrink-0 translate-y-0.5 text-brand"
                  aria-hidden
                />
                <span>Nous intervenons dans {landmark}.</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-y border-border bg-secondary/30">
          <div className="mx-auto w-full max-w-4xl px-6 py-12">
            <h2 className="text-2xl font-black tracking-tight">
              Tarifs du ménage à {commune.name}
            </h2>
            <p className="mt-2 text-muted-foreground">
              Prix TTC, identiques dans les {COMMUNES.length} communes du
              territoire. Minimum {MINIMUM_BILLABLE_MINUTES / 60} heures par
              intervention.
            </p>

            {/* Tableau sémantique : c'est le format le plus fiablement repris
                par les moteurs et les modèles de langage. */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Tarifs horaires du ménage à domicile à {commune.name}
                </caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-3 pr-4 font-medium">
                      Formule
                    </th>
                    <th scope="col" className="py-3 pr-4 font-medium">
                      Tarif horaire
                    </th>
                    {showTaxCredit ? (
                      <th scope="col" className="py-3 font-medium">
                        Après crédit d&apos;impôt
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {PUBLIC_RATES.map((rate) => (
                    <tr key={rate.key} className="border-b border-border/60">
                      <th scope="row" className="py-4 pr-4 font-normal">
                        <span className="font-medium">{rate.label}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {rate.description}
                        </span>
                      </th>
                      <td className="py-4 pr-4 text-lg font-extrabold whitespace-nowrap">
                        {formatHourlyRate(rate.hourlyRateCents)}
                      </td>
                      {showTaxCredit ? (
                        <td className="py-4 text-lg font-extrabold whitespace-nowrap text-brand">
                          {formatHourlyRate(
                            Math.round(
                              (rate.hourlyRateCents *
                                (10_000 - TAX_CREDIT_RATE_BP)) /
                                10_000,
                            ),
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Un logement de 80 m² demande environ 3 h 30 d&apos;entretien, soit{" "}
              {formatEuros(
                Math.round((PUBLIC_RATES[0]!.hourlyRateCents * 210) / 60),
              )}{" "}
              en formule régulière. Nous estimons {STANDARD_SQM_PER_HOUR} m²
              traités par heure.
            </p>
          </div>
        </section>

        <section className="border-t border-border bg-teal-50">
          <div className="mx-auto w-full max-w-4xl px-6 py-12 text-center">
            <h2 className="text-2xl font-black tracking-tight">
              Un ménage à {commune.name} ?
            </h2>
            <p className="mx-auto mt-3 max-w-prose text-muted-foreground">
              Réservez en ligne en choisissant votre créneau, ou appelez-nous :
              c&apos;est nous qui répondons. Pas de standard, pas de message
              resté sans réponse.
            </p>

            {/* La commune voyage avec le lien : sans elle, le tunnel
                s'ouvrait sur un champ vide et il fallait retaper la ville dont
                on venait de lire la page entière. */}
            <Link
              href={`/reserver?commune=${commune.slug}`}
              /* Tant que ce bouton est à l'écran, la barre collante s'efface :
                 deux appels à l'action concurrents demanderaient de choisir
                 lequel compte. */
              data-booking-cta
              className="mt-6 inline-flex min-h-12 items-center rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-mango-500 hover:shadow-mango"
            >
              Voir les créneaux à {commune.name}
            </Link>

            <ContactChannels communeName={commune.name} className="mt-6" />

            <div className="mx-auto mt-10 max-w-xl text-left">
              <p className="mb-5 text-center text-sm text-muted-foreground">
                Ou laissez-nous votre numéro, nous vous rappelons.
              </p>
              <LeadForm defaultCommuneInsee={commune.insee} sourcePath={path} />
            </div>

            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <ClockIcon className="size-4" aria-hidden />
              Du lundi au vendredi de 8 h à 19 h, le samedi de 9 h à 13 h
            </p>
          </div>
        </section>

        {siblingIntentions.length > 0 ? (
          <section className="mx-auto w-full max-w-4xl px-6 pt-12">
            <h2 className="text-xl font-extrabold tracking-tight">
              Autres prestations à {commune.name}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {siblingIntentions.map(({ intention }) => (
                <li key={intention.slug}>
                  <Link
                    href={`/${intention.slug}/${commune.slug}`}
                    className="text-brand hover:underline"
                  >
                    {fillTemplate(intention.titleTemplate, commune.name)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mx-auto w-full max-w-4xl px-6 py-12">
          <h2 className="text-xl font-extrabold tracking-tight">
            Autour de {commune.name}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {neighbours.map(({ commune: other, content: otherContent }) => (
              <li key={other.slug}>
                <Link
                  href={`/menage-a-domicile/${other.slug}`}
                  className="text-brand hover:underline"
                >
                  Ménage à {other.name}
                </Link>
                <span className="text-sm text-muted-foreground">
                  {" "}
                  ·{" "}
                  {other.isHeadquarters
                    ? "notre commune siège"
                    : `${otherContent.driveMinutesFromLeognan} min de Léognan`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            <Link href="/zones-desservies" className="text-brand underline">
              Voir les {COMMUNES.length} communes desservies
            </Link>
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
