import type { Metadata } from "next";
import Link from "next/link";

import {
  confirmBooking,
  getQuote,
  getSlots,
  searchAddress,
} from "@/app/reserver/actions";
import { BookingFunnel } from "@/components/booking-funnel";
import { ContactChannels } from "@/components/contact-channels";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { loadKnownClient } from "@/lib/booking/known-client-session";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { COMMUNES_BY_POPULATION } from "@/lib/territory";

/**
 * Tunnel de réservation.
 *
 * La page est servie dynamiquement : les créneaux dépendent du planning réel et
 * n'ont aucun sens mis en cache. C'est la seule page publique dans ce cas, et
 * elle n'a pas vocation à être indexée pour elle-même — ce sont les pages
 * communes qui l'alimentent.
 */

export const metadata: Metadata = {
  ...pageMetadata({
    path: "/reserver",
    title: "Réserver un ménage à domicile",
    description:
      "Réservez un ménage à domicile au sud de Bordeaux en quelques minutes : votre adresse, votre logement, votre créneau. Prix affiché avant de réserver, sans paiement immédiat.",
  }),
  // Un tunnel n'apporte rien en résultat de recherche : il n'a de sens qu'après
  // la page qui a convaincu. Il garde en revanche sa carte de partage : le lien
  // circule de la main à la main, ce que l'index ne voit pas.
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function ReserverPage({
  searchParams,
}: PageProps<"/reserver">) {
  /**
   * Commune d'arrivée, transmise par le héros de l'accueil ou par une page
   * locale. C'est un slug de notre référentiel, pas une donnée personnelle :
   * il peut voyager dans l'URL, contrairement à une adresse.
   */
  const params = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const origin = COMMUNES_BY_POPULATION.find(
    (commune) => commune.slug === first(params.commune),
  );

  /*
   * Surface et écran repris de l'URL.
   *
   * C'est ce qui fait qu'un lien partagé rouvre le tunnel là où il en était,
   * et qu'un rechargement ne renvoie pas au premier écran. La lecture se fait
   * ici, côté serveur, plutôt que dans un effet : le premier rendu est alors
   * déjà le bon, sans écart d'hydratation ni écran qui saute.
   *
   * Rien de personnel n'y voyage — ni nom, ni téléphone, ni adresse. Une barre
   * d'adresse se partage, s'enregistre en favori et se retrouve dans les
   * journaux d'un serveur.
   */
  const surface = Number(first(params.surface));
  const defaultSurfaceSqm =
    Number.isInteger(surface) && surface >= 15 && surface <= 400
      ? surface
      : undefined;

  /*
   * Ce que l'on sait déjà du visiteur, lu sur sa session et jamais demandé au
   * navigateur. `null` s'il est anonyme ou n'a jamais réservé : le tunnel se
   * comporte alors exactement comme pour un inconnu.
   */
  const knownClient = await loadKnownClient();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            organizationJsonLd(),
            breadcrumbJsonLd([
              { name: "Accueil", path: "/" },
              { name: "Réserver", path: "/reserver" },
            ]),
          ]),
        }}
      />

      <SiteHeader variant="tunnel" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        {/* Le titre de la page reste un h1 pour la structure du document, mais
            il est discret : la question de l'écran, portée par le tunnel, est
            ce que la personne doit lire en premier. */}
        <h1 className="sr-only">
          Réserver un ménage à domicile{origin ? ` à ${origin.name}` : ""}
        </h1>

        <div>
          {/* Les server actions sont passées en props : c'est ce qui permet au
              même écran de tourner au-dessus d'un serveur ou, sur la vitrine
              statique, d'un calcul dans le navigateur. */}
          <BookingFunnel
            backend={{ searchAddress, getQuote, getSlots, confirmBooking }}
            communes={COMMUNES_BY_POPULATION.map((commune) => ({
              slug: commune.slug,
              name: commune.name,
              postalCode: commune.postalCode,
              insee: commune.insee,
              lat: commune.lat,
              lng: commune.lng,
            }))}
            defaultCommuneSlug={origin?.slug}
            defaultSurfaceSqm={defaultSurfaceSqm}
            defaultStep={first(params.step)}
            knownClient={knownClient}
          />
        </div>

        <section className="mt-16 border-t border-border pt-10">
          <h2 className="text-xl font-extrabold tracking-tight">
            Vous préférez en parler ?
          </h2>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Certaines demandes se règlent mieux en deux minutes au téléphone
            qu&apos;en remplissant un formulaire — une grande maison, un accès
            compliqué, une date qui n&apos;apparaît pas.
          </p>
          <ContactChannels className="mt-6" />
          <p className="mt-6 text-sm text-muted-foreground">
            Vous cherchez plutôt à savoir combien ça coûte ?{" "}
            <Link href="/tarifs" className="text-brand hover:underline">
              Voir les tarifs détaillés
            </Link>
            .
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
