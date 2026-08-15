import Link from "next/link";

import { ContactChannels } from "@/components/contact-channels";
import { LeadForm } from "@/components/lead-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { getPublishedCommune } from "@/lib/communes-content";
import {
  type PublishedIntentionPage,
  fillTemplate,
  intentionPages,
} from "@/lib/intentions";
import { formatHourlyRate } from "@/lib/pricing";
import {
  MINIMUM_BILLABLE_MINUTES,
  PUBLIC_RATES,
} from "@/lib/pricing/public-grid";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  serviceJsonLd,
} from "@/lib/seo/json-ld";

/**
 * Gabarit des pages d'intention secondaire.
 *
 * Partagé par `/femme-de-menage/<commune>` et `/repassage/<commune>`. La mise
 * en page est commune ; ce qui distingue les deux familles — et, à
 * l'intérieur, chaque commune — vit dans `lib/intentions.ts`. Le paragraphe
 * local est placé immédiatement après le chapeau : c'est lui qui justifie
 * l'existence de la page, il ne peut pas être enterré en bas.
 */
export function IntentionPageView({ page }: { page: PublishedIntentionPage }) {
  const { intention, commune, local } = page;
  const path = `/${intention.slug}/${commune.slug}`;
  const title = fillTemplate(intention.titleTemplate, commune.name);
  const faq = [...local.faq, ...intention.sharedFaq];
  const siblings = intentionPages(intention.slug).filter(
    (entry) => entry.commune.slug !== commune.slug,
  );
  const communePage = getPublishedCommune(commune.slug);

  const structuredData = [
    organizationJsonLd(),
    serviceJsonLd(
      title,
      local.text,
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
      { name: commune.name, path: `/menage-a-domicile/${commune.slug}` },
      { name: title, path },
    ]),
    faqJsonLd(faq),
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
              <Link href="/" className="hover:text-primary">
                Accueil
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link
                href={`/menage-a-domicile/${commune.slug}`}
                className="hover:text-primary"
              >
                {commune.name}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-foreground">
              {title}
            </li>
          </ol>
        </nav>

        <section className="mx-auto w-full max-w-4xl px-6 py-10">
          <Badge variant="secondary" className="mb-5">
            {commune.name} · {commune.postalCode}
          </Badge>

          <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
            {title}
          </h1>

          <p className="mt-5 max-w-prose text-lg text-pretty text-muted-foreground">
            {intention.lede}
          </p>

          <p className="mt-6 max-w-prose rounded-xl border border-primary/20 bg-primary/5 p-5 text-pretty">
            {local.text}
          </p>
        </section>

        <section className="mx-auto w-full max-w-4xl space-y-10 px-6 pb-12">
          {intention.sections.map((section) => (
            <div key={section.heading}>
              <h2 className="font-heading text-2xl font-semibold tracking-tight">
                {section.heading}
              </h2>
              <div className="mt-3 space-y-4">
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="max-w-prose text-pretty text-muted-foreground"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="border-y border-border bg-secondary/30">
          <div className="mx-auto w-full max-w-4xl px-6 py-12">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              Tarifs à {commune.name}
            </h2>
            <p className="mt-2 text-muted-foreground">
              Prix TTC, identiques dans toutes les communes desservies. Minimum{" "}
              {MINIMUM_BILLABLE_MINUTES / 60} heures par intervention.
            </p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {PUBLIC_RATES.map((rate) => (
                <li
                  key={rate.key}
                  className="rounded-xl border border-border bg-card p-5"
                >
                  <p className="font-medium">{rate.label}</p>
                  <p className="mt-1 font-heading text-2xl font-semibold">
                    {formatHourlyRate(rate.hourlyRateCents)}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {rate.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-6 py-12">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Questions fréquentes
          </h2>
          <div className="mt-6 space-y-6">
            {faq.map((entry) => (
              <div key={entry.question}>
                <h3 className="font-heading text-lg font-semibold">
                  {entry.question}
                </h3>
                <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
                  {entry.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-primary/5">
          <div className="mx-auto w-full max-w-4xl px-6 py-12 text-center">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              Un ménage à {commune.name} ?
            </h2>
            <p className="mx-auto mt-3 max-w-prose text-muted-foreground">
              Choisissez votre créneau en ligne, ou appelez-nous : c&apos;est
              nous qui répondons.
            </p>

            {/* Ces pages n'ouvraient sur aucune réservation : elles renvoyaient
                au téléphone ou à un formulaire, alors que le tunnel répond
                mieux et plus vite à qui est déjà décidé. */}
            <Link
              href={`/reserver?commune=${commune.slug}`}
              className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-primary px-6 font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Voir les créneaux à {commune.name}
            </Link>

            <ContactChannels communeName={commune.name} className="mt-6" />

            <p className="mx-auto mt-8 max-w-prose text-sm text-muted-foreground">
              Ou laissez-nous votre numéro, nous vous rappelons.
            </p>

            <div className="mx-auto mt-10 max-w-xl text-left">
              <LeadForm defaultCommuneInsee={commune.insee} sourcePath={path} />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-6 py-12">
          {communePage ? (
            <p className="text-muted-foreground">
              Voir aussi{" "}
              <Link
                href={`/menage-a-domicile/${commune.slug}`}
                className="text-primary hover:underline"
              >
                le ménage à domicile à {commune.name}
              </Link>
              .
            </p>
          ) : null}

          {siblings.length > 0 ? (
            <>
              <h2 className="mt-8 font-heading text-xl font-semibold tracking-tight">
                Dans les autres communes
              </h2>
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {siblings.map(({ commune: other, intention: sibling }) => (
                  <li key={other.slug}>
                    <Link
                      href={`/${sibling.slug}/${other.slug}`}
                      className="text-primary hover:underline"
                    >
                      {fillTemplate(sibling.titleTemplate, other.name)}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
