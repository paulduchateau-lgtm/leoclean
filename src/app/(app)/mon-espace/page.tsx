import { CalendarPlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ContactChannels } from "@/components/contact-channels";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { auth } from "@/lib/auth/config";
import type { ClientBookingView } from "@/lib/booking/client-bookings";
import { loadClientBookings } from "@/lib/booking/client-bookings-session";
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
 * **Ce qui n'y est pas, et pourquoi.** La replanification et l'annulation en
 * autonomie ne sont pas proposées : elles supposent des transitions de statut,
 * une notification de l'intervenant et une reprise du créneau libéré, qui
 * n'existent pas encore. Un bouton « Annuler » qui n'annulerait rien serait
 * pire que son absence. Le barème est affiché, et l'annulation se fait par
 * téléphone ou par message — ce qui est le fonctionnement réel aujourd'hui.
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
}: {
  booking: ClientBookingView;
  upcoming: boolean;
}) {
  const start = new Date(booking.startAt);

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
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mint-100 text-xs font-black text-mint-800"
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
        <a
          href={`data:text/calendar;charset=utf-8,${encodeURIComponent(booking.calendar)}`}
          download={bookingCalendarFilename(start)}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-border bg-card px-5 text-sm font-bold"
        >
          <CalendarPlusIcon className="size-4" aria-hidden />
          Ajouter à mon calendrier
        </a>
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

  const bookings = await loadClientBookings();
  const upcoming = bookings?.upcoming ?? [];
  const past = bookings?.past ?? [];

  return (
    <>
      <SiteHeader variant="tunnel" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-black tracking-tight">Mes réservations</h1>
        <p className="mt-2 text-muted-foreground">{session.user.email}</p>

        <h2 className="mt-10 text-lg font-extrabold">Prochaines</h2>
        {upcoming.length === 0 ? (
          /* Un état vide sans issue est un bug : celui-ci dit ce qui manque et
             donne le geste qui le comble. */
          <div className="mt-3 rounded-xl border border-border bg-secondary/40 p-5">
            <p className="text-sm text-muted-foreground">
              Aucune intervention prévue pour le moment.
            </p>
            <Link
              href="/reserver"
              className="mt-4 inline-flex min-h-12 items-center rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-xs"
            >
              Réserver un ménage
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {upcoming.map((booking) => (
              <BookingCard key={booking.id} booking={booking} upcoming />
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
                />
              ))}
            </ul>
          </>
        ) : null}

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-lg font-extrabold">Modifier ou annuler</h2>
          <p className="mt-2 text-pretty text-muted-foreground">
            Cela se fait par téléphone ou par message, et nous nous en occupons
            tout de suite. L&apos;annulation est gratuite jusqu&apos;à{" "}
            {FREE_CANCELLATION_HOURS} heures avant l&apos;intervention. En deçà,
            le barème des conditions générales s&apos;applique, plafonné à
            chaque palier.
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
