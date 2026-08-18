import {
  CheckIcon,
  ClockIcon,
  MailIcon,
  MapPinIcon,
  RepeatIcon,
  ShieldCheckIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

/*
 * Les photos sont importées statiquement : Next connaît leurs dimensions —
 * aucun décalage de mise en page — et applique lui-même le `basePath` de la
 * vitrine statique, ce que `assetPath()` devrait faire à la main pour un
 * fichier de `public/`.
 */
import photoIntervenante from "@/components/home/photos/intervenante-salon.webp";
import photoInterieur from "@/components/home/photos/interieur.webp";

import { ContactChannels } from "@/components/contact-channels";
import { Comparison } from "@/components/home/comparison";
import { Conseils } from "@/components/home/conseils";
import { Engagement } from "@/components/home/engagement";
import { Faq } from "@/components/home/faq";
import { KeyFigures } from "@/components/home/key-figures";
import { Prestations } from "@/components/home/prestations";
import { Services } from "@/components/home/services";
import { Zones } from "@/components/home/zones";
import { LeadForm } from "@/components/lead-form";
import { ResumeBookingBanner } from "@/components/resume-booking-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StickyBookingCta } from "@/components/sticky-booking-cta";
import { Badge } from "@/components/ui/badge";
import { clientEnv } from "@/lib/env";
import { FACTS, INTERVENANT_PAGE_READY } from "@/lib/facts";
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
 * Le déroulé réel : diffusion par lots, acceptation explicite.
 *
 * L'ancienne copy annonçait « nous choisissons la personne la plus proche »,
 * ce qui décrivait le modèle d'avant : depuis la diffusion par lots, personne
 * ne se voit imposer une mission — la demande part chez cinq intervenants et
 * le premier qui accepte l'emporte. Le déroulé raconte ce qui se passe
 * vraiment, parce qu'une promesse de fonctionnement fausse se découvre à la
 * première réservation.
 */
const STEPS = [
  {
    number: "1",
    title: "Vous choisissez votre créneau",
    body: "Six écrans, deux minutes. Le prix s'affiche avant qu'on vous demande la moindre donnée personnelle.",
  },
  {
    number: "2",
    title: "La mission part chez cinq intervenants",
    body: "Ceux qui habitent le plus près de chez vous et connaissent déjà le secteur. Personne ne se voit imposer une mission.",
  },
  {
    number: "3",
    title: "Le premier qui accepte l'emporte",
    body: "Vous êtes prévenu sous 24 h, avec son prénom, sa commune et son ancienneté.",
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
            Le héros est un lever de soleil — papaye vers le blanc chaud de la
            page — et ses taches colorées sont la signature du système : une
            pièce aérée, pas un bandeau. Elles se posent en absolu derrière le
            contenu, et `overflow-hidden` les empêche d'élargir la page. */}
        <section className="relative overflow-hidden border-b border-border-subtle bg-gradient-to-b from-papaya-100 to-background">
          <div
            className="blob top-[-160px] right-[-90px] size-[360px] bg-papaya-200 opacity-60"
            aria-hidden
          />
          <div
            className="blob bottom-[-90px] left-[-60px] size-[230px] bg-pineapple-200 opacity-70"
            aria-hidden
          />
          {/* La tache sarcelle passe derrière le titre : elle ne paraît qu'à
              partir du moment où la ligne de texte ne la traverse plus. */}
          <div
            className="blob top-[120px] left-[64%] hidden size-[150px] bg-teal-200 opacity-40 lg:block"
            aria-hidden
          />

          <div className="relative mx-auto grid w-full max-w-5xl items-center gap-14 px-6 py-10 sm:py-20 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              {/* Un parcours interrompu se retrouve ici, pas dans la mémoire
                  de la personne : elle revient par l'accueil, et sans ce
                  bandeau elle recommence de zéro. Posé avant le premier rendu,
                  il ne décale rien. */}
              <ResumeBookingBanner />

              {/* La pilule ananas : le badge des moments d'accroche, texte
                encre — la signature la plus pétillante de la palette. */}
              <Badge className="mb-5 gap-1.5 bg-pineapple-300 text-ink-900">
                <MapPinIcon className="size-3.5" aria-hidden />
                {FACTS.communeCount} communes au sud de Bordeaux
              </Badge>

              {/* Un seul mot d'accent, en sarcelle : le tropical punch accentue
                par la couleur, pas par un changement de plume. */}
              <h1 className="text-4xl leading-tight font-black tracking-tight text-balance sm:text-5xl">
                Le ménage à domicile, par des personnes qui habitent{" "}
                <span className="accent-word">à côté</span> de chez vous.
              </h1>

              {/* La thèse, dite en personnes plutôt qu'en minutes : c'est la
                proximité qui rend possible la seule promesse qui compte. */}
              <p className="mt-6 max-w-prose text-lg text-pretty">
                Nos intervenants vivent dans les communes où ils travaillent.
                C&apos;est ce qui rend possible la seule promesse qui compte
                vraiment : la même personne chez vous, à chaque passage.
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
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-8 font-bold text-primary-foreground shadow-mango transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-mango-500"
                >
                  Réserver un ménage
                </Link>
                <a
                  href="#contact"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-border bg-card px-8 font-bold shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:border-teal-300 hover:bg-teal-50"
                >
                  Nous écrire
                </a>
              </div>

              {/* Les trois objections qu'on ne pose pas à voix haute, levées
                sous le geste plutôt qu'en bas de page. */}
              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <ShieldCheckIcon
                    className="size-4 shrink-0 text-brand"
                    aria-hidden
                  />
                  Intervenants vérifiés et assurés
                </li>
                <li className="flex items-center gap-1.5">
                  <ClockIcon
                    className="size-4 shrink-0 text-brand"
                    aria-hidden
                  />
                  Annulation gratuite jusqu&apos;à {FACTS.freeCancellationHours}{" "}
                  h avant
                </li>
                <li className="flex items-center gap-1.5">
                  <RepeatIcon
                    className="size-4 shrink-0 text-brand"
                    aria-hidden
                  />
                  Sans abonnement
                </li>
              </ul>

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

            {/* La photo n'apparaît qu'en desktop : en mobile elle coûterait
                le premier écran entier, là où la thèse doit se lire avant
                tout défilement. La carte flottante ne porte que des promesses
                vraies — pas de personne inventée. */}
            <div className="relative hidden lg:block">
              <div className="relative h-[420px] overflow-hidden rounded-[var(--r-2xl)]">
                <Image
                  src={photoInterieur}
                  alt="Un intervenant Léo Clean aspire un canapé dans un salon lumineux"
                  fill
                  priority
                  sizes="(min-width: 1024px) 480px, 0px"
                  className="object-cover"
                />
              </div>
              <div className="absolute bottom-8 -left-7 flex max-w-72 items-center gap-3 rounded-[var(--r-l)] bg-card p-4 shadow-xl">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                  <CheckIcon className="size-5" strokeWidth={3} aria-hidden />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-bold">
                    Le même intervenant à chaque passage
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Il habite l&apos;une des {FACTS.communeCount} communes du
                    secteur
                  </span>
                </span>
              </div>
            </div>
          </div>
        </section>

        <StickyBookingCta />

        {/* Bloc 2 — les preuves chiffrées. */}
        <KeyFigures />

        {/* Bloc 3 — le paragraphe d'identité.
            Dense et factuel : c'est celui que les moteurs et les modèles de
            langage citent. Il reste vrai hors de sa page, et chaque chiffre
            n'y apparaît qu'une fois. Il porte aussi la mention fiscale — le
            statut du dossier, rien de plus. */}
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

        {/* Bloc 4 — les quatre prestations. */}
        <Services />

        {/* Bloc 5 — l'offre : deux tarifs, pas de forfait, pas d'abonnement. */}
        <Prestations />

        {/* Bloc 6 — le déroulé, sur la bande sombre sarcelle : c'est la
            profondeur de la palette, et les numéros en pilule ananas y portent
            du texte encre — le duo signature du tropical punch. */}
        <section className="bg-teal-900 text-white">
          <div className="mx-auto grid w-full max-w-5xl items-center gap-14 px-6 py-16 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-balance text-white">
                Vous demandez une heure. Quelqu&apos;un l&apos;accepte.
              </h2>

              <ol className="mt-8 space-y-6">
                {STEPS.map((step) => (
                  <li key={step.number} className="flex gap-4">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pineapple-300 font-display text-base font-bold text-ink-900 tabular-nums"
                      aria-hidden
                    >
                      {step.number}
                    </span>
                    <span>
                      <h3 className="font-extrabold text-white">
                        {step.title}
                      </h3>
                      <p className="mt-1 text-sm text-pretty text-teal-200">
                        {step.body}
                      </p>
                    </span>
                  </li>
                ))}
              </ol>

              {/* L'accent de la bande sombre : la pilule ananas, texte
                  encre. */}
              <Link
                href="/reserver"
                className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-pineapple-300 px-8 font-bold text-ink-900 transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-pineapple-400"
              >
                Commencer
              </Link>
            </div>

            <div className="relative hidden h-[380px] overflow-hidden rounded-[var(--r-2xl)] lg:block">
              <Image
                src={photoIntervenante}
                alt="Une intervenante Léo Clean nettoie une table basse en bois"
                fill
                sizes="(min-width: 1024px) 480px, 0px"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* Bloc 7 — le comparatif de modèles. */}
        <Comparison />

        {/* Bloc 8 — la conséquence concrète, sans avis inventés.
            Il précède les communes : le test de la page l'impose — la
            première commune n'apparaît qu'après la thèse et ses conséquences,
            jamais avant le premier argument. */}
        <Engagement />

        {/* Bloc 9 — le lieu, en fin de parcours. */}
        <Zones />

        {/* Bloc 10 — les conseils : les questions sans nom de ville. */}
        <Conseils />

        {/* Bloc 11 — les questions fréquentes. */}
        <Faq />

        {/* Bloc 12 — le contact : un formulaire, à côté des trois canaux.
            Écrire est le canal de ceux qui ne réserveront pas seuls et
            n'appellent pas non plus — le formulaire est le même que celui de
            /etre-rappele, distingué par son chemin d'origine. */}
        <section
          id="contact"
          className="border-t border-border-subtle bg-cream-50"
        >
          <div className="mx-auto w-full max-w-4xl px-6 py-16">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-balance">
                  Une question avant de réserver ?
                </h2>
                <p className="mt-2 max-w-prose text-muted-foreground">
                  Écrivez-nous
                  {SITE.founder !== null
                    ? ` : c'est ${SITE.founder.split(" ")[0]} qui lit, et qui répond`
                    : ""}{" "}
                  — dans la journée, en semaine.
                </p>

                <ul className="mt-6 space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <MailIcon
                      className="size-4 shrink-0 text-brand"
                      aria-hidden
                    />
                    <a href={`mailto:${SITE.email}`} className="font-medium">
                      {SITE.email}
                    </a>
                  </li>
                  {SITE.address.street !== null && (
                    <li className="flex items-center gap-2">
                      <MapPinIcon
                        className="size-4 shrink-0 text-brand"
                        aria-hidden
                      />
                      {SITE.address.street}, {SITE.address.postalCode}{" "}
                      {SITE.address.city}
                    </li>
                  )}
                </ul>

                <div className="mt-8">
                  <p className="mb-4 text-sm text-muted-foreground">
                    Vous préférez en parler à quelqu&apos;un ?
                  </p>
                  <ContactChannels stacked />
                </div>
              </div>

              <LeadForm sourcePath="/" />
            </div>
          </div>
        </section>

        {/* Bloc 13 — la sortie. Le panneau porte LE rose de la palette, en
            surface arrondie et texte encre — jamais de blanc sur papaye. */}
        <section className="border-t border-border-subtle">
          <div className="mx-auto w-full max-w-4xl px-6 py-16">
            <div className="rounded-[var(--r-2xl)] bg-papaya-200 p-8 sm:p-12">
              <h2 className="text-2xl font-black tracking-tight text-balance">
                Votre premier ménage, en deux minutes
              </h2>
              <p className="mt-2 text-ink-800">
                Sans engagement. Annulation gratuite jusqu&apos;à{" "}
                {FACTS.freeCancellationHours} h avant.
              </p>

              <div
                className="mt-8 flex flex-col gap-3 sm:flex-row"
                data-booking-cta
              >
                <Link
                  href="/reserver"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-8 font-bold text-primary-foreground shadow-mango transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-mango-500"
                >
                  Réserver
                </Link>
                <Link
                  href="/tarifs"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-transparent bg-card px-8 font-bold shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:border-teal-300 hover:bg-teal-50"
                >
                  Voir les tarifs
                </Link>
              </div>
            </div>

            {/* La porte côté offre, discrète et tout en bas : quelqu'un qui
                cherche du travail lit la page jusqu'au bout, un client non.
                Elle n'apparaît qu'une fois les conditions arbitrées. */}
            {INTERVENANT_PAGE_READY && (
              <p className="mt-8 text-sm text-muted-foreground">
                Vous êtes professionnel du ménage ?{" "}
                <Link
                  href="/travailler-avec-nous"
                  className="text-brand underline"
                >
                  Travaillez avec nous
                </Link>
                .
              </p>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
