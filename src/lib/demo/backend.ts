import type {
  BookingBackend,
  ConfirmationView,
  Frequency,
} from "@/lib/booking/backend";
import {
  BOOKING_HORIZON_DAYS,
  COMMUNE_TRAVEL_MARGIN_MINUTES,
} from "@/lib/booking/horizon";
import { bookingCalendar } from "@/lib/booking/ics";
import { searchAddresses } from "@/lib/geo/ban";
import { quote } from "@/lib/pricing";
import {
  MINIMUM_BILLABLE_MINUTES,
  PUBLIC_RATES,
  STANDARD_SQM_PER_HOUR,
  TAX_CREDIT_RATE_BP,
} from "@/lib/pricing/public-grid";
import { findSlots } from "@/lib/scheduling/slots";
import { getCommuneByInsee, isCoveredInsee } from "@/lib/territory";

import { demoCleanerCard, demoSchedules } from "./roster";

/**
 * Tunnel de réservation, entièrement dans le navigateur.
 *
 * Rien n'est simulé ici : les prix viennent du moteur de tarification, les
 * créneaux du moteur de disponibilité, et ce sont les mêmes fonctions qu'en
 * production. C'est possible parce qu'elles sont pures — c'est le bénéfice
 * concret d'avoir tenu cette contrainte depuis le début.
 *
 * Une seule chose manque, et c'est la seule qui exige un serveur : rien n'est
 * enregistré. La confirmation le dit, plutôt que de laisser croire qu'un
 * rendez-vous a été pris.
 */

const HORIZON_DAYS = BOOKING_HORIZON_DAYS;

/**
 * Marge de coordination de la grille, en points de base.
 *
 * Elle n'apparaît pas au client — il ne voit qu'un total — mais elle entre
 * dans le calcul du crédit d'impôt, qui se fait ligne par ligne.
 */
const DEMO_COMMISSION_RATE_BP = 3800;

function hourlyRateFor(frequency: Frequency): number {
  const key = frequency === "ONE_OFF" ? "PONCTUEL" : "REGULIER";
  const rate = PUBLIC_RATES.find((entry) => entry.key === key);
  if (!rate) {
    throw new Error(`Aucun tarif public pour la fréquence ${frequency}.`);
  }
  return rate.hourlyRateCents;
}

export const demoBookingBackend: BookingBackend = {
  async searchAddress({ query }) {
    // La Base Adresse Nationale autorise les requêtes navigateur : la
    // complétion d'adresse est donc réelle, même sans serveur.
    const results = await searchAddresses(query, { limit: 6 });
    return { ok: true, data: results };
  },

  getQuote({ surfaceSqm, frequency }) {
    const computed = quote({
      service: {
        slug: "menage-regulier",
        name: "Ménage régulier",
        sqmPerHour: STANDARD_SQM_PER_HOUR,
        minDurationMinutes: MINIMUM_BILLABLE_MINUTES,
      },
      options: [],
      surfaceSqm,
      frequency,
      hourlyRateCents: hourlyRateFor(frequency),
      commissionRateBp: DEMO_COMMISSION_RATE_BP,
      taxCreditRateBp: TAX_CREDIT_RATE_BP,
    });

    return Promise.resolve({
      ok: true,
      data: {
        durationMinutes: computed.durationMinutes,
        hourlyRateCents: computed.hourlyRateCents,
        grossAmountCents: computed.grossAmountCents,
        taxCreditAmountCents: computed.taxCreditAmountCents,
        netAmountCents: computed.netAmountCents,
      },
    });
  },

  getSlots({ lat, lng, inseeCode, durationMinutes, precision }) {
    if (!isCoveredInsee(inseeCode)) {
      return Promise.resolve({
        ok: false,
        code: "BUSINESS",
        error:
          `Léo Clean n'intervient pas encore à ` +
          `${getCommuneByInsee(inseeCode)?.name ?? "cette commune"}. Notre zone ` +
          `couvre seize communes au sud de Bordeaux.`,
      });
    }

    const now = new Date();
    const window = {
      start: now.getTime(),
      end: now.getTime() + HORIZON_DAYS * 86_400_000,
    };

    const slots = findSlots(demoSchedules(window), {
      window,
      durationMinutes,
      destination: { lat, lng },
      // Même prudence qu'en production tant que seule la commune est connue.
      travelMarginMinutes:
        precision === "commune" ? COMMUNE_TRAVEL_MARGIN_MINUTES : 0,
      now,
      limit: 60,
    });

    return Promise.resolve({
      ok: true,
      data: slots.map((slot) => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
      })),
    });
  },

  confirmBooking(input) {
    const start = new Date(input.startAt);
    const rate = hourlyRateFor(input.frequency);
    const computed = quote({
      service: {
        slug: "menage-regulier",
        name: "Ménage régulier",
        sqmPerHour: STANDARD_SQM_PER_HOUR,
        minDurationMinutes: MINIMUM_BILLABLE_MINUTES,
      },
      options: [],
      surfaceSqm: input.surfaceSqm,
      frequency: input.frequency,
      hourlyRateCents: rate,
      commissionRateBp: DEMO_COMMISSION_RATE_BP,
      taxCreditRateBp: TAX_CREDIT_RATE_BP,
    });

    const end = new Date(start.getTime() + computed.durationMinutes * 60_000);

    /*
     * L'intervenant est désigné par le même score qu'en production : on
     * rejoue la recherche sur l'adresse exacte et on retient le candidat dont
     * l'heure de départ est celle qui a été choisie. C'est ce qui permet à la
     * confirmation de montrer quelqu'un, et non une heure et un prix.
     */
    const window = { start: start.getTime() - 1, end: end.getTime() + 1 };
    const candidate = findSlots(demoSchedules(window), {
      window,
      durationMinutes: computed.durationMinutes,
      destination: { lat: input.lat, lng: input.lng },
      now: new Date(start.getTime() - 86_400_000),
      limit: 1,
    })[0];

    const cleaner = candidate
      ? demoCleanerCard(candidate.cleanerProfileId)
      : null;
    const addressLabel = `${input.street}, ${input.postalCode} ${input.cityName}`;

    const confirmation: ConfirmationView = {
      // L'identifiant annonce ce qu'il est : personne ne doit pouvoir le
      // confondre avec une réservation réelle, ni le chercher en base.
      bookingId: "demonstration",
      startAt: input.startAt,
      endAt: end.toISOString(),
      grossAmountCents: computed.grossAmountCents,
      netAmountCents: computed.netAmountCents,
      addressLabel,
      cleaner,
      calendar: bookingCalendar({
        bookingId: "demonstration",
        start,
        end,
        location: addressLabel,
        cleanerFirstName: cleaner?.firstName ?? null,
        stampedAt: new Date(),
      }),
    };

    return Promise.resolve({ ok: true, data: confirmation });
  },
};
