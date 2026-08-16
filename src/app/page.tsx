import { CheckIcon, MapPinIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ContactChannels } from "@/components/contact-channels";
import { Comparison } from "@/components/home/comparison";
import { Engagement } from "@/components/home/engagement";
import { KeyFigures } from "@/components/home/key-figures";
import { Prestations } from "@/components/home/prestations";
import { TrustStrip } from "@/components/home/trust-strip";
import { Zones } from "@/components/home/zones";
import { ResumeBookingBanner } from "@/components/resume-booking-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StickyBookingCta } from "@/components/sticky-booking-cta";
import { Badge } from "@/components/ui/badge";
import { clientEnv } from "@/lib/env";
import { FACTS } from "@/lib/facts";
import { FISCAL } from "@/lib/fiscal";
import { formatHourlyRate } from "@/lib/pricing";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";
import { COMMUNES } from "@/lib/territory";

export const metadata: Metadata = pageMetadata({
  path: "/",
  summary: `Léo Clean fait le ménage à domicile dans ${COMMUNES.length} communes du sud de Bordeaux, en Gironde, à partir de ${formatHourlyRate(FACTS.lowestHourlyRateCents)}, avec un intervenant attitré qui habite le secteur.`,
});

export const revalidate = 86_400;

/**
 * Ce que la limite de {@link FACTS.maxDriveMinutes} minutes change chez vous.
 *
 * Ces quatre arguments existaient déjà et ne sont pas réécrits : ils sont bons,
 * et le seul défaut de leur ancienne place était de venir avant qu'on ait dit
 * pourquoi. Ils suivent désormais la thèse dont ils sont la conséquence.
 */
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

/** Le déroulé, en trois temps. Ce sont les écrans réels du tunnel. */
const STEPS = [
  {
    number: "01",
    title: "Votre commune et votre logement",
    body: "Deux questions, pas de compte à créer. La surface suffit à estimer la durée.",
  },
  {
    number: "02",
    title: "Votre créneau, prix affiché",
    body: "Du lundi au vendredi de 8 h à 19 h, le samedi de 9 h à 13 h. Le prix est connu avant de confirmer.",
  },
  {
    number: "03",
    title: "Votre intervenant confirmé",
    body: "Nous choisissons la personne disponible la plus proche de chez vous, et nous vous la présentons.",
  },
];

export default function Home() {
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
        {/* Bloc 1 — la thèse.
            La page s'ouvrait sur « Où habitez-vous ? » et seize communes :
            un effort de sélection demandé à quelqu'un à qui on n'avait encore
            donné aucune raison de rester. Les seize liens sont maintenant en
            fin de page, où ils servent de preuve au lieu de servir de menu.

            Le fond menthe et ses taches colorées sont la signature du système :
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
            {/* Un parcours interrompu se retrouve ici, pas dans la mémoire de
                la personne : elle revient par l'accueil, et sans ce bandeau
                elle recommence de zéro. Posé avant le premier rendu, il ne
                décale rien. */}
            <ResumeBookingBanner />

            <Badge variant="secondary" className="mb-5 gap-1.5">
              <MapPinIcon className="size-3.5" aria-hidden />
              {FACTS.communeCount} communes au sud de Bordeaux
            </Badge>

            {/* Un seul mot en Fraunces, en fin de phrase : c'est la respiration
                humaine qui empêche le rendu SaaS, et elle ne se répète pas. */}
            <h1 className="text-4xl leading-tight font-black tracking-tight text-balance sm:text-5xl">
              Le ménage à domicile, par des personnes qui habitent{" "}
              <span className="accent-word">à côté</span> de chez vous.
            </h1>

            {/* La thèse du site, et elle n'est pas une excuse. Un périmètre
                court n'est pas une couverture en construction : c'est le
                mécanisme qui rend tenable la promesse de revoir la même
                personne. Cette phrase était enterrée en milieu de page. */}
            <p className="mt-6 max-w-prose text-lg text-pretty">
              Nous ne dépassons pas une vingtaine de minutes de route depuis{" "}
              {SITE.address.city}. C&apos;est une limite que nous nous imposons,
              et c&apos;est elle qui rend le reste possible : des intervenants
              qui habitent votre commune, et la même personne chez vous à chaque
              passage.
            </p>

            {/* Tant que ce bloc est à l'écran, la barre collante s'efface :
                deux appels à l'action visibles demanderaient de choisir lequel
                compte. */}
            <div
              className="mt-8 flex flex-col gap-3 sm:flex-row"
              data-booking-cta
            >
              <Link
                href="/reserver"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-8 font-bold text-primary-foreground shadow-mint transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-mint-500"
              >
                Réserver
              </Link>
              <Link
                href="/tarifs"
                className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-border bg-card px-8 font-bold shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:border-mint-400 hover:bg-mint-50"
              >
                Voir les tarifs
              </Link>
            </div>

            {/* La vitrine statique n'embarque pas les espaces connectés : le
                lien y pointerait vers une page qui n'existe pas. */}
            {!clientEnv.NEXT_PUBLIC_DEMO_STATIQUE && (
              <p className="mt-5 text-sm text-muted-foreground">
                Déjà client ?{" "}
                <Link href="/mon-espace" className="text-brand underline">
                  Accéder à mes interventions
                </Link>
              </p>
            )}
          </div>
        </section>

        <StickyBookingCta />

        {/* Bloc 2 — les preuves chiffrées. */}
        <KeyFigures />

        {/* Bloc 3 — le cadre : ce qui sécurise, avant l'objection. */}
        <TrustStrip />

        {/* Bloc 4 — le paragraphe d'identité.
            Dense et factuel : c'est celui que les moteurs et les modèles de
            langage citent. Il reste vrai hors de sa page, et chaque chiffre
            n'y apparaît qu'une fois. */}
        <section className="mx-auto w-full max-w-4xl px-6 pt-16">
          <p className="max-w-prose text-pretty">
            {SITE.description} Nos intervenants se déplacent à{" "}
            <strong>{FACTS.maxDriveMinutes} minutes de route au maximum</strong>{" "}
            depuis {SITE.address.city}, à partir de{" "}
            <strong>
              {formatHourlyRate(FACTS.lowestHourlyRateCents)}, minimum{" "}
              {FACTS.minimumBillableMinutes / 60} heures
            </strong>
            . Les prestations relèvent des services à la personne :{" "}
            <strong>{FISCAL.sap.label}</strong>.
          </p>
        </section>

        {/* Bloc 5 — la conséquence concrète de la thèse. */}
        <section className="mx-auto w-full max-w-4xl px-6 py-16">
          <h2 className="text-2xl font-black tracking-tight">
            Ce que ça change chez vous
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {PROMISES.map((promise) => (
              <div
                key={promise.title}
                className="rounded-[var(--r-l)] border border-border bg-card p-5"
              >
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

        {/* Bloc 6 — l'offre. */}
        <Prestations />

        {/* Bloc 7 — le déroulé. */}
        <section className="border-y border-border-subtle bg-sky-50">
          <div className="mx-auto w-full max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-black tracking-tight">
              Comment ça se passe
            </h2>

            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {STEPS.map((step) => (
                <li key={step.number}>
                  <span
                    className="block text-3xl font-black tracking-tight text-mint-300"
                    aria-hidden
                  >
                    {step.number}
                  </span>
                  <h3 className="mt-1 font-extrabold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Bloc 8 — l'alternative. */}
        <Comparison />

        {/* Bloc 9 — le lieu, en fin de parcours. */}
        <Zones />

        {/* Bloc 10 — la confiance, sans avis inventés. */}
        <Engagement />

        {/* Bloc 11 — la sortie. */}
        <section className="border-t border-border-subtle bg-mint-50">
          <div className="mx-auto w-full max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-black tracking-tight text-balance">
              Une personne qui habite à côté, chez vous cette semaine
            </h2>

            <div
              className="mt-8 flex flex-col gap-3 sm:flex-row"
              data-booking-cta
            >
              <Link
                href="/reserver"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-8 font-bold text-primary-foreground shadow-mint transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-mint-500"
              >
                Réserver
              </Link>
              <Link
                href="/tarifs"
                className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-border bg-card px-8 font-bold shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:border-mint-400 hover:bg-mint-50"
              >
                Voir les tarifs
              </Link>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Prix affiché avant de réserver · Rien à payer aujourd&apos;hui ·
              Annulation gratuite jusqu&apos;à {FACTS.freeCancellationHours} h
              avant
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
      </main>

      <SiteFooter />
    </>
  );
}
