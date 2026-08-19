import type { ActionResult } from "@/lib/action-result";

/**
 * Ce dont le tunnel de réservation a besoin, et rien de plus.
 *
 * Le formulaire ne connaît pas la base : il connaît cinq opérations. C'est
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

/**
 * L'intervenant, tel que le client le découvre.
 *
 * « Le même intervenant, chaque semaine » est la promesse centrale du service,
 * et elle n'était jusqu'ici incarnée nulle part : le client repartait avec une
 * heure et un prix, sans savoir qui allait entrer chez lui. Le prénom, la
 * commune et l'ancienneté suffisent à en faire quelqu'un.
 *
 * Le nom de famille n'y figure pas, ni l'adresse : la commune de résidence est
 * ce qui rend vérifiable la promesse de proximité, la rue ne regarde personne.
 */
export interface CleanerCardView {
  /** Prénom d'affichage. Le nom complet n'est jamais publié. */
  firstName: string;
  /** Commune de résidence, quand elle est connue. */
  communeName: string | null;
  /** Ancienneté sur la plateforme, en mois révolus. */
  seniorityMonths: number;
  /** Note moyenne, seulement s'il existe des avis réels. */
  ratingAverage: number | null;
  ratingCount: number;
}

export interface ConfirmationView {
  bookingId: string;
  /**
   * Le créneau retenu n'est pas celui que le client préférait.
   *
   * Il est alors l'un de ceux qu'il avait déclarés acceptables : la
   * réservation reste ferme, mais l'écran de confirmation doit le dire. Une
   * heure différente de celle qu'on vient de choisir, découverte le jour
   * venu, vaudrait un rendez-vous manqué.
   */
  usedAlternate: boolean;
  /**
   * Un lien de connexion vient de partir vers l'adresse du client.
   *
   * Faux quand il était déjà connecté, ou quand l'envoi a échoué — l'échec ne
   * fait jamais échouer la réservation, qui est écrite.
   */
  accessLinkSent: boolean;
  /** Adresse destinataire du lien, pour pouvoir la rappeler à l'écran. */
  accessLinkEmail: string | null;
  startAt: string;
  endAt: string;
  grossAmountCents: number;
  netAmountCents: number;
  /** Adresse de l'intervention, telle qu'elle se lit. */
  addressLabel: string;
  /**
   * Intervenant désigné. `null` quand l'attribution n'a pas encore abouti :
   * on annonce alors une confirmation sous 24 heures plutôt que d'inventer
   * quelqu'un.
   */
  cleaner: CleanerCardView | null;
  /**
   * Fichier iCalendar de l'intervention, produit là où la réservation est
   * écrite. Le navigateur n'a plus qu'à le proposer au téléchargement — il
   * n'a rien à composer, donc rien à composer de faux.
   */
  calendar: string;
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
  /** Créneaux acceptés à défaut du préféré, dans l'ordre de préférence. */
  alternateStarts?: string[];
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
    /**
     * Ce que désignent `lat` et `lng`. Le tunnel demande la commune bien avant
     * l'adresse : en mode `commune`, la recherche se donne une marge de trajet
     * pour ne proposer que des créneaux qui tiendront à l'adresse exacte.
     */
    precision?: "adresse" | "commune";
  }): Promise<ActionResult<SlotView[]>>;

  confirmBooking(
    input: ConfirmBookingInput,
  ): Promise<ActionResult<ConfirmationView>>;

  /**
   * Enregistre un événement de parcours.
   *
   * Cinquième opération, et la seule qui n'apprend rien au client : son
   * résultat n'est jamais lu. Elle passe par le backend comme les autres parce
   * que la vitrine statique n'a pas de server action — sans quoi le tunnel
   * importerait un fichier que le build de démonstration écarte, et c'est le
   * typage qui casserait, pas l'export.
   *
   * Le retour est volontairement large : en production c'est une server
   * action, donc une promesse, et **seule une server action traverse la
   * frontière serveur/client** — une fonction ordinaire enveloppant l'appel
   * échouerait au rendu. Sur la vitrine, c'est une fonction synchrone qui ne
   * fait rien. L'appelant ignore l'un et l'autre.
   */
  tracerEtape(input: {
    nom: "tunnel_etape_vue" | "tunnel_etape_completee";
    etape: string;
    duree_ms?: number;
    parcours?: string;
  }): void | Promise<unknown>;
}
