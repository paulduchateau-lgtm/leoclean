import type { Metadata } from "next";
import Link from "next/link";

import { BookingFunnelDemo } from "@/components/booking-funnel-demo";
import { ContactChannels } from "@/components/contact-channels";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatHourlyRate } from "@/lib/pricing";
import {
  MINIMUM_BILLABLE_MINUTES,
  PUBLIC_RATES,
} from "@/lib/pricing/public-grid";
import { COMMUNES, COMMUNES_BY_POPULATION } from "@/lib/territory";

/**
 * Tunnel de réservation — variante de la vitrine statique.
 *
 * Ce fichier remplace la page de production le temps de l'export : il ne
 * connaît aucune server action, ce qui est la condition pour que Next puisse
 * produire un site de fichiers.
 *
 * Le parcours est complet et les calculs sont réels — mêmes moteurs de
 * tarification et de disponibilité qu'en production, exécutés dans le
 * navigateur. Seule l'écriture manque, et l'écran de confirmation le dit.
 */

export const metadata: Metadata = {
  title: "Réserver un ménage à domicile",
  description:
    "Démonstration du tunnel de réservation Léo Clean : adresse, devis, créneau. Aucune réservation n'est enregistrée.",
  robots: { index: false, follow: false },
};

export default function ReserverPage() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Réserver un ménage
        </h1>
        <p className="mt-4 max-w-prose text-pretty text-muted-foreground">
          À partir de {formatHourlyRate(PUBLIC_RATES[0]!.hourlyRateCents)}, dans
          les {COMMUNES.length} communes du sud de Bordeaux. Minimum{" "}
          {MINIMUM_BILLABLE_MINUTES / 60} heures.
        </p>

        <div className="mt-8 rounded-xl border border-clay-500/40 bg-clay-500/5 p-5">
          <p className="font-heading font-semibold">Démonstration</p>
          <p className="mt-2 text-pretty text-muted-foreground">
            Le parcours ci-dessous fonctionne réellement : la recherche
            d&apos;adresse interroge la Base Adresse Nationale, le prix sort du
            moteur de tarification et les créneaux du moteur de disponibilité,
            qui tiennent compte des temps de route. Ils tournent ici dans votre
            navigateur, sur une équipe d&apos;intervenants fictive.
          </p>
          <p className="mt-2 text-pretty text-muted-foreground">
            Rien n&apos;est enregistré, et personne ne vous rappellera. Pour une
            vraie demande, appelez le{" "}
            <a href="tel:+33684363862" className="text-primary">
              06 84 36 38 62
            </a>
            .
          </p>
        </div>

        <div className="mt-10">
          <BookingFunnelDemo
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
