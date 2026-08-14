import type { Metadata } from "next";
import Link from "next/link";

import { BookingFunnel } from "@/components/booking-funnel";
import { ContactChannels } from "@/components/contact-channels";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatHourlyRate } from "@/lib/pricing";
import {
  MINIMUM_BILLABLE_MINUTES,
  PUBLIC_RATES,
} from "@/lib/pricing/public-grid";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { COMMUNES, COMMUNES_BY_POPULATION } from "@/lib/territory";

/**
 * Tunnel de réservation.
 *
 * La page est servie dynamiquement : les créneaux dépendent du planning réel et
 * n'ont aucun sens mis en cache. C'est la seule page publique dans ce cas, et
 * elle n'a pas vocation à être indexée pour elle-même — ce sont les pages
 * communes qui l'alimentent.
 */

export const metadata: Metadata = {
  title: "Réserver un ménage à domicile",
  description:
    "Réservez un ménage à domicile au sud de Bordeaux en quelques minutes : votre adresse, votre logement, votre créneau. Prix affiché avant de réserver, sans paiement immédiat.",
  alternates: { canonical: "/reserver" },
  // Un tunnel n'apporte rien en résultat de recherche : il n'a de sens qu'après
  // la page qui a convaincu.
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default function ReserverPage() {
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

      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Réserver un ménage
        </h1>
        <p className="mt-4 max-w-prose text-pretty text-muted-foreground">
          À partir de {formatHourlyRate(PUBLIC_RATES[0]!.hourlyRateCents)}, dans
          les {COMMUNES.length} communes du sud de Bordeaux. Minimum{" "}
          {MINIMUM_BILLABLE_MINUTES / 60} heures. Rien à payer maintenant.
        </p>

        <div className="mt-10">
          <BookingFunnel
            communes={COMMUNES_BY_POPULATION.map((commune) => ({
              slug: commune.slug,
              name: commune.name,
              postalCode: commune.postalCode,
              insee: commune.insee,
              lat: commune.lat,
              lng: commune.lng,
            }))}
          />
        </div>

        <section className="mt-16 border-t border-border pt-10">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
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
            <Link href="/tarifs" className="text-primary hover:underline">
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
