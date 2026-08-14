import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { clientEnv } from "@/lib/env";
import { formatDuration, formatEuros, formatHourlyRate } from "@/lib/pricing";
import { estimateDuration } from "@/lib/pricing";
import {
  MINIMUM_BILLABLE_MINUTES,
  PUBLIC_RATES,
  STANDARD_SQM_PER_HOUR,
  TAX_CREDIT_RATE_BP,
} from "@/lib/pricing/public-grid";
import { CANCELLATION_TIERS } from "@/lib/pricing/cancellation";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  serviceJsonLd,
} from "@/lib/seo/json-ld";
import { COMMUNES } from "@/lib/territory";

export const metadata: Metadata = {
  title: "Tarifs du ménage à domicile",
  description:
    "Ménage à domicile à partir de 29 €/h en formule régulière, 33 €/h en ponctuel. Minimum 2 heures. Tarifs identiques dans les 13 communes de la Communauté de communes de Montesquieu.",
  alternates: { canonical: "/tarifs" },
};

export const revalidate = 86_400;

/** Surfaces de référence, celles que les gens reconnaissent. */
const EXAMPLES = [
  { label: "Studio ou T2", surfaceSqm: 40 },
  { label: "T3 ou petite maison", surfaceSqm: 70 },
  { label: "Maison familiale", surfaceSqm: 100 },
  { label: "Grande maison", surfaceSqm: 140 },
];

const FAQ = [
  {
    question: "Combien coûte une femme de ménage à Léognan ?",
    answer:
      "Chez LéoClean, le ménage à domicile coûte 29 € de l'heure en formule régulière et 33 € de l'heure pour une intervention ponctuelle, avec un minimum de deux heures. Un logement de 80 m² demande environ 3 h 30, soit 101,50 € en formule régulière.",
  },
  {
    question: "Y a-t-il des frais d'abonnement ou de dossier ?",
    answer:
      "Non. LéoClean ne facture ni frais d'inscription, ni abonnement, ni frais de gestion mensuels. Vous ne payez que les heures réalisées.",
  },
  {
    question: "Le tarif est-il le même dans toutes les communes ?",
    answer:
      "Oui. Le tarif horaire est identique dans les treize communes de la Communauté de communes de Montesquieu, quelle que soit la distance depuis Léognan.",
  },
  {
    question: "Que se passe-t-il si j'annule ?",
    answer:
      "L'annulation est gratuite jusqu'à 24 heures avant l'intervention. En deçà, des frais s'appliquent selon un barème plafonné, de 5 € entre 8 et 24 heures à 30 € en cas d'annulation moins de deux heures avant.",
  },
];

export default function TarifsPage() {
  const showTaxCredit = clientEnv.NEXT_PUBLIC_SAP_DECLARED;
  const service = {
    sqmPerHour: STANDARD_SQM_PER_HOUR,
    minDurationMinutes: MINIMUM_BILLABLE_MINUTES,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            organizationJsonLd(),
            serviceJsonLd(
              "Ménage à domicile",
              "Entretien régulier ou ponctuel du logement, dans les 13 communes de la Communauté de communes de Montesquieu.",
              PUBLIC_RATES.map((rate) => ({
                name: rate.label,
                description: rate.description,
                hourlyRateCents: rate.hourlyRateCents,
                unitLabel: "heure",
              })),
              "/tarifs",
            ),
            breadcrumbJsonLd([
              { name: "Accueil", path: "/" },
              { name: "Tarifs", path: "/tarifs" },
            ]),
            faqJsonLd(FAQ),
          ]),
        }}
      />

      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Tarifs
        </h1>
        <p className="mt-5 max-w-prose text-lg text-pretty text-muted-foreground">
          Un seul tarif horaire, le même dans les {COMMUNES.length} communes.
          Pas de frais d&apos;inscription, pas d&apos;abonnement, pas de frais
          de gestion. Vous ne payez que les heures réalisées.
        </p>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Tarifs horaires du ménage à domicile LéoClean
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
                  <td className="py-4 pr-4 font-heading text-lg font-semibold whitespace-nowrap">
                    {formatHourlyRate(rate.hourlyRateCents)}
                  </td>
                  {showTaxCredit ? (
                    <td className="py-4 font-heading text-lg font-semibold whitespace-nowrap text-primary">
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

        <h2 className="mt-14 font-heading text-2xl font-semibold tracking-tight">
          Combien de temps pour mon logement ?
        </h2>
        <p className="mt-2 text-muted-foreground">
          Nous estimons {STANDARD_SQM_PER_HOUR} m² traités par heure pour un
          entretien courant. La durée proposée reste ajustable.
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Durée et prix estimés selon la surface du logement
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-3 pr-4 font-medium">
                  Logement
                </th>
                <th scope="col" className="py-3 pr-4 font-medium">
                  Surface
                </th>
                <th scope="col" className="py-3 pr-4 font-medium">
                  Durée
                </th>
                <th scope="col" className="py-3 font-medium">
                  Prix régulier
                </th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLES.map((example) => {
                const { durationMinutes } = estimateDuration({
                  surfaceSqm: example.surfaceSqm,
                  service,
                });
                const amount = Math.round(
                  (PUBLIC_RATES[0]!.hourlyRateCents * durationMinutes) / 60,
                );
                return (
                  <tr key={example.label} className="border-b border-border/60">
                    <th scope="row" className="py-3 pr-4 font-normal">
                      {example.label}
                    </th>
                    <td className="py-3 pr-4 tabular-nums">
                      {example.surfaceSqm} m²
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {formatDuration(durationMinutes)}
                    </td>
                    <td className="py-3 font-medium whitespace-nowrap">
                      {formatEuros(amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h2 className="mt-14 font-heading text-2xl font-semibold tracking-tight">
          Annulation
        </h2>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Gratuite jusqu&apos;à 24 heures avant l&apos;intervention. Au-delà,
          les frais sont plafonnés : ils ne dépassent jamais les montants
          ci-dessous, quelle que soit la taille de la prestation.
        </p>
        <ul className="mt-4 space-y-2 text-muted-foreground">
          {CANCELLATION_TIERS.map((tier) => (
            <li key={tier.label}>
              <span className="font-medium text-foreground">{tier.label}</span>
              {" — "}
              {tier.capCents === 0
                ? "aucun frais"
                : tier.rateBp === 0
                  ? formatEuros(tier.capCents)
                  : `${tier.rateBp / 100} % du montant, dans la limite de ${formatEuros(tier.capCents)}`}
            </li>
          ))}
        </ul>

        <h2 className="mt-14 font-heading text-2xl font-semibold tracking-tight">
          Questions fréquentes
        </h2>
        <div className="mt-6 space-y-6">
          {FAQ.map((entry) => (
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
      </main>

      <SiteFooter />
    </>
  );
}
