import { CalendarPlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { InterventionActions } from "@/app/(app)/mon-espace/intervention-actions";
import { PropositionCreneau } from "@/app/(app)/mon-espace/proposition-creneau";
import { ContactChannels } from "@/components/contact-channels";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { auth } from "@/lib/auth/config";
import { decideCancellation, refusalMessage } from "@/lib/booking/cancel";
import type { ClientBookingView } from "@/lib/booking/client-bookings";
import { loadClientBookings } from "@/lib/booking/client-bookings-session";
import { loadClientProposals } from "@/lib/booking/slot-proposal-session";
import { chargerLesInterventionsANoter } from "@/lib/mission/avis-session";
import type { ClientProposalView } from "@/lib/booking/slot-proposal-store";
import { bookingCalendarFilename } from "@/lib/booking/ics";
import { formatDuration, formatEuros } from "@/lib/pricing";
import { CANCELLATION_TIERS } from "@/lib/pricing/cancellation";
import { SITE } from "@/lib/site";

/**
 * Espace client.
 *
 * **L'accès passe par le lien magique existant**, pas par un jeton signé maison.
 * Le dépôt a tranché : sessions en base plutôt qu'en jeton, afin de pouvoir
 * être révoquées immédiatement — suspension d'un compte, suppression au titre
 * du RGPD. Un second système d'authentification à côté du premier ne serait pas
 * un raccourci, ce serait une deuxième surface à sécuriser.
 *
 * **L'annulation en autonomie existe désormais.** Elle supposait trois choses
 * qui manquaient : une transition de statut tracée, la libération du créneau,
 * et l'information de l'intervenant. `client-space.ts` fait les trois dans une
 * seule transaction — sans la troisième écriture, l'affectation resterait
 * `ACCEPTED` et la contrainte d'exclusion gèlerait un créneau pour une
 * intervention qui n'a plus lieu.
 *
 * Le coût est annoncé **avant** la confirmation, lu dans le même barème que
 * celui qui prélève. La replanification, elle, n'y est toujours pas : elle
 * suppose de rechercher un créneau et de réattribuer, c'est-à-dire le tunnel
 * entier. Annuler puis reprendre reste le chemin, et il est honnête.
 */

export const metadata: Metadata = {
  title: "Mes réservations",
  // Un espace personnel ne répond à aucune intention de recherche.
  robots: { index: false, follow: false },
};

const dayFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});
const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** Annulation gratuite : le palier le plus lointain du barème des CGU. */
const FREE_CANCELLATION_HOURS = CANCELLATION_TIERS[0]!.fromHoursBefore;

function BookingCard({
  booking,
  upcoming,
  now,
  proposals,
}: {
  booking: ClientBookingView;
  upcoming: boolean;
  now: Date;
  /** Créneaux de remplacement proposés sur cette intervention. */
  proposals: ClientProposalView[];
}) {
  const start = new Date(booking.startAt);

  /* Décidé côté serveur, avec la même fonction que l'action de mutation : deux
     règles concurrentes finiraient par diverger, et le client verrait un
     bouton qui refuse ou un montant qui n'est pas celui qu'on prélève. */
  const decision = decideCancellation({
    status: booking.status as Parameters<
      typeof decideCancellation
    >[0]["status"],
    grossAmountCents: booking.grossAmountCents,
    scheduledStart: start,
    now,
  });

  return (
    <li className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs tracking-overline text-muted-foreground uppercase">
        {upcoming ? "À venir" : "Passée"}
      </p>
      <p className="mt-1 text-lg font-extrabold first-letter:uppercase">
        {dayFormatter.format(start)} à {timeFormatter.format(start)}
      </p>
      <p className="mt-1 text-sm text-pretty text-muted-foreground">
        {booking.addressLabel} · {formatDuration(booking.durationMinutes)} ·{" "}
        {formatEuros(booking.grossAmountCents)}
      </p>

      {booking.cleaner ? (
        <p className="mt-3 flex items-center gap-3 text-sm">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-black text-teal-800"
          >
            {booking.cleaner.firstName.slice(0, 2).toUpperCase()}
          </span>
          <span>
            <strong className="font-extrabold">
              {booking.cleaner.firstName}
            </strong>
            {booking.cleaner.communeName
              ? ` · habite ${booking.cleaner.communeName}`
              : ""}
          </span>
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Intervenant confirmé sous 24 heures.
        </p>
      )}

      {upcoming ? (
        <>
          <a
            href={`data:text/calendar;charset=utf-8,${encodeURIComponent(booking.calendar)}`}
            download={bookingCalendarFilename(start)}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-border bg-card px-5 text-sm font-bold"
          >
            <CalendarPlusIcon className="size-4" aria-hidden />
            Ajouter à mon calendrier
          </a>

          {proposals.map((proposal) => (
            <PropositionCreneau key={proposal.id} proposal={proposal} />
          ))}

          <InterventionActions
            bookingId={booking.id}
            cancellable={decision.allowed}
            feeCents={decision.outcome.feeCents}
            refusalMessage={
              decision.refusal === null
                ? null
                : refusalMessage(decision.refusal)
            }
            hasCleaner={booking.cleaner !== null}
          />
        </>
      ) : null}
    </li>
  );
}

export default async function MonEspacePage() {
  const session = await auth();

  // Le proxy a déjà écarté les visiteurs sans cookie ; ce contrôle-ci est
  // celui qui fait foi, sur une session réellement validée.
  if (!session?.user?.id) {
    redirect("/connexion?callbackUrl=/mon-espace");
  }

  const [bookings, proposals, aNoter] = await Promise.all([
    loadClientBookings(),
    loadClientProposals(),
    chargerLesInterventionsANoter(),
  ]);
  const upcoming = bookings?.upcoming ?? [];
  const past = bookings?.past ?? [];
  // Une seule lecture de l'horloge pour toute la page : deux cartes rendues à
  // une seconde d'intervalle ne doivent pas tomber de part et d'autre d'un
  // palier du barème.
  const now = new Date();

  return (
    <>
      <SiteHeader variant="tunnel" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="font-heading text-3xl font-black tracking-tight">
          Mes sessions
        </h1>

        {/*
          La rangée de liens qui tenait ici — abonnement, notation, paiement,
          parrainage — est partie dans « Mon compte », accessible par la barre
          d'onglets. Quatre destinations administratives posées avant la
          première intervention faisaient lire un menu à quelqu'un qui venait
          voir une date.
        */}

        {/*
          Ce qu'on attend de la personne, avant ce qu'elle vient voir. Une note
          se donne dans les jours qui suivent ou jamais : la demander au moment
          où elle ouvre son espace est le seul moment où elle y pense encore.

          L'encart ne paraît que s'il reste quelque chose à noter, et il dit
          combien : « une intervention » se traite, « vos interventions » se
          remet à plus tard.
        */}
        {aNoter.length > 0 ? (
          <section className="mt-6 rounded-[var(--r-l)] border border-border bg-cream-50 p-5">
            <h2 className="font-extrabold">
              {aNoter.length === 1
                ? "Une intervention attend votre note"
                : `${aNoter.length} interventions attendent votre note`}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Deux gestes. C&apos;est ce qui permet de vous renvoyer la même
              personne.
            </p>
            <Link
              href="/mon-espace/noter"
              className="mt-4 inline-flex min-h-11 items-center rounded-full border-2 border-border bg-card px-5 text-sm font-bold transition-colors hover:border-teal-300 hover:bg-teal-50"
            >
              Noter{" "}
              {aNoter.length === 1 ? "l'intervention" : "mes interventions"}
            </Link>
          </section>
        ) : null}

        <h2 className="mt-8 text-lg font-extrabold">Prochaines</h2>
        {upcoming.length === 0 ? (
          /*
           * Un état vide sans issue est un bug. Celui-ci porte le geste, en
           * grand : c'est le seul écran de l'espace où la réservation est
           * l'action principale, puisqu'il n'y a rien d'autre à y faire.
           */
          <div className="mt-3 rounded-[var(--r-2xl)] bg-papaya-200 p-6 sm:p-8">
            <p className="font-heading text-xl font-extrabold text-balance">
              Aucune session prévue
            </p>
            <p className="mt-2 max-w-prose text-ink-800">
              Deux minutes suffisent, et vous retrouvez la même personne si elle
              est disponible.
            </p>
            <Link
              href="/reserver"
              className="mt-6 inline-flex min-h-12 items-center rounded-full bg-primary px-8 font-bold text-primary-foreground shadow-action transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-pineapple-400"
            >
              Réserver une session
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {upcoming.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                upcoming
                now={now}
                proposals={proposals.filter(
                  (proposal) => proposal.bookingId === booking.id,
                )}
              />
            ))}
          </ul>
        )}

        {past.length > 0 ? (
          <>
            <h2 className="mt-12 text-lg font-extrabold">Historique</h2>
            <ul className="mt-4 space-y-3">
              {past.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  upcoming={false}
                  now={now}
                  proposals={[]}
                />
              ))}
            </ul>
          </>
        ) : null}

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-lg font-extrabold">
            Le barème d&apos;annulation
          </h2>
          <p className="mt-2 text-pretty text-muted-foreground">
            Vous annulez depuis chaque intervention, en deux gestes, et le coût
            est annoncé avant que vous confirmiez. C&apos;est gratuit
            jusqu&apos;à {FREE_CANCELLATION_HOURS} heures avant. En deçà, le
            barème des conditions générales s&apos;applique, plafonné à chaque
            palier. Pour déplacer un rendez-vous plutôt que l&apos;annuler,
            appelez-nous : nous le faisons tout de suite.
          </p>
          {/* Le barème est lu depuis le module de tarification, jamais
              recopié : un montant affiché qui diffère de celui qu'on prélève
              est une promesse rompue. */}
          <dl className="mt-4 divide-y divide-border border-y border-border text-sm">
            {CANCELLATION_TIERS.map((tier) => (
              <div
                key={tier.label}
                className="flex justify-between gap-4 py-2.5"
              >
                <dt className="text-muted-foreground">{tier.label}</dt>
                <dd className="font-medium tabular-nums">
                  {tier.capCents === 0
                    ? "Gratuit"
                    : tier.rateBp === 0
                      ? formatEuros(tier.capCents)
                      : `${tier.rateBp / 100} %, plafonné à ${formatEuros(tier.capCents)}`}
                </dd>
              </div>
            ))}
          </dl>
          <ContactChannels className="mt-6 [&>div]:sm:justify-start" />
          <p className="mt-4 text-sm text-muted-foreground">
            Nous répondons du lundi au vendredi de 8 h à 19 h et le samedi de 9
            h à 13 h, au {SITE.phone}.
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
