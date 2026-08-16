"use server";

import { z } from "zod";

import { publicAction } from "@/lib/action-result";
import type { CleanerCardView } from "@/lib/booking/backend";
import { bookingCalendar } from "@/lib/booking/ics";
import { createBooking, listAvailableSlots } from "@/lib/booking/create";
import { OutsideCoverageError } from "@/lib/booking/errors";
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
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { id: true, commissionRateBp: true },
  });

  const quote = await quoteFromCatalogue(
    forOrganization(organizationId),
    organization,
    {
      serviceSlug: SERVICE_SLUG,
      optionSlugs: input.optionSlugs,
      surfaceSqm: input.surfaceSqm,
      frequency: input.frequency,
    },
  );

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
  clientNotes: z.string().trim().max(1000).optional(),
});

/**
 * Fiche de l'intervenant désigné, telle que le client la découvre.
 *
 * On ne publie que le prénom d'affichage et la commune de résidence : c'est
 * ce qui rend vérifiable la promesse de proximité sans livrer l'adresse de
 * quelqu'un. La note n'est renvoyée que s'il existe des avis réels — annoncer
 * « 0 sur 5 » à une intervenante qui vient d'arriver serait faux et injuste.
 *
 * Une lecture qui échoue ne fait pas échouer la réservation : elle est déjà
 * écrite, et le client doit repartir avec son rendez-vous. On retombe alors
 * sur « intervenant confirmé sous 24 heures », qui est vrai dans tous les cas.
 */
async function cleanerCard(
  db: ReturnType<typeof forOrganization>,
  cleanerProfileId: string,
  now: Date,
): Promise<CleanerCardView | null> {
  try {
    const profile = await db.cleanerProfile.findUnique({
      where: { id: cleanerProfileId },
      select: {
        displayName: true,
        ratingAverage: true,
        ratingCount: true,
        activatedAt: true,
        createdAt: true,
        homeAddress: { select: { inseeCode: true, cityName: true } },
      },
    });
    if (!profile) return null;

    const since = profile.activatedAt ?? profile.createdAt;
    const months = Math.max(
      0,
      Math.floor((now.getTime() - since.getTime()) / (30 * 86_400_000)),
    );

    return {
      firstName: profile.displayName,
      // Le nom vient du référentiel quand l'INSEE y correspond : une valeur
      // saisie à la main dans une adresse n'a pas à s'afficher telle quelle.
      communeName:
        (profile.homeAddress
          ? getCommuneByInsee(profile.homeAddress.inseeCode)?.name
          : null) ??
        profile.homeAddress?.cityName ??
        null,
      seniorityMonths: months,
      ratingAverage: profile.ratingCount > 0 ? profile.ratingAverage : null,
      ratingCount: profile.ratingCount,
    };
  } catch (error) {
    console.error(
      "Fiche intervenant illisible après une réservation confirmée",
      error,
    );
    return null;
  }
}

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
    select: { id: true, commissionRateBp: true },
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
    const created = await createBooking(db, organization, {
      organizationId,
      clientProfileId: clientProfile.id,
      addressId: address.id,
      serviceSlug: SERVICE_SLUG,
      optionSlugs: input.optionSlugs,
      surfaceSqm: input.surfaceSqm,
      frequency: input.frequency,
      scheduledStart: new Date(input.startAt),
      clientNotes: input.clientNotes ?? null,
    });

    const cleaner = await cleanerCard(db, created.cleanerProfileId, now);
    const addressLabel = `${input.street}, ${input.postalCode} ${input.cityName}`;

    return {
      bookingId: created.bookingId,
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
        cleanerFirstName: cleaner?.firstName ?? null,
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
