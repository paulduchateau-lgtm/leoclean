import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContactChannels } from "@/components/contact-channels";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatHourlyRate } from "@/lib/pricing";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { absoluteUrl } from "@/lib/site";
import {
  chargerSocietePublique,
  slugsSocietesPubliques,
} from "@/lib/societes/publique";
import { COMMUNES } from "@/lib/territory";

/**
 * Page publique d'une société cliente du SaaS.
 *
 * Elle dit autre chose que les pages communes, et c'est voulu : Léo Clean met
 * en relation, une société est prestataire et emploie ses agents. Ses tarifs
 * sont les siens, lus sur un client cloisonné à son organisation.
 *
 * Le rendu est dynamique et non prégénéré : le catalogue d'une société peut
 * changer sans qu'un déploiement suive, et une page tarifaire périmée est pire
 * qu'une page lente. La revalidation quotidienne garde le coût raisonnable.
 */

export const revalidate = 86_400;
export const dynamicParams = true;

/**
 * Slugs prégénérés au moment de la construction.
 *
 * La liste vient de la base, et la base n'est pas toujours joignable quand on
 * construit — conteneur d'intégration continue, poste neuf, coupure du
 * fournisseur. Faire échouer la construction entière pour cette raison-là
 * revient à faire dépendre la mise en ligne des seize pages communes de
 * l'existence de sociétés clientes, qui sont zéro aujourd'hui.
 *
 * On journalise et on rend une liste vide : `dynamicParams` étant vrai, les
 * pages société se rendent alors à la demande, à la première visite. Le seul
 * effet est qu'elles ne sont pas prégénérées, ce qui est exactement ce que le
 * commentaire ci-dessus décrit comme acceptable.
 *
 * Le silence est ce qu'on ne fait pas : une base injoignable pendant une
 * construction de production doit se lire dans le journal.
 */
export async function generateStaticParams() {
  try {
    const slugs = await slugsSocietesPubliques();
    return slugs.map((slug) => ({ slug }));
  } catch (error) {
    console.error(
      "Sociétés publiables illisibles à la construction : les pages /pro seront rendues à la demande.",
      error,
    );
    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/pro/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const societe = await chargerSocietePublique(slug);

  if (!societe) {
    return {};
  }

  return {
    title: `${societe.nom} — ménage à domicile au sud de Bordeaux`,
    description:
      societe.accroche ??
      societe.description?.slice(0, 155) ??
      `${societe.nom} intervient au sud de Bordeaux.`,
    alternates: { canonical: `/pro/${societe.slug}` },
    openGraph: {
      title: societe.nom,
      description: societe.accroche ?? "",
      url: absoluteUrl(`/pro/${societe.slug}`),
      type: "website",
    },
  };
}

export default async function SocietePage({
  params,
}: PageProps<"/pro/[slug]">) {
  const { slug } = await params;
  const societe = await chargerSocietePublique(slug);

  /*
   * Une organisation qui n'est pas publiable n'existe pas publiquement : 404,
   * et non une page vide ou un message qui confirmerait son existence.
   */
  if (!societe) {
    notFound();
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            organizationJsonLd(),
            breadcrumbJsonLd([
              { name: "Accueil", path: "/" },
              { name: societe.nom, path: `/pro/${societe.slug}` },
            ]),
          ]),
        }}
      />

      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <nav
          aria-label="Fil d'Ariane"
          className="text-sm text-muted-foreground"
        >
          <Link href="/" className="hover:text-brand">
            Accueil
          </Link>
          <span aria-hidden> / </span>
          <span aria-current="page" className="text-foreground">
            {societe.nom}
          </span>
        </nav>

        <h1 className="mt-6 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {societe.nom}
        </h1>
        {societe.accroche ? (
          <p className="mt-4 max-w-prose text-lg text-pretty text-muted-foreground">
            {societe.accroche}
          </p>
        ) : null}

        {societe.description ? (
          <p className="mt-6 max-w-prose text-pretty">{societe.description}</p>
        ) : null}

        <section className="mt-12">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Ses prestations
          </h2>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Les tarifs ci-dessous sont ceux de {societe.nom}, et non ceux de Léo
            Clean : chaque société fixe les siens.
          </p>

          {societe.prestations.length === 0 ? (
            <p className="mt-6 rounded-xl border border-border bg-secondary/40 p-5 text-muted-foreground">
              Le catalogue de cette société n&apos;est pas encore publié.
              Contactez-la directement.
            </p>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {societe.prestations.map((prestation) => (
                <li
                  key={prestation.slug}
                  className="rounded-xl border border-border bg-card p-5"
                >
                  <h3 className="font-heading text-lg font-semibold">
                    {prestation.nom}
                  </h3>
                  {prestation.description ? (
                    <p className="mt-2 text-sm text-pretty text-muted-foreground">
                      {prestation.description}
                    </p>
                  ) : null}
                  <p className="mt-3 font-heading text-xl font-semibold">
                    {prestation.tarifHoraireCents === null
                      ? "Tarif sur demande"
                      : `À partir de ${formatHourlyRate(prestation.tarifHoraireCents)}`}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Minimum {prestation.dureeMinimaleMinutes / 60} heures
                  </p>
                  {prestation.options.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {prestation.options.map((option) => (
                        <li
                          key={option.nom}
                          className="rounded-full bg-secondary px-3 py-1 text-xs"
                        >
                          {option.nom}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            La joindre
          </h2>
          {societe.telephone || societe.email ? (
            <ul className="mt-4 space-y-2">
              {societe.telephone ? (
                <li>
                  <a
                    href={`tel:${societe.telephone.replace(/\s/g, "")}`}
                    className="font-medium text-brand"
                  >
                    {societe.telephone}
                  </a>
                </li>
              ) : null}
              {societe.email ? (
                <li>
                  <a
                    href={`mailto:${societe.email}`}
                    className="font-medium text-brand"
                  >
                    {societe.email}
                  </a>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-3 text-muted-foreground">
              Cette société n&apos;a pas publié ses coordonnées.
            </p>
          )}
          {societe.raisonSociale ? (
            <p className="mt-6 text-sm text-muted-foreground">
              {societe.raisonSociale}
            </p>
          ) : null}
        </section>

        <section className="mt-14 rounded-2xl bg-secondary/40 p-6">
          <h2 className="font-heading text-xl font-semibold">
            Vous cherchez un ménage sans choisir votre prestataire ?
          </h2>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Léo Clean vous met en relation avec un intervenant indépendant qui
            habite l&apos;une des {COMMUNES.length} communes du sud de Bordeaux,
            et vous montre son prix et ses créneaux avant de réserver.
          </p>
          <Link
            href="/reserver"
            className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-primary px-6 font-medium text-primary-foreground"
          >
            Voir les créneaux disponibles
          </Link>
          <ContactChannels className="mt-6" />
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
