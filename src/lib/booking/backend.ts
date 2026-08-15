import type { ActionResult } from "@/lib/action-result";

/**
 * Ce dont le tunnel de réservation a besoin, et rien de plus.
 *
 * Le formulaire ne connaît pas la base : il connaît quatre opérations. C'est
 * ce qui permet de faire tourner exactement la même interface au-dessus de
 * deux implémentations — les server actions en production, un calcul dans le
 * navigateur pour la vitrine statique — sans dupliquer un seul écran.
 *
 * Les montants et les créneaux viennent toujours de l'implémentation, jamais
 * du composant : c'est la règle qui garantit qu'on ne facture pas autre chose
 * que ce qui a été montré.
 */

export interface AddressChoice {
  banId: string;
  label: string;
  street: string;
  postalCode: string;
  cityName: string;
  inseeCode: string;
  lat: number;
  lng: number;
  isCovered: boolean;
  isPreciseToHouseNumber: boolean;
}

export interface QuoteView {
  durationMinutes: number;
  hourlyRateCents: number;
  grossAmountCents: number;
  taxCreditAmountCents: number;
  netAmountCents: number;
}

export interface SlotView {
  start: string;
  end: string;
}

export interface ConfirmationView {
  bookingId: string;
  startAt: string;
  endAt: string;
  grossAmountCents: number;
  netAmountCents: number;
}

export type Frequency = "ONE_OFF" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

/**
 * Ce que le tunnel sait déjà d'un client connecté.
 *
 * Ces types vivent ici, avec le reste du contrat du tunnel, et non dans le
 * module serveur qui les remplit : l'écran doit pouvoir les typer sans
 * importer quoi que ce soit de `server-only`.
 *
 * Rien n'y est déduit du navigateur. L'ensemble est lu côté serveur, sur la
 * session, et transmis à l'écran — c'est la même règle que pour
 * l'organisation.
 */
export interface KnownAddress {
  banId: string;
  label: string;
  street: string;
  postalCode: string;
  cityName: string;
  inseeCode: string;
  lat: number;
  lng: number;
  accessNotes: string | null;
}

export interface KnownClient {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Adresses déjà employées, dédoublonnées, de la plus récente à la plus ancienne. */
  addresses: KnownAddress[];
  /** Dernier logement et dernier rythme réservés, s'il y en a un. */
  lastChoice: { surfaceSqm: number; frequency: Frequency } | null;
}

export interface ConfirmBookingInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  banId?: string;
  street: string;
  postalCode: string;
  cityName: string;
  inseeCode: string;
  lat: number;
  lng: number;
  accessNotes?: string;
  surfaceSqm: number;
  frequency: Frequency;
  optionSlugs: string[];
  startAt: string;
  clientNotes?: string;
}

export interface BookingBackend {
  searchAddress(input: {
    query: string;
  }): Promise<ActionResult<AddressChoice[]>>;

  getQuote(input: {
    surfaceSqm: number;
    frequency: Frequency;
    optionSlugs: string[];
  }): Promise<ActionResult<QuoteView>>;

  getSlots(input: {
    lat: number;
    lng: number;
    inseeCode: string;
    durationMinutes: number;
  }): Promise<ActionResult<SlotView[]>>;

  confirmBooking(
    input: ConfirmBookingInput,
  ): Promise<ActionResult<ConfirmationView>>;
}
