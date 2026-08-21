import { MapPinIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ContactChannels } from "@/components/contact-channels";
import { CadreIntervenants } from "@/components/intervenants/cadre";
import { CandidatureForm } from "@/components/intervenants/candidature-form";
import { ChiffresIntervenants } from "@/components/intervenants/chiffres";
import { EspaceProfessionnel } from "@/components/intervenants/espace-professionnel";
import { JourneeRangee } from "@/components/intervenants/journee-rangee";
import { Parrainage } from "@/components/intervenants/parrainage";
import { Perimetre } from "@/components/intervenants/perimetre";
import { Portes } from "@/components/intervenants/portes";
import { Remuneration } from "@/components/intervenants/remuneration";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import {
  FACTS,
  INTERVENANTS,
  INTERVENANT_PAGE_READY,
  PARRAINAGE,
} from "@/lib/facts";
import { FEATURES, stageLabel } from "@/lib/features";
import { formatEuros, formatHourlyRate } from "@/lib/pricing";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  organizationJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";

/**
 * Landing intervenants — la seconde porte du site, côté offre.
 *
 * Elle reprend la grammaire narrative de l'accueil client — thèse, preuves,
 * cadre, conséquences, déroulé, comparatif, sortie — pour que les deux faces
 * du site se ressemblent. La thèse est d'ailleurs la même contrainte, vue de
 * l'autre côté : le client s'entend dire « vingt minutes de route, donc
 * toujours la même personne » ; l'intervenant s'entend dire « vingt minutes de
 * route, donc une journée remplie sans la passer en voiture ».
 *
 * **Rien sur « rejoindre une aventure ».** On parle de kilomètres, d'heures et
 * de délais de paiement, parce que le premier poste de perte de revenu d'un
 * intervenant à domicile n'est pas le tarif horaire mais le temps de trajet
 * non payé et les trous de planning.
 *
 * **La page n'est pas indexable tant qu'elle est incomplète.** Plusieurs
 * chiffres — la rémunération nette au premier chef — attendent un arbitrage.
 * Une page d'offre qui se classerait sans dire ce qu'elle paie décevrait
 * exactement les gens qu'elle cherche à convaincre : `INTERVENANT_PAGE_READY`
 * la tient donc hors de l'index et hors du sitemap jusque-là.
 *
 * Pas de `JobPosting` dans le balisage : il ne s'agit pas d'une offre d'emploi
 * salarié, et le type induirait en erreur autant les moteurs que le candidat.
 */
export const metadata: Metadata = {
  ...pageMetadata({
    path: "/travailler-avec-nous",
    title: "Missions de ménage à domicile au sud de Bordeaux",
    description: `Trouvez des missions de ménage à domicile régulières dans ${FACTS.communeCount} communes au sud de Bordeaux, à ${FACTS.maxDriveMinutes} minutes de route au maximum. Indépendants et sociétés de ménage.`,
    summary: `Léo Clean propose des missions de ménage à domicile à des intervenants indépendants et à des sociétés de ménage dans ${FACTS.communeCount} communes du sud de Bordeaux, dans un rayon de ${FACTS.maxDriveMinutes} minutes de route depuis Léognan.`,
  }),
  ...(INTERVENANT_PAGE_READY ? {} : { robots: { index: false, follow: true } }),
};

export const revalidate = 86_400;

/** Le problème, du point de vue de l'intervenant. Du constat, pas de la plainte. */
const PROBLEMES = [
  "Les trajets non payés mangent la journée",
  "Les trous de planning entre deux clients",
  "Les paiements qui arrivent quand ils arrivent",
  "L'administratif du soir : factures, relances, déclarations",
];

/** La réponse, une pour une. */
const REPONSES = [
  {
    title: "Des missions groupées",
    body: `Un secteur, pas un département. ${FACTS.maxDriveMinutes} minutes de route au maximum entre notre siège et la commune la plus éloignée.`,
  },
  {
    title: "Des clients récurrents",
    body: "La formule régulière crée un planning stable, pas une file d'attente où il faut se replacer chaque semaine.",
  },
  {
    title: `Un paiement ${INTERVENANTS.paymentTerms ?? "à date fixe"}`,
    body: "Quel que soit le délai de règlement du client, qui est notre affaire et pas la vôtre.",
  },
  {
    title: "La facturation automatique",
    body: "Factures générées, envoyées, archivées. Vous ne relancez personne.",
  },
];

const ETAPES = [
  {
    number: "01",
    title: "Vous candidatez",
    body: "Six champs, dix minutes. Le reste se traite au téléphone.",
  },
  {
    number: "02",
    title: "On vérifie",
    body: "SIRET, attestation de responsabilité civile professionnelle, pièce d'identité, RIB.",
  },
  {
    number: "03",
    title: "On vous propose des missions près de chez vous",
    body: "Dans vos communes, sur vos disponibilités déclarées.",
  },
  {
    number: "04",
    title: "Vous acceptez celles qui vous vont",
    body: "Le choix est réel : refuser une mission n'a aucune conséquence sur celles qu'on vous proposera ensuite.",
  },
];

/** Ce que l'intervenant verra dans l'application, une fois celle-ci livrée. */
const OUTILS = [
  "Les missions qui vous sont proposées",
  "Votre semaine, telle que vous l'avez acceptée",
  "L'itinéraire d'un point au suivant",
  "La fiche du logement : accès, animaux, produits",
  "La validation de l'intervention",
  "Vos factures",
  "La messagerie",
];

const OUTILS_SOCIETE = [
  "Un compte à plusieurs intervenants",
  "L'affectation des missions à vos salariés",
  "Une facturation consolidée",
];

/**
 * Le net, tel qu'il se dit dans une phrase.
 *
 * Dérivé plutôt qu'écrit : la FAQ, le bandeau et le bloc rémunération citent
 * tous les trois ce montant, et trois occurrences d'un chiffre recopié sont
 * trois occasions de diverger.
 */
const NET_EN_TOUTES_LETTRES =
  INTERVENANTS.netHourlyRateCents === null
    ? "un montant net à l'heure"
    : `${formatHourlyRate(INTERVENANTS.netHourlyRateCents)} nets`;

const FAQ = [
  {
    question: "Combien je gagne ?",
    answer: `${NET_EN_TOUTES_LETTRES}, annoncés avant que vous acceptiez une mission. Le montant ne dépend pas de ce que le client finit par payer, et le partage complet — ce que paie le client, ce que vous touchez, ce que garde Léo Clean — figure sur cette page, section « Ce que vous touchez ».`,
  },
  {
    question: "Quand suis-je payé ?",
    answer: `${INTERVENANTS.paymentTerms === null ? "À une date connue à l'avance" : `Sous cinq jours ouvrés après l'intervention`}, indépendamment de la date à laquelle le client règle Léo Clean. Son délai de règlement est notre affaire, pas la vôtre.`,
  },
  {
    question: "Suis-je payé si le client ne paie pas ?",
    answer:
      "Cette situation est traitée explicitement dans la section « Ce que vous touchez » de cette page. Nous ne renvoyons pas la question aux conditions générales.",
  },
  {
    question: "Que touche-t-on si un client annule la veille ?",
    answer:
      "Le barème d'annulation client est public et figure sur la page tarifs. La part qui revient à l'intervenant est indiquée dans la section « Ce que vous touchez ».",
  },
  {
    question: "Dois-je avoir un statut ?",
    answer:
      "Oui pour travailler en indépendant : micro-entreprise ou entreprise individuelle, avec un SIRET actif. Si vous n'en avez pas encore, indiquez-le dans votre candidature — nous en parlons au téléphone.",
  },
  {
    question: "Puis-je travailler ailleurs en parallèle ?",
    answer:
      "Oui. Léo Clean ne demande aucune exclusivité, et n'en demandera pas. Vous pouvez avoir vos propres clients et travailler avec d'autres plateformes.",
  },
  {
    question: "Puis-je refuser une mission ?",
    answer:
      "Oui, sans motif et sans conséquence. Refuser ne réduit pas les missions qui vous seront proposées ensuite.",
  },
  {
    question: "Dois-je connecter mon agenda ?",
    answer:
      "Non. La connexion est facultative et ne conditionne rien : ne pas connecter son agenda ne réduit pas les missions proposées.",
  },
  {
    question: "Que voyez-vous de mon agenda ?",
    answer:
      "Les heures où vous êtes occupé, et le lieu uniquement si vous l'indiquez et si vous activez la seconde autorisation. Jamais le titre d'un rendez-vous, sa description ni ses participants.",
  },
  {
    question: "Suis-je assuré ?",
    answer:
      "Vous intervenez sous votre propre responsabilité civile professionnelle, dont l'attestation à jour est exigée avant la première mission. Léo Clean vérifie qu'elle est valide, elle ne s'y substitue pas.",
  },
  {
    question: "Comment fonctionne le parrainage ?",
    answer: `Vous parrainez un intervenant, il candidate avec votre code. À sa ${PARRAINAGE.qualifyingBookings}ᵉ intervention réalisée, vous percevez ${PARRAINAGE.rateBp / 100} % de son chiffre d'affaires, versé automatiquement avec votre règlement. Vous n'avez rien à demander.`,
  },
  {
    question: "Pendant combien de temps je touche les 5 % ?",
    answer: `Pendant ${PARRAINAGE.months} mois à compter de la ${PARRAINAGE.qualifyingBookings}ᵉ intervention de votre filleul, dans la limite de ${formatEuros(PARRAINAGE.monthlyCapCents)} par mois tous filleuls confondus. Vous ne touchez rien sur les personnes que vos filleuls parrainent à leur tour.`,
  },
  {
    question: "Le parrainage compte-t-il dans mon chiffre d'affaires ?",
    answer:
      "Oui. La commission est versée en espèces : c'est un revenu professionnel, il s'ajoute à votre chiffre d'affaires et compte dans vos plafonds de micro-entreprise. Léo Clean établit la facture correspondante pour vous.",
  },
];

export default function TravaillerAvecNousPage() {
  const outilsBadge = stageLabel(FEATURES.espaceIntervenant);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            organizationJsonLd(),
            breadcrumbJsonLd([
              { name: "Accueil", path: "/" },
              { name: "Travailler avec nous", path: "/travailler-avec-nous" },
            ]),
            faqJsonLd(FAQ),
          ]),
        }}
      />

      <SiteHeader variant="pro" />

      <main className="flex flex-1 flex-col">
        {/* Bloc 1 — la thèse, et la double porte dès le premier écran.
            Un gérant de société ne doit pas lire trois écrans destinés aux
            indépendants avant de comprendre qu'on lui parle aussi. */}
        <section className="relative overflow-hidden border-b border-border-subtle bg-teal-50">
          <div
            className="blob top-[-160px] right-[-90px] size-[360px] bg-teal-200"
            aria-hidden
          />
          <div
            className="blob bottom-[-90px] left-[-60px] size-[230px] bg-pineapple-200 opacity-70"
            aria-hidden
          />

          <div className="relative mx-auto w-full max-w-4xl px-6 py-10 sm:py-20">
            <Badge variant="secondary" className="mb-5 gap-1.5">
              <MapPinIcon className="size-3.5" aria-hidden />
              {FACTS.communeCount} communes au sud de Bordeaux
            </Badge>

            <h1 className="text-4xl leading-tight font-black tracking-tight text-balance sm:text-5xl">
              Des missions de ménage <span className="accent-word">à côté</span>{" "}
              de chez vous, toutes les semaines.
            </h1>

            <p className="mt-6 max-w-prose text-lg text-pretty">
              Vous travaillez dans votre commune et celles d&apos;à côté. Quinze
              minutes de route entre deux interventions, pas quarante.
              C&apos;est ce qui permet de remplir une journée sans la passer en
              voiture.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {/*
               * Vers le tunnel, pas vers l'ancre du formulaire de rappel. Le
               * tunnel ouvre un dossier, vérifie le SIRET auprès de l'INSEE et
               * se reprend depuis n'importe quel appareil ; le formulaire ne
               * fait que demander qu'on rappelle. Les laisser cohabiter
               * envoyait la moitié des candidats sur le chemin le plus long.
               */}
              <Link
                href="/rejoindre"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-8 font-bold text-primary-foreground shadow-action transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-pineapple-500"
              >
                Déposer ma candidature
              </Link>
              <Link
                href="#societes"
                className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-border bg-card px-8 font-bold shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:border-teal-300 hover:bg-teal-50"
              >
                Je représente une société de ménage
              </Link>
            </div>
          </div>
        </section>

        {/* Bloc 2 — les preuves chiffrées. */}
        <ChiffresIntervenants />

        {/* Bloc 3 — le cadre. */}
        <CadreIntervenants />

        {/* Bloc 4 — le problème, nommé. Il précède la solution, il ne s'y
            mélange pas : c'est ce bloc qui fait dire « ils comprennent le
            métier ». */}
        <section className="mx-auto w-full max-w-4xl px-6 py-16">
          <h2 className="text-2xl font-black tracking-tight">
            Ce qui coûte vraiment cher dans ce métier
          </h2>
          <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
            Ce n&apos;est pas le tarif horaire. C&apos;est ce qui se passe entre
            deux interventions, et ce qui reste à faire une fois rentré.
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {PROBLEMES.map((probleme) => (
              <li
                key={probleme}
                className="rounded-[var(--r-m)] border border-border bg-card p-4 text-pretty"
              >
                {probleme}
              </li>
            ))}
          </ul>
        </section>

        {/* Bloc 5 — la réponse, une pour une. */}
        <section className="border-y border-border-subtle bg-cream-50">
          <div className="mx-auto w-full max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-black tracking-tight">
              Ce que Léo Clean change
            </h2>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {REPONSES.map((reponse) => (
                <div key={reponse.title}>
                  <h3 className="font-extrabold">{reponse.title}</h3>
                  <p className="mt-1.5 text-pretty text-muted-foreground">
                    {reponse.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Blocs 6 et 7 — la démonstration du bloc 5, et ce qu'on lit de
            l'agenda. Un seul composant : les séparer demanderait de le
            réécrire, ce qui est le seul verrou fiable. */}
        <JourneeRangee />

        {/* Bloc 8 — le déroulé. */}
        <section className="border-y border-border-subtle bg-sky-50">
          <div className="mx-auto w-full max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-black tracking-tight">
              Comment ça se passe
            </h2>

            <ol className="mt-8 grid gap-6 sm:grid-cols-2">
              {ETAPES.map((etape) => (
                <li key={etape.number}>
                  <span
                    className="block text-3xl font-black tracking-tight text-teal-300"
                    aria-hidden
                  >
                    {etape.number}
                  </span>
                  <h3 className="mt-1 font-extrabold">{etape.title}</h3>
                  <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
                    {etape.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Bloc 9 — le périmètre, ligne par ligne. */}
        <Perimetre />

        {/* Bloc 10 — la rémunération. */}
        <Remuneration />

        {/* Bloc 11 — la cooptation. */}
        <Parrainage />

        {/* Bloc 12 — les deux portes. */}
        <Portes />

        {/* Bloc 13 — les outils. La moitié de la liste existe déjà — missions,
            semaine déclarée, dossier — et l'autre non : validation
            d'intervention, factures, messagerie. D'où le libellé « en test »,
            dérivé du drapeau et non écrit ici. Toujours aucune capture : ce qui
            est livré n'est pas ce qui est décrit, et une image le laisserait
            croire. */}
        <section className="border-y border-border-subtle bg-cream-50">
          <div className="mx-auto w-full max-w-4xl px-6 py-16">
            <h2 className="flex flex-wrap items-center gap-3 text-2xl font-black tracking-tight">
              Vos outils
              {outilsBadge !== null && (
                <Badge variant="secondary">{outilsBadge}</Badge>
              )}
            </h2>

            <div className="mt-8 grid gap-8 sm:grid-cols-2">
              <div>
                <h3 className="font-extrabold">Si vous êtes indépendant</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {OUTILS.map((outil) => (
                    <li key={outil} className="flex gap-2">
                      <span className="text-brand" aria-hidden>
                        ·
                      </span>
                      {outil}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-extrabold">Si vous dirigez une société</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {OUTILS_SOCIETE.map((outil) => (
                    <li key={outil} className="flex gap-2">
                      <span className="text-brand" aria-hidden>
                        ·
                      </span>
                      {outil}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Bloc 14 — les prérequis. La même liste que celle promise aux
            clients sous « professionnels vérifiés » : n'importe qui peut
            ouvrir les deux pages et vérifier qu'elles disent la même chose. */}
        <section className="mx-auto w-full max-w-4xl px-6 py-16">
          <h2 className="text-2xl font-black tracking-tight">
            Ce qu&apos;il faut pour commencer
          </h2>
          <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
            C&apos;est aussi ce que nous promettons aux clients quand nous
            écrivons « professionnels vérifiés ». Les deux pages disent la même
            chose.
          </p>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {INTERVENANTS.requirements.map((requirement) => (
              <li
                key={requirement}
                className="rounded-[var(--r-m)] border border-border bg-card px-4 py-3 text-sm"
              >
                {requirement}
              </li>
            ))}
          </ul>
        </section>

        {/* Bloc 15 — la FAQ, reprise telle quelle dans le `FAQPage`. */}
        <section className="border-y border-border-subtle bg-cream-50">
          <div className="mx-auto w-full max-w-4xl px-6 py-16">
            <h2 className="text-2xl font-black tracking-tight">
              Questions fréquentes
            </h2>

            <dl className="mt-8 space-y-6">
              {FAQ.map((entry) => (
                <div key={entry.question}>
                  <dt>
                    <h3 className="font-extrabold">{entry.question}</h3>
                  </dt>
                  <dd className="mt-1.5 max-w-prose text-pretty text-muted-foreground">
                    {entry.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Bloc 16 — la candidature, et les deux autres portes au même
            niveau : une partie de la cible candidate plus volontiers par
            message que par formulaire. */}
        <section
          id="candidature"
          className="mx-auto w-full max-w-4xl scroll-mt-24 px-6 py-16"
        >
          <h2 className="text-2xl font-black tracking-tight">
            Déposer votre candidature
          </h2>
          <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
            Quelques questions pour savoir si nous couvrons votre secteur, puis
            votre dossier. Il se reprend depuis n&apos;importe quel appareil :
            personne ne remplit tout d&apos;une traite entre deux missions.
          </p>

          <Link
            href="/rejoindre"
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-8 font-bold text-primary-foreground shadow-action transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-pineapple-500"
          >
            Commencer ma candidature
          </Link>

          <p className="mt-4 max-w-prose text-sm text-pretty text-muted-foreground">
            Pas encore de statut d&apos;auto-entrepreneur ? Ce n&apos;est pas un
            obstacle : le parcours vous accompagne, et nous gardons vos missions
            pendant les semaines d&apos;attente.
          </p>

          {/*
           * Le formulaire de rappel reste, en second. Une partie de la cible
           * candidate plus volontiers par message que par formulaire, et
           * quelqu'un qui bloque sur le tunnel doit pouvoir aboutir autrement
           * — c'est le point de sauvetage le plus rentable du recrutement.
           */}
          <div className="mt-12 border-t border-border/60 pt-8">
            <h3 className="text-lg font-extrabold">
              Vous préférez qu&apos;on vous rappelle ?
            </h3>
            <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
              Six questions, et nous vous appelons. Le reste se traite de vive
              voix.
            </p>
            <div className="mt-6">
              <CandidatureForm />
            </div>

            <div className="mt-10 border-t border-border/60 pt-6">
              <p className="mb-4 text-sm text-muted-foreground">
                Ou tout de suite, au téléphone :
              </p>
              <ContactChannels className="[&>div]:sm:justify-start" />
            </div>
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Vous pouvez aussi regarder{" "}
            <Link href="/tarifs" className="text-brand underline">
              ce que paient nos clients
            </Link>{" "}
            et{" "}
            <Link href="/zones-desservies" className="text-brand underline">
              les communes que nous couvrons
            </Link>
            . {SITE.name} n&apos;a rien à cacher de l&apos;un ni de
            l&apos;autre.
          </p>
        </section>

        {/* Bloc 17 — la porte de l'espace professionnel, en fin de page et
            visée depuis l'en-tête. Elle ferme la page sur les deux gestes qui
            restent à faire : entrer, ou commencer. */}
        <EspaceProfessionnel />
      </main>

      <SiteFooter />
    </>
  );
}
