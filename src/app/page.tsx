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
 * Le déroulé, du point de vue du client.
 *
 * L'ancienne version racontait la mécanique interne — diffusion par lots,
 * cinq intervenants, premier qui accepte. C'est vrai, et cela reste écrit là
 * où cela engage : au récapitulatif, juste avant le geste qui réserve, et sur
 * l'écran de confirmation. Mais l'accueil n'a pas à faire porter au visiteur
 * le fonctionnement de l'attribution : ce qu'il achète, c'est de ne plus s'en
 * occuper.
 *
 * D'où trois étapes qui disent ce qu'il fait (presque rien) et ce que nous
 * faisons (le reste) — suivies d'une ligne qui garde la promesse exacte : la
 * confirmation arrive sous 24 h, elle n'est pas immédiate. Sans elle,
 * quelqu'un lirait « vous profitez de votre maison » comme un rendez-vous
 * acquis à la seconde, et le découvrirait à la première réservation.
 */
const STEPS = [
  {
    number: "1",
    title: "Dites-nous ce dont vous avez besoin",
    body: "Quelques clics suffisent : votre adresse, la durée, le rythme, votre créneau. Le prix s'affiche avant qu'on vous demande la moindre donnée personnelle.",
  },
  {
    number: "2",
    title: "Nous trouvons le bon professionnel près de chez vous",
    body: `Sélectionné et suivi par ${SITE.name}, et choisi parmi ceux qui habitent votre commune ou la commune d'à côté.`,
  },
  {
    number: "3",
    title: "Vous profitez de votre maison",
    body: "Planning, paiement et suivi : on reste disponible si vous avez besoin de nous.",
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
                encre — la signature la plus pétillante de la palette.

                Elle dit le territoire et non son décompte : « seize communes »
                se lit comme une limite là où « au sud de Bordeaux » se lit
                comme une adresse. Le chiffre n'est pas perdu — il vit dans le
                paragraphe d'identité et dans le bloc des communes, aux deux
                endroits où il sert de preuve plutôt que de restriction. */}
              <Badge className="mb-5 gap-1.5 bg-teal-100 text-ink-900">
                <MapPinIcon className="size-3.5" aria-hidden />
                Les pros du ménage au sud de Bordeaux
              </Badge>

              {/* Un seul mot d'accent, en sarcelle : le tropical punch accentue
                par la couleur, pas par un changement de plume. */}
              <h1 className="text-4xl leading-tight font-black tracking-tight text-balance sm:text-5xl">
                Votre ménage à domicile,{" "}
                <span className="accent-word">simplement</span>.
              </h1>

              {/* La thèse.

                Elle disait auparavant que la proximité rendait possible « la
                seule promesse qui compte vraiment : la même personne à chaque
                passage ». C'était faire de l'intervenant attitré la promesse
                centrale, alors que ce n'est qu'un moyen : ce qu'achète
                quelqu'un dont la maison est sale, c'est de ne plus avoir à
                s'en occuper. La continuité reste dite — plus bas, dans les
                engagements, à sa vraie place de conséquence. */}
              <p className="mt-6 max-w-prose text-lg text-pretty">
                Des professionnels sélectionnés près de chez vous. {SITE.name}{" "}
                s&apos;occupe du reste.
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
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-8 font-bold text-primary-foreground shadow-action transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-pineapple-400"
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

              {/* Les deux CTA de connexion, sous le geste de réservation et
                jamais à sa place : « Réserver » reste l'action de la page.
                Principal, « Se connecter » désigne l'espace client — qui
                redirige lui-même vers la connexion quand la session manque, si
                bien qu'une seule adresse sert les deux cas. Secondaire,
                « Devenir pro » ouvre la face offre, qui porte sa propre porte
                professionnelle : la vitrine client ne désigne pas l'espace
                intervenant, on n'y entre qu'après la page qui dit le métier.

                La vitrine statique n'embarque ni les espaces connectés ni la
                face offre : les liens y pointeraient vers des pages
                absentes. */}
              {!clientEnv.NEXT_PUBLIC_DEMO_STATIQUE && (
                <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <Link
                    href="/mon-espace"
                    className="font-semibold text-brand underline"
                  >
                    Se connecter
                  </Link>
                  <span aria-hidden>·</span>
                  <Link
                    href="/travailler-avec-nous"
                    className="text-brand underline"
                  >
                    Devenir pro
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
                    Des professionnels sélectionnés
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Pour leur expérience, leur sérieux et leur fiabilité
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
          {/* La phrase sur le rayon de vingt-et-une minutes a été retirée le
              21 août 2026, sur arbitrage du porteur du projet. Le chiffre n'a
              pas disparu du site pour autant : chaque pastille de commune, en
              bas de page, porte son propre temps de trajet — ce qui le rend
              concret là où la phrase le rendait abstrait. */}
          <p className="max-w-prose text-pretty">
            {SITE.description} Nos prestations démarrent à{" "}
            <strong>
              {formatHourlyRate(FACTS.lowestHourlyRateCents)}, minimum{" "}
              {FACTS.minimumBillableMinutes / 60} heures
            </strong>
            . Elles relèvent des services à la personne :{" "}
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
                Vous réservez. Nous nous occupons du reste.
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

              {/* La promesse exacte, sous la liste et non à la place :
                  « vous profitez de votre maison » ne doit pas se lire comme
                  un rendez-vous acquis à la seconde. Le fonctionnement
                  complet — la demande part chez cinq intervenants, le premier
                  qui accepte l'emporte — est écrit au récapitulatif, juste
                  avant le geste qui engage. */}
              <p className="mt-6 text-sm text-teal-200">
                Vous êtes prévenu sous 24 h, avec le prénom de votre
                intervenant, sa commune et son ancienneté.
              </p>

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
                {/* Le prénom du fondateur figurait ici, à trois lignes de
                    l'adresse du siège — qui est aussi son domicile. La
                    promesse tenue par ce bloc est qu'une vraie personne
                    répond, et elle tient sans nommer qui : c'est le délai de
                    réponse et le numéro qui la rendent vérifiable. */}
                <p className="mt-2 max-w-prose text-muted-foreground">
                  Écrivez-nous : quelqu&apos;un lit et répond, dans la journée,
                  en semaine.
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
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-8 font-bold text-primary-foreground shadow-action transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-pineapple-400"
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

            {/* La porte côté offre, redite tout en bas : quelqu'un qui cherche
                du travail lit la page jusqu'au bout, un client non.

                Elle n'est plus gardée par `INTERVENANT_PAGE_READY`. Ce drapeau
                tenait deux choses à la fois — l'indexation de la page, et sa
                désignation depuis la vitrine — et la seconde est désormais une
                décision produit : la face offre est annoncée. La première
                tient toujours, `/travailler-avec-nous` restant en `noindex` et
                hors du sitemap tant que ses trois garanties ne sont pas
                arbitrées. Un lien pour les humains, pas pour les moteurs. */}
            {!clientEnv.NEXT_PUBLIC_DEMO_STATIQUE && (
              <p className="mt-8 text-sm text-muted-foreground">
                Vous êtes professionnel du ménage ?{" "}
                <Link
                  href="/travailler-avec-nous"
                  className="text-brand underline"
                >
                  Devenir pro
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
