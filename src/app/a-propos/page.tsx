import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { publishedCommunes } from "@/lib/communes-content";
import { formatHourlyRate } from "@/lib/pricing";
import { PUBLIC_RATES } from "@/lib/pricing/public-grid";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { PENDING_IDENTITY_FIELDS, SITE } from "@/lib/site";
import {
  COMMUNES,
  COMMUNES_BY_POPULATION,
  MONTESQUIEU_COMMUNES,
  TERRITORY_POPULATION,
} from "@/lib/territory";

/**
 * Page « à propos », volontairement factuelle.
 *
 * C'est la page que les modèles de langage utilisent pour décrire une
 * entreprise. Elle est donc écrite en énoncés autonomes et vérifiables plutôt
 * qu'en discours : « Léo Clean intervient dans 16 communes » se cite, « nous
 * sommes à votre écoute depuis toujours » ne se cite pas.
 */
export const metadata: Metadata = {
  title: "À propos de Léo Clean",
  description:
    "Léo Clean est un service de ménage à domicile basé à Léognan, qui intervient dans 16 communes du sud de Bordeaux, en Gironde, dont les 13 de la Communauté de communes de Montesquieu.",
  alternates: { canonical: "/a-propos" },
};

export const revalidate = 86_400;

export default function AProposPage() {
  const published = publishedCommunes();

  /** Faits établis, présentés tels quels. Rien qui ne soit vérifiable. */
  const facts: { label: string; value: string }[] = [
    { label: "Activité", value: "Ménage à domicile pour les particuliers" },
    {
      label: "Siège",
      value: `${SITE.address.city} (${SITE.address.postalCode}), Gironde`,
    },
    {
      label: "Zone d'intervention",
      value: `${COMMUNES.length} communes du sud de Bordeaux, dont les ${MONTESQUIEU_COMMUNES.length} de la Communauté de communes de Montesquieu`,
    },
    {
      label: "Population desservie",
      value: `${TERRITORY_POPULATION.toLocaleString("fr-FR")} habitants`,
    },
    {
      label: "Tarif",
      value: `à partir de ${formatHourlyRate(PUBLIC_RATES[0]!.hourlyRateCents)} TTC`,
    },
    { label: "Téléphone", value: SITE.phone },
    ...(SITE.legalName
      ? [{ label: "Raison sociale", value: SITE.legalName }]
      : []),
    ...(SITE.siret ? [{ label: "SIRET", value: SITE.siret }] : []),
    ...(SITE.foundingDate
      ? [{ label: "Création", value: SITE.foundingDate }]
      : []),
    ...(SITE.founder ? [{ label: "Fondateur", value: SITE.founder }] : []),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            organizationJsonLd(),
            breadcrumbJsonLd([
              { name: "Accueil", path: "/" },
              { name: "À propos", path: "/a-propos" },
            ]),
          ]),
        }}
      />

      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          À propos de {SITE.name}
        </h1>

        <p className="mt-5 text-lg text-pretty text-muted-foreground">
          {SITE.description}
        </p>

        <h2 className="mt-12 font-heading text-2xl font-semibold tracking-tight">
          En bref
        </h2>
        <dl className="mt-4 divide-y divide-border border-y border-border">
          {facts.map((fact) => (
            <div key={fact.label} className="grid grid-cols-3 gap-4 py-3">
              <dt className="text-sm text-muted-foreground">{fact.label}</dt>
              <dd className="col-span-2">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <h2 className="mt-12 font-heading text-2xl font-semibold tracking-tight">
          Comment Léo Clean fonctionne
        </h2>
        <p className="mt-3 text-pretty text-muted-foreground">
          Léo Clean met en relation des particuliers avec des intervenants
          indépendants qui habitent la Communauté de communes de Montesquieu.
          Chaque intervenant travaille pour son propre compte et facture sa
          prestation ; Léo Clean facture séparément sa coordination. Sur une
          formule régulière, le client retrouve le même intervenant à chaque
          passage.
        </p>
        <p className="mt-3 text-pretty text-muted-foreground">
          Avant d&apos;intervenir, chaque professionnel fournit un SIRET actif,
          une attestation d&apos;assurance responsabilité civile
          professionnelle, une pièce d&apos;identité et un RIB. Aucune
          intervention n&apos;est confiée à quelqu&apos;un dont ces pièces
          n&apos;ont pas été vérifiées.
        </p>

        <h2 className="mt-12 font-heading text-2xl font-semibold tracking-tight">
          Pourquoi une zone restreinte
        </h2>
        <p className="mt-3 text-pretty text-muted-foreground">
          Léo Clean s&apos;interdit d&apos;intervenir au-delà d&apos;une
          vingtaine de minutes de route de Léognan. Cette contrainte garde les
          trajets courts entre deux interventions — 8 minutes jusqu&apos;à
          Martillac, 10 jusqu&apos;à Gradignan, 24 jusqu&apos;à Cestas — et
          c&apos;est elle qui rend possible d&apos;affecter durablement le même
          intervenant à un même client, plutôt que de recomposer un planning
          chaque semaine.
        </p>

        <h2 className="mt-12 font-heading text-2xl font-semibold tracking-tight">
          Les communes desservies
        </h2>
        <ul className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2">
          {COMMUNES_BY_POPULATION.map((commune) => (
            <li
              key={commune.slug}
              className="flex justify-between border-b border-border/50 py-1.5 text-sm"
            >
              <span>{commune.name}</span>
              <span className="text-muted-foreground tabular-nums">
                {commune.postalCode} ·{" "}
                {commune.population.toLocaleString("fr-FR")} hab.
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          {published.length} communes disposent d&apos;une page détaillée. Les
          autres sont desservies aux mêmes conditions.
        </p>

        {PENDING_IDENTITY_FIELDS.length > 0 ? (
          <p className="mt-12 rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
            Les informations légales de Léo Clean seront publiées ici dès
            l&apos;immatriculation de la société. Nous préférons ne rien
            afficher plutôt qu&apos;afficher une information approximative.
          </p>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
