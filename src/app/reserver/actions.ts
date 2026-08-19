"use server";

import { z } from "zod";

import { publicAction } from "@/lib/action-result";
import { ETAPES_TUNNEL, NOMS_EVENEMENTS } from "@/lib/analytics/evenements";
import { tracer } from "@/lib/analytics/journal";
import type { CleanerCardView } from "@/lib/booking/backend";
import { bookingCalendar } from "@/lib/booking/ics";
import { createBooking, listAvailableSlots } from "@/lib/booking/create";
import { sendMagicLink } from "@/lib/auth/magic-link";
import { getCurrentUser } from "@/lib/auth/session";
import {
  NoCleanerAvailableError,
  OutsideCoverageError,
} from "@/lib/booking/errors";
import {
  BOOKING_HORIZON_DAYS,
  COMMUNE_TRAVEL_MARGIN_MINUTES,
} from "@/lib/booking/horizon";
import { quoteFromCatalogue } from "@/lib/catalogue";
import { forOrganization, prisma } from "@/lib/db";
import { searchAddresses } from "@/lib/geo/ban";
import { marketplaceOrganizationId } from "@/lib/organizations";
import { isValidFrenchPhone, normalizePhone } from "@/lib/phone";
import { exigerQuota } from "@/lib/securite/limitation";
import { MINIMUM_BILLABLE_MINUTES } from "@/lib/pricing/public-grid";
import { getCommuneByInsee, isCoveredInsee } from "@/lib/territory";

/**
 * Tunnel de réservation.
 *
 * Quatre actions, dans l'ordre du parcours : trouver son adresse, chiffrer,
 * choisir une heure, confirmer. Chacune est ouverte — le client n'a pas de
 * compte avant la dernière — et chacune revalide tout ce qu'elle reçoit.
 *
 * **Rien de ce que renvoie le navigateur n'est cru sur parole.** Le prix est
 * recalculé côté serveur à la confirmation, jamais repris du formulaire : sans
 * quoi il suffirait d'éditer un champ caché pour acheter trois heures de
 * ménage à un euro. De même pour l'organisation, résolue côté serveur.
 */

const SERVICE_SLUG = "menage-regulier";

/** Fenêtre de recherche de créneaux, bornée à l'horizon de réservation. */
function bookingWindow(now: Date): { start: number; end: number } {
  return {
    start: now.getTime(),
    end: now.getTime() + BOOKING_HORIZON_DAYS * 86_400_000,
  };
}

// ---------------------------------------------------------------------------
// 1. Adresse
// ---------------------------------------------------------------------------

export const searchAddress = publicAction(
  z.object({ query: z.string().min(3).max(200) }),
  async ({ query }) => {
    const results = await searchAddresses(query, { limit: 6 });
    // On renvoie aussi les adresses hors zone : un client de Portets doit lire
    // « nous n'intervenons pas encore ici », pas une liste vide qui ressemble
    // à une panne de la recherche.
    return results.map((address) => ({
      banId: address.banId,
      label: address.label,
      street: address.street,
      postalCode: address.postalCode,
      cityName: address.cityName,
      inseeCode: address.inseeCode,
      lat: address.lat,
      lng: address.lng,
      isCovered: address.isCovered,
      isPreciseToHouseNumber: address.isPreciseToHouseNumber,
    }));
  },
);

// ---------------------------------------------------------------------------
// 2. Devis
// ---------------------------------------------------------------------------

const quoteSchema = z.object({
  surfaceSqm: z.coerce
    .number()
    .int()
    .min(15, "Indiquez une surface d'au moins 15 m².")
    .max(
      400,
      "Au-delà de 400 m², appelez-nous : nous organisons deux passages.",
    ),
  frequency: z.enum(["ONE_OFF", "WEEKLY", "BIWEEKLY", "MONTHLY"]),
  optionSlugs: z.array(z.string()).max(6).default([]),
});

export const getQuote = publicAction(quoteSchema, async (input) => {
  const organizationId = await marketplaceOrganizationId();

  const quote = await quoteFromCatalogue(forOrganization(organizationId), {
    serviceSlug: SERVICE_SLUG,
    optionSlugs: input.optionSlugs,
    surfaceSqm: input.surfaceSqm,
    frequency: input.frequency,
  });

  // Le client n'a pas à connaître la ventilation entre les deux factures avant
  // d'avoir réservé : elle apparaît sur les documents, pas dans le tunnel.
  return {
    durationMinutes: quote.durationMinutes,
    hourlyRateCents: quote.hourlyRateCents,
    grossAmountCents: quote.grossAmountCents,
    taxCreditAmountCents: quote.taxCreditAmountCents,
    netAmountCents: quote.netAmountCents,
  };
});

// ---------------------------------------------------------------------------
// 3. Créneaux
// ---------------------------------------------------------------------------

const slotsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  inseeCode: z.string().regex(/^\d{5}$/),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(MINIMUM_BILLABLE_MINUTES)
    .max(360),
  /**
   * Ce que désignent `lat` et `lng`.
   *
   * Le tunnel demande la commune avant l'adresse : les premiers créneaux sont
   * cherchés sur le centre de la commune, les suivants sur l'adresse exacte.
   * En mode commune, la recherche se donne une marge de trajet — mieux vaut ne
   * pas montrer un créneau tenable que d'en promettre un qui ne l'est pas.
   */
  precision: z.enum(["adresse", "commune"]).default("adresse"),
});

export const getSlots = publicAction(slotsSchema, async (input) => {
  /*
   * L'appel le plus coûteux du site : le moteur de disponibilité est
   * interrogé sur trois semaines. C'est aussi le plus tentant à marteler.
   */
  await exigerQuota("creneaux");

  if (!isCoveredInsee(input.inseeCode)) {
    // Le nom de la commune vient du référentiel, jamais du navigateur : c'est
    // ce qui garantit qu'un message affiché à l'écran ne peut pas être dicté
    // par la requête.
    throw new OutsideCoverageError(
      getCommuneByInsee(input.inseeCode)?.name ?? "cette commune",
    );
  }

  const organizationId = await marketplaceOrganizationId();
  const now = new Date();

  const slots = await listAvailableSlots(forOrganization(organizationId), {
    organizationId,
    destination: { lat: input.lat, lng: input.lng },
    durationMinutes: input.durationMinutes,
    window: bookingWindow(now),
    travelMarginMinutes:
      input.precision === "commune" ? COMMUNE_TRAVEL_MARGIN_MINUTES : 0,
    now,
    limit: 60,
  });

  /*
   * Une recherche sans résultat est à la fois une friction et un signal de
   * capacité : c'est le seul endroit du produit où l'on apprend qu'une commune
   * manque de monde à telle heure, et personne ne vient s'en plaindre.
   */
  void tracer(
    {
      nom: "creneaux_cherches",
      commune_insee: input.inseeCode,
      resultats: slots.length,
    },
    { organizationId },
  );

  // Seules les heures sortent d'ici. L'intervenant est déjà choisi par le
  // score, mais le client réserve un rendez-vous, pas une personne.
  return slots.map((slot) => ({
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
  }));
});

// ---------------------------------------------------------------------------
// 4. Confirmation
// ---------------------------------------------------------------------------

const confirmSchema = z.object({
  firstName: z.string().trim().min(2, "Merci d'indiquer votre prénom.").max(80),
  lastName: z.string().trim().min(2, "Merci d'indiquer votre nom.").max(80),
  email: z.email("Cette adresse email ne semble pas valide."),
  phone: z
    .string()
    .transform(normalizePhone)
    .refine(isValidFrenchPhone, "Exemple de format attendu : 06 12 34 56 78."),

  banId: z.string().max(60).optional(),
  street: z.string().trim().min(3).max(200),
  postalCode: z.string().regex(/^\d{5}$/),
  cityName: z.string().trim().min(2).max(120),
  inseeCode: z.string().regex(/^\d{5}$/),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accessNotes: z.string().trim().max(500).optional(),

  surfaceSqm: z.coerce.number().int().min(15).max(400),
  frequency: z.enum(["ONE_OFF", "WEEKLY", "BIWEEKLY", "MONTHLY"]),
  optionSlugs: z.array(z.string()).max(6).default([]),
  startAt: z.iso.datetime(),
  /**
   * Créneaux que le client accepte à défaut du sien, dans son ordre de
   * préférence.
   *
   * Ce n'est pas un confort : entre le moment où la liste s'affiche et celui
   * où le client confirme, une autre réservation peut prendre le créneau, et
   * la lecture des disponibilités ne voit pas les transactions en cours —
   * seule l'écriture les rencontre. Sans repli, ce client-là recommence tout
   * son parcours pour une place perdue à la dernière seconde.
   */
  alternateStarts: z.array(z.iso.datetime()).max(4).default([]),
  clientNotes: z.string().trim().max(1000).optional(),
});

export const confirmBooking = publicAction(confirmSchema, async (input) => {
  // Une réservation engage un intervenant : en enchaîner cinq en une heure
  // depuis la même source n'est pas un client pressé.
  await exigerQuota("reservation");

  if (!isCoveredInsee(input.inseeCode)) {
    throw new OutsideCoverageError(
      getCommuneByInsee(input.inseeCode)?.name ?? "cette commune",
    );
  }

  const organizationId = await marketplaceOrganizationId();
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { id: true },
  });
  const db = forOrganization(organizationId);
  const now = new Date();

  const email = input.email.trim().toLowerCase();

  /**
   * Le compte se crée à la réservation, pas avant.
   *
   * Exiger une inscription pour obtenir un prix est le moyen le plus sûr de
   * perdre un client sur un service qu'il n'a jamais essayé. L'accès à
   * l'espace personnel se fait ensuite par lien magique, sur cette même
   * adresse — il n'y a donc pas de mot de passe à choisir, ni à oublier.
   */
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: `${input.firstName} ${input.lastName}`.trim() },
    update: {},
    select: { id: true },
  });

  const clientProfile = await prisma.clientProfile.upsert({
    where: {
      organizationId_userId: { organizationId, userId: user.id },
    },
    create: { organizationId, userId: user.id, phone: input.phone },
    update: { phone: input.phone },
    select: { id: true },
  });

  const address = await db.address.create({
    data: {
      organizationId,
      clientProfileId: clientProfile.id,
      street: input.street,
      postalCode: input.postalCode,
      cityName: input.cityName,
      inseeCode: input.inseeCode,
      lat: input.lat,
      lng: input.lng,
      banId: input.banId ?? null,
      accessNotes: input.accessNotes ?? null,
    },
  });

  try {
    /*
     * Le créneau préféré d'abord, puis les replis dans l'ordre donné.
     *
     * On ne rattrape que `SlotTakenError` : c'est le seul refus qu'un autre
     * créneau peut résoudre. Une adresse hors zone ou un devis impossible
     * échoueraient de la même façon sur les quatre suivants, et les essayer
     * ne ferait que retarder un message que le client doit lire tout de suite.
     *
     * Les doublons sont écartés, faute de quoi un client qui aurait coché son
     * propre créneau préféré ferait tenter deux fois la même écriture.
     */
    const candidates = [
      input.startAt,
      ...input.alternateStarts.filter((start) => start !== input.startAt),
    ];

    let created: Awaited<ReturnType<typeof createBooking>> | null = null;
    let usedStart = input.startAt;

    for (const [index, start] of candidates.entries()) {
      try {
        created = await createBooking(db, organization, {
          organizationId,
          clientProfileId: clientProfile.id,
          addressId: address.id,
          serviceSlug: SERVICE_SLUG,
          optionSlugs: input.optionSlugs,
          surfaceSqm: input.surfaceSqm,
          frequency: input.frequency,
          scheduledStart: new Date(start),
          clientNotes: input.clientNotes ?? null,
        });
        usedStart = start;
        break;
      } catch (error) {
        /*
         * Ce n'est plus « créneau pris » qu'on rattrape mais « personne de
         * disponible » : une proposition ne réserve rien, il n'y a donc plus de
         * course à perdre à l'écriture. Le repli garde tout son sens — si
         * l'heure préférée ne trouve aucun intervenant, on essaie les suivantes
         * que le client a cochées.
         */
        const lastCandidate = index === candidates.length - 1;
        if (error instanceof NoCleanerAvailableError && !lastCandidate)
          continue;
        throw error;
      }
    }

    // La boucle sort par `break` ou relance : ce cas n'arrive pas, mais le
    // type ne le sait pas, et une assertion mentirait au prochain lecteur.
    if (created === null) throw new NoCleanerAvailableError();

    /*
     * Aucun intervenant n'est nommé sur l'écran de confirmation, et c'est
     * désormais structurel : la mission vient d'être proposée à cinq personnes,
     * aucune n'a encore accepté. Le tunnel retombe sur « nous vous confirmons
     * votre intervenant sous 24 heures », qui est exactement l'échéance du
     * premier lot.
     */
    const cleaner: CleanerCardView | null = null;
    const addressLabel = `${input.street}, ${input.postalCode} ${input.cityName}`;

    /*
     * Ouvrir l'espace client, sans ouvrir de session sur parole.
     *
     * Réserver ne prouve pas qu'on possède l'adresse saisie : ouvrir une
     * session d'office permettrait de réserver avec l'email d'un tiers et
     * d'atterrir dans son espace, avec son historique et ses adresses. Le lien
     * de connexion fait exactement le travail qui manque — il prouve la
     * possession de la boîte — et c'est déjà le mécanisme du dépôt partout
     * ailleurs.
     *
     * Il ne part que si personne n'est connecté : un client déjà identifié n'a
     * rien à recevoir, il lui suffit d'ouvrir son espace.
     *
     * L'échec de l'envoi ne fait pas échouer la réservation. Elle est écrite,
     * le client doit repartir avec son rendez-vous, et l'accès à l'espace
     * reste possible par le formulaire de connexion.
     */
    let accessLinkSent = false;
    const alreadySignedIn = (await getCurrentUser()) !== null;

    if (!alreadySignedIn) {
      try {
        await sendMagicLink({ email, callbackUrl: "/mon-espace" });
        accessLinkSent = true;
      } catch (error) {
        console.error(
          "Lien d'accès à l'espace client non envoyé après une réservation confirmée",
          error,
        );
      }
    }

    void tracer(
      {
        nom: "reservation_confirmee",
        commune_insee: input.inseeCode,
        frequence: input.frequency,
        montant_cents: created.grossAmountCents,
        /* Un repli retenu dit que le préféré est parti pendant la saisie. */
        repli_utilise: usedStart !== input.startAt,
      },
      { organizationId },
    );

    return {
      bookingId: created.bookingId,
      /** Le créneau préféré a été pris : c'est un repli qui a été retenu. */
      usedAlternate: usedStart !== input.startAt,
      /** Un lien d'accès à l'espace client vient de partir vers cette adresse. */
      accessLinkSent,
      accessLinkEmail: accessLinkSent ? email : null,
      startAt: created.scheduledStart.toISOString(),
      endAt: created.scheduledEnd.toISOString(),
      grossAmountCents: created.grossAmountCents,
      netAmountCents: created.netAmountCents,
      addressLabel,
      cleaner,
      calendar: bookingCalendar({
        bookingId: created.bookingId,
        start: created.scheduledStart,
        end: created.scheduledEnd,
        location: addressLabel,
        // Personne n'a encore accepté : le fichier d'agenda ne peut nommer
        // quiconque, et il annonce donc l'intervention seule.
        cleanerFirstName: null,
        stampedAt: now,
      }),
    };
  } catch (error) {
    // L'adresse vient d'être créée pour cette réservation : la laisser
    // derrière un échec encombrerait le carnet d'adresses du client d'entrées
    // qui ne correspondent à rien. L'échec de ce nettoyage ne doit pas
    // masquer l'erreur d'origine, qui est celle qui intéresse le client.
    await db.address
      .delete({ where: { id: address.id } })
      .catch(() => undefined);
    throw error;
  }
});

/**
 * Enregistrement d'un événement de parcours depuis le navigateur.
 *
 * Le seul émetteur qui a besoin d'un aller-retour : un changement d'écran du
 * tunnel se produit côté client et ne passe par aucune server action. Tout le
 * reste — demande de rappel, acceptation de mission, absence posée — s'écrit
 * directement côté serveur, là où l'événement se produit déjà.
 *
 * `publicAction` et non `authedAction` : la moitié du tunnel se déroule avant
 * toute authentification, et exiger une session ici reviendrait à ne mesurer
 * que la fin du parcours, c'est-à-dire précisément ce qu'on n'a pas besoin de
 * mesurer.
 *
 * L'organisation est résolue côté serveur, comme partout : une valeur envoyée
 * par le navigateur ne décide jamais dans quelle organisation une donnée
 * atterrit — pas même une mesure.
 */
export const tracerEtape = publicAction(
  z.object({
    nom: z.enum(NOMS_EVENEMENTS),
    etape: z.enum(ETAPES_TUNNEL).optional(),
    duree_ms: z
      .number()
      .int()
      .min(0)
      .max(6 * 60 * 60 * 1000)
      .optional(),
    parcours: z.string().max(40).optional(),
  }),
  async (input) => {
    const organizationId = await marketplaceOrganizationId();
    const user = await getCurrentUser();

    await tracer(
      {
        nom: input.nom,
        etape: input.etape,
        duree_ms: input.duree_ms,
      } as Parameters<typeof tracer>[0],
      {
        organizationId,
        journeyId: input.parcours ?? null,
        userId: user?.id ?? null,
      },
    );

    return { enregistre: true };
  },
);
