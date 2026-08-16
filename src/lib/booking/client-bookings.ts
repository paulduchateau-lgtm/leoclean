import "server-only";

import type { CleanerCardView } from "@/lib/booking/backend";
import { bookingCalendar } from "@/lib/booking/ics";
import type { TenantClient } from "@/lib/db";
import { getCommuneByInsee } from "@/lib/territory";

/**
 * Les interventions d'un client, à venir et passées.
 *
 * **Pourquoi pas `requireOrganization`.** Un client de la marketplace n'a pas
 * de `Membership` — la réservation crée un `User` et un `ClientProfile`, pas
 * une appartenance. Exiger une appartenance ici ne protégerait rien, elle
 * rendrait la lecture impossible pour tout le monde. Ce qui tient lieu
 * d'autorisation est plus étroit : on ne lit que les lignes rattachées au
 * `ClientProfile` de la session, sur un client Prisma déjà cloisonné, et
 * personne ne peut désigner le profil qu'il lit. C'est le même raisonnement
 * que `known-client.ts`, écrit là-bas en toutes lettres.
 *
 * Le module reçoit un client cloisonné et une identité : il ne connaît ni
 * Auth.js ni la résolution d'organisation, ce qui le rend testable contre une
 * vraie base sans monter de session. Le liant vit dans
 * `client-bookings-session.ts`.
 */

/** Statuts qui ne décrivent plus un rendez-vous : ils n'ont rien à afficher. */
const HIDDEN_STATUSES = ["DRAFT", "CANCELLED_BY_CLIENT"] as const;

export interface ClientBookingView {
  id: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  grossAmountCents: number;
  status: string;
  /** Adresse de l'intervention, telle qu'elle se lit. */
  addressLabel: string;
  /** Intervenant désigné, quand l'attribution a abouti. */
  cleaner: CleanerCardView | null;
  /** Fichier iCalendar, produit ici — le navigateur n'a rien à composer. */
  calendar: string;
}

export interface ClientBookings {
  /** À venir, de la plus proche à la plus lointaine. */
  upcoming: ClientBookingView[];
  /** Passées, de la plus récente à la plus ancienne. */
  past: ClientBookingView[];
}

export async function readClientBookings(
  db: TenantClient,
  user: { id: string },
  now: Date,
): Promise<ClientBookings | null> {
  const profile = await db.clientProfile.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!profile) return null;

  const bookings = await db.booking.findMany({
    where: {
      clientProfileId: profile.id,
      status: { notIn: [...HIDDEN_STATUSES] },
    },
    orderBy: { scheduledStart: "desc" },
    // Un espace client n'est pas un export comptable : au-delà, la liste
    // cesse d'aider et la page cesse d'être rapide.
    take: 50,
    select: {
      id: true,
      status: true,
      scheduledStart: true,
      scheduledEnd: true,
      durationMinutes: true,
      grossAmountCents: true,
      address: {
        select: { street: true, postalCode: true, cityName: true },
      },
      assignments: {
        /*
         * Une réservation peut porter plusieurs affectations au fil de ses
         * refus : celle qui compte est la dernière posée et non terminale.
         */
        where: { status: { notIn: ["DECLINED", "CANCELLED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          cleaner: {
            select: {
              displayName: true,
              ratingAverage: true,
              ratingCount: true,
              activatedAt: true,
              createdAt: true,
              homeAddress: { select: { inseeCode: true, cityName: true } },
            },
          },
        },
      },
    },
  });

  const views = bookings.map((booking): ClientBookingView => {
    const addressLabel = `${booking.address.street}, ${booking.address.postalCode} ${booking.address.cityName}`;
    const profile = booking.assignments[0]?.cleaner ?? null;

    const cleaner: CleanerCardView | null = profile
      ? {
          firstName: profile.displayName,
          communeName:
            (profile.homeAddress
              ? getCommuneByInsee(profile.homeAddress.inseeCode)?.name
              : null) ??
            profile.homeAddress?.cityName ??
            null,
          seniorityMonths: Math.max(
            0,
            Math.floor(
              (now.getTime() -
                (profile.activatedAt ?? profile.createdAt).getTime()) /
                (30 * 86_400_000),
            ),
          ),
          // Même règle que le JSON-LD : pas de note sans avis réels.
          ratingAverage: profile.ratingCount > 0 ? profile.ratingAverage : null,
          ratingCount: profile.ratingCount,
        }
      : null;

    return {
      id: booking.id,
      startAt: booking.scheduledStart.toISOString(),
      endAt: booking.scheduledEnd.toISOString(),
      durationMinutes: booking.durationMinutes,
      grossAmountCents: booking.grossAmountCents,
      status: booking.status,
      addressLabel,
      cleaner,
      calendar: bookingCalendar({
        bookingId: booking.id,
        start: booking.scheduledStart,
        end: booking.scheduledEnd,
        location: addressLabel,
        cleanerFirstName: cleaner?.firstName ?? null,
        stampedAt: now,
      }),
    };
  });

  return {
    // Le partage se fait sur la fin de l'intervention, pas sur son début : un
    // ménage en cours reste « à venir » pour qui le regarde depuis son salon.
    upcoming: views.filter((view) => new Date(view.endAt) >= now).reverse(),
    past: views.filter((view) => new Date(view.endAt) < now),
  };
}
