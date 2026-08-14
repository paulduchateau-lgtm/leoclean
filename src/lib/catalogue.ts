import "server-only";

import type { Frequency } from "@prisma/client";

import type { TenantClient } from "@/lib/db";
import { type Quote, type QuoteOption, quote } from "@/lib/pricing";

/**
 * Catalogue et devis.
 *
 * Trait d'union entre le moteur de tarification, qui est pur, et la base, qui
 * porte le catalogue et les tarifs. Toutes les lectures passent par un client
 * déjà cloisonné : une société ne voit jamais les prestations ni les tarifs
 * d'une autre, ce qui compte d'autant plus qu'elles se font concurrence sur le
 * même territoire.
 */

export interface CatalogueOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  extraMinutes: number;
  extraPriceCents: number;
}

export interface CatalogueService {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: string;
  sqmPerHour: number;
  minDurationMinutes: number;
  options: CatalogueOption[];
  /** Tarif horaire par fréquence, en vigueur à la date demandée. */
  hourlyRatesByFrequency: Partial<Record<Frequency, number>>;
  taxCreditRateBp: number;
}

const FREQUENCIES: readonly Frequency[] = [
  "ONE_OFF",
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
];

/**
 * Catalogue actif d'une organisation, tarifs inclus.
 *
 * `at` permet de se placer à une date donnée : un tarif est historisé par
 * `validFrom`/`validUntil`, et une page mise en cache ne doit pas afficher un
 * prix qui n'est pas encore entré en vigueur.
 */
export async function listServices(
  db: TenantClient,
  at: Date = new Date(),
): Promise<CatalogueService[]> {
  const services = await db.service.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      options: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      pricingRules: {
        where: {
          validFrom: { lte: at },
          OR: [{ validUntil: null }, { validUntil: { gt: at } }],
        },
        // Le tarif le plus récemment entré en vigueur l'emporte : c'est celui
        // qu'on retient lorsque plusieurs règles se chevauchent.
        orderBy: { validFrom: "desc" },
      },
    },
  });

  return services.map((service) => {
    const hourlyRatesByFrequency: Partial<Record<Frequency, number>> = {};
    let taxCreditRateBp = 5000;

    for (const frequency of FREQUENCIES) {
      const rule = service.pricingRules.find(
        (candidate) => candidate.frequency === frequency,
      );
      if (rule) {
        hourlyRatesByFrequency[frequency] = rule.hourlyRateCents;
        taxCreditRateBp = rule.taxCreditRateBp;
      }
    }

    return {
      id: service.id,
      slug: service.slug,
      name: service.name,
      description: service.description,
      kind: service.kind,
      sqmPerHour: service.sqmPerHour,
      minDurationMinutes: service.minDurationMinutes,
      options: service.options.map((option) => ({
        id: option.id,
        slug: option.slug,
        name: option.name,
        description: option.description,
        extraMinutes: option.extraMinutes,
        extraPriceCents: option.extraPriceCents,
      })),
      hourlyRatesByFrequency,
      taxCreditRateBp,
    };
  });
}

export async function getServiceBySlug(
  db: TenantClient,
  slug: string,
  at: Date = new Date(),
): Promise<CatalogueService | undefined> {
  const services = await listServices(db, at);
  return services.find((service) => service.slug === slug);
}

/** Tarif horaire d'une prestation pour une fréquence, à une date donnée. */
export async function resolveHourlyRate(
  db: TenantClient,
  serviceId: string,
  frequency: Frequency,
  at: Date = new Date(),
): Promise<{ hourlyRateCents: number; taxCreditRateBp: number }> {
  const rule = await db.pricingRule.findFirst({
    where: {
      serviceId,
      frequency,
      validFrom: { lte: at },
      OR: [{ validUntil: null }, { validUntil: { gt: at } }],
    },
    orderBy: { validFrom: "desc" },
  });

  if (!rule) {
    throw new Error(
      `Aucun tarif en vigueur pour cette prestation en fréquence ${frequency}. ` +
        `Le catalogue est incomplet : une réservation ne peut pas être chiffrée.`,
    );
  }

  return {
    hourlyRateCents: rule.hourlyRateCents,
    taxCreditRateBp: rule.taxCreditRateBp,
  };
}

export interface QuoteRequest {
  serviceSlug: string;
  optionSlugs: readonly string[];
  surfaceSqm: number;
  frequency: Frequency;
  durationOverrideMinutes?: number;
  at?: Date;
}

export interface CatalogueQuote extends Quote {
  serviceId: string;
  optionIds: string[];
}

/**
 * Chiffre une demande à partir du catalogue de l'organisation.
 *
 * Le devis affiché au client et les montants enregistrés proviennent de cet
 * unique appel : c'est ce qui garantit qu'on ne facture pas autre chose que ce
 * qui a été montré.
 */
export async function quoteFromCatalogue(
  db: TenantClient,
  organization: { commissionRateBp: number },
  request: QuoteRequest,
): Promise<CatalogueQuote> {
  const at = request.at ?? new Date();
  const service = await getServiceBySlug(db, request.serviceSlug, at);

  if (!service) {
    throw new Error(
      `La prestation « ${request.serviceSlug} » n'existe pas ou n'est plus proposée.`,
    );
  }

  const options = request.optionSlugs.map((slug) => {
    const option = service.options.find((candidate) => candidate.slug === slug);
    if (!option) {
      throw new Error(
        `L'option « ${slug} » n'est pas proposée avec la prestation « ${service.name} ».`,
      );
    }
    return option;
  });

  const { hourlyRateCents, taxCreditRateBp } = await resolveHourlyRate(
    db,
    service.id,
    request.frequency,
    at,
  );

  const quoteOptions: QuoteOption[] = options.map((option) => ({
    slug: option.slug,
    name: option.name,
    extraMinutes: option.extraMinutes,
    extraPriceCents: option.extraPriceCents,
  }));

  const computed = quote({
    service: {
      slug: service.slug,
      name: service.name,
      sqmPerHour: service.sqmPerHour,
      minDurationMinutes: service.minDurationMinutes,
    },
    options: quoteOptions,
    surfaceSqm: request.surfaceSqm,
    frequency: request.frequency,
    hourlyRateCents,
    commissionRateBp: organization.commissionRateBp,
    taxCreditRateBp,
    ...(request.durationOverrideMinutes !== undefined
      ? { durationOverrideMinutes: request.durationOverrideMinutes }
      : {}),
  });

  return {
    ...computed,
    serviceId: service.id,
    optionIds: options.map((option) => option.id),
  };
}

/**
 * Prix d'appel affiché sur les pages publiques : « à partir de … ».
 *
 * On prend le tarif le plus bas du catalogue, toutes prestations et fréquences
 * confondues. Cette phrase est reprise telle quelle par les moteurs et les
 * modèles de langage : elle doit être exacte et vérifiable sur le site.
 */
export function lowestHourlyRate(
  services: readonly CatalogueService[],
): number | undefined {
  const rates = services.flatMap((service) =>
    Object.values(service.hourlyRatesByFrequency),
  );
  return rates.length > 0 ? Math.min(...rates) : undefined;
}
