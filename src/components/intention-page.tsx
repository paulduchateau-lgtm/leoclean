import Link from "next/link";

import { ContactChannels } from "@/components/contact-channels";
import { LeadForm } from "@/components/lead-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StickyBookingCta } from "@/components/sticky-booking-cta";
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
      // Le premier paragraphe pose le sujet : c'est celui qui se cite. Les
      // suivants développent, et une description de service qui les
      // embarquerait tous ne serait plus une description.
      local.paragraphs[0] ?? intention.lede,
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
              <Link href="/" className="hover:text-brand">
                Accueil
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link
                href={`/menage-a-domicile/${commune.slug}`}
                className="hover:text-brand"
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

          <h1 className="text-3xl leading-tight font-black tracking-tight text-balance sm:text-4xl">
            {title}
          </h1>

          <p className="mt-5 max-w-prose text-lg text-pretty text-muted-foreground">
            {intention.lede}
          </p>

          {/* La part propre à la commune, mise en évidence : c'est ce que
              cette page dit et qu'aucune autre ne dit. */}
          <div className="mt-6 max-w-prose space-y-4 rounded-lg border border-mint-200 bg-mint-50 p-5 text-pretty">
            {local.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>
        </section>

        <StickyBookingCta communeSlug={commune.slug} />

        <section className="mx-auto w-full max-w-4xl space-y-10 px-6 pb-12">
          {intention.sections.map((section) => (
            <div key={section.heading}>
              <h2 className="text-2xl font-black tracking-tight">
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
            <h2 className="text-2xl font-black tracking-tight">
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
                  className="rounded-lg border border-border bg-card p-5"
                >
                  <p className="font-medium">{rate.label}</p>
                  <p className="mt-1 text-2xl font-black">
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
          <h2 className="text-2xl font-black tracking-tight">
            Questions fréquentes
          </h2>
          <div className="mt-6 space-y-6">
            {faq.map((entry) => (
              <div key={entry.question}>
                <h3 className="text-lg font-extrabold">{entry.question}</h3>
                <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
                  {entry.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-mint-50">
          <div className="mx-auto w-full max-w-4xl px-6 py-12 text-center">
            <h2 className="text-2xl font-black tracking-tight">
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
              /* Tant que ce bouton est à l'écran, la barre collante s'efface :
                 deux appels à l'action concurrents demanderaient de choisir
                 lequel compte. */
              data-booking-cta
              className="mt-6 inline-flex min-h-12 items-center rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-mint-500 hover:shadow-mint"
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
                className="text-brand hover:underline"
              >
                le ménage à domicile à {commune.name}
              </Link>
              .
            </p>
          ) : null}

          {siblings.length > 0 ? (
            <>
              <h2 className="mt-8 text-xl font-extrabold tracking-tight">
                Dans les autres communes
              </h2>
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {siblings.map(({ commune: other, intention: sibling }) => (
                  <li key={other.slug}>
                    <Link
                      href={`/${sibling.slug}/${other.slug}`}
                      className="text-brand hover:underline"
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
