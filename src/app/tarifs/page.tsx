import type { Metadata } from "next";

import { CommuneStart } from "@/components/commune-start";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  afterTaxCreditCents,
  canShowTaxCredit,
  creditImpotConditions,
} from "@/lib/fiscal";
import {
  formatDuration,
  formatEuros,
  formatHourlyRate,
  estimateDuration,
} from "@/lib/pricing";
import {
  COURT_DELAI_HEURES,
  MINIMUM_BILLABLE_MINUTES,
  PUBLIC_RATES,
  PUBLIC_SURCHARGES,
  TARIF_PONCTUEL,
  TARIF_PONCTUEL_HEURE,
  TARIF_REGULIER,
  TARIF_REGULIER_HEURE,
  totalRegulier,
  STANDARD_SQM_PER_HOUR,
  STANDARD_SQM_PER_HOUR_AFFICHE,
} from "@/lib/pricing/public-grid";
import { CANCELLATION_TIERS } from "@/lib/pricing/cancellation";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  serviceJsonLd,
} from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { COMMUNES } from "@/lib/territory";

export const metadata: Metadata = pageMetadata({
  path: "/tarifs",
  summary: `Le ménage à domicile Léo Clean coûte ${formatHourlyRate(PUBLIC_RATES[0]!.hourlyRateCents)} en formule régulière et ${formatHourlyRate(PUBLIC_RATES[1]!.hourlyRateCents)} en intervention ponctuelle, minimum ${MINIMUM_BILLABLE_MINUTES / 60} heures, au même tarif dans les ${COMMUNES.length} communes du sud de Bordeaux.`,
  title: "Tarifs du ménage à domicile",
  description: `Ménage à domicile à partir de ${TARIF_REGULIER_HEURE} en formule régulière, ${TARIF_PONCTUEL_HEURE} en ponctuel. Minimum ${MINIMUM_BILLABLE_MINUTES / 60} heures. Tarifs identiques dans les ${COMMUNES.length} communes desservies au sud de Bordeaux.`,
});

export const revalidate = 86_400;

/** Surfaces de référence, celles que les gens reconnaissent. */
const EXAMPLES = [
  { label: "Studio ou T2", surfaceSqm: 40 },
  { label: "T3 ou petite maison", surfaceSqm: 70 },
  { label: "Maison familiale", surfaceSqm: 100 },
  { label: "Grande maison", surfaceSqm: 140 },
];

/*
 * L'exemple de la FAQ était écrit à la main — « 80 m² demande environ 3 h 30 » —
 * et le relèvement du rendement l'a rendu faux d'un coup : le tunnel en chiffre
 * désormais 2 h 30. Un exemple recopié est un exemple qui finit par contredire
 * ce qu'on facture, exactement comme un tarif recopié.
 */
const MINUTES_80 = estimateDuration({
  surfaceSqm: 80,
  service: {
    sqmPerHour: STANDARD_SQM_PER_HOUR,
    minDurationMinutes: MINIMUM_BILLABLE_MINUTES,
  },
}).durationMinutes;
const DUREE_80 = formatDuration(MINUTES_80);

const FAQ = [
  {
    question: "Combien coûte une femme de ménage à Léognan ?",
    answer: `Chez Léo Clean, le ménage à domicile coûte ${TARIF_REGULIER} de l'heure en formule régulière et ${TARIF_PONCTUEL} de l'heure pour une intervention ponctuelle, avec un minimum de deux heures. Un logement de 80 m² demande environ ${DUREE_80} , soit ${totalRegulier(MINUTES_80 / 60)} en formule régulière.`,
  },
  {
    question: "Y a-t-il des frais d'abonnement ou de dossier ?",
    answer:
      "Non. Léo Clean ne facture ni frais d'inscription, ni abonnement, ni frais de gestion mensuels. Vous ne payez que les heures réalisées.",
  },
  {
    question: "Le tarif est-il le même dans toutes les communes ?",
    answer:
      "Oui. Le tarif horaire est identique dans les seize communes desservies, quelle que soit la distance depuis Léognan.",
  },
  {
    question: "Que se passe-t-il si j'annule ?",
    answer:
      "L'annulation est gratuite jusqu'à 24 heures avant l'intervention. En deçà, des frais s'appliquent selon un barème plafonné, de 5 € entre 8 et 24 heures à 30 € en cas d'annulation moins de deux heures avant.",
  },
];

export default function TarifsPage() {
  // La frontière fiscale est tranchée dans `lib/fiscal.ts` et nulle part
  // ailleurs : cette page lisait directement la variable d'environnement, ce
  // qui faisait deux endroits où répondre à « avons-nous le droit de
  // l'afficher ». Deux endroits finissent toujours par se contredire.
  const showTaxCredit = canShowTaxCredit();
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
              "Entretien régulier ou ponctuel du logement, dans 16 communes du sud de Bordeaux.",
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
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
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
              Tarifs horaires du ménage à domicile Léo Clean
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
                        afterTaxCreditCents(rate.hourlyRateCents),
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cible de l'astérisque posé par `<PrixAvecCreditImpot />`. Le bloc
            n'existe que déclaration obtenue : détailler des conditions
            d'éligibilité avant d'y avoir droit reviendrait à annoncer
            l'avantage par la bande. */}
        {showTaxCredit ? (
          <p
            id="credit-impot"
            className="mt-6 max-w-prose text-sm text-muted-foreground"
          >
            {creditImpotConditions()}
          </p>
        ) : null}

        <h2 className="mt-14 text-2xl font-black tracking-tight">
          Combien de temps pour mon logement ?
        </h2>
        <p className="mt-2 text-muted-foreground">
          Nous estimons {STANDARD_SQM_PER_HOUR_AFFICHE} m² traités par heure
          pour un entretien courant. La durée proposée reste ajustable.
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

        <h2 className="mt-14 text-2xl font-black tracking-tight">
          Week-end, jours fériés et dernière minute
        </h2>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Trois situations coûtent plus cher, et vous les voyez avant de
          réserver — jamais au récapitulatif.
        </p>
        <ul className="mt-4 space-y-2 text-muted-foreground">
          {PUBLIC_SURCHARGES.map((majoration) => (
            <li key={majoration.cause} className="flex flex-wrap gap-x-3">
              <span className="font-mono font-semibold text-foreground">
                {majoration.display}
              </span>
              <span>
                {majoration.cause === "COURT_DELAI"
                  ? `Réservation à moins de ${COURT_DELAI_HEURES} heures`
                  : majoration.label}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-prose text-sm text-muted-foreground">
          Les deux premières reviennent intégralement à votre intervenant :
          c&apos;est lui qui travaille le week-end. La troisième couvre le coût
          de placer une mission dans une tournée déjà arrêtée.
        </p>

        <h2 className="mt-14 text-2xl font-black tracking-tight">Annulation</h2>
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

        <h2 className="mt-14 text-2xl font-black tracking-tight">
          Questions fréquentes
        </h2>
        <div className="mt-6 space-y-6">
          {FAQ.map((entry) => (
            <div key={entry.question}>
              <h3 className="text-lg font-extrabold">{entry.question}</h3>
              <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
                {entry.answer}
              </p>
            </div>
          ))}
        </div>

        {/* La page qui répond à « combien ça coûte » n'ouvrait sur rien : on
            y lisait un prix sans pouvoir en faire quoi que ce soit. */}
        <CommuneStart className="mt-14" />
      </main>

      <SiteFooter />
    </>
  );
}
