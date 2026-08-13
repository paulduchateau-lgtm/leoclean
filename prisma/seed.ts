/**
 * Jeu de données de développement.
 *
 * L'objectif n'est pas d'avoir « des données » mais un territoire crédible :
 * trois organisations qui se font concurrence sur les mêmes communes, douze
 * intervenants aux plannings réellement remplis, des adresses situées sur de
 * vraies voies, et soixante réservations réparties sur tous les statuts du
 * cycle de vie. C'est ce qui permet de développer le moteur d'attribution et
 * les pages locales sans découvrir les cas limites en production.
 *
 * Le tirage est pseudo-aléatoire mais déterministe : deux exécutions produisent
 * le même jeu, ce qui rend les captures d'écran et les tests reproductibles.
 * Seul l'ancrage temporel bouge — les réservations sont positionnées autour du
 * jour d'exécution, pour que « la tournée du jour » ait toujours du contenu.
 */

import "dotenv/config";

import {
  type AssignmentStatus,
  type BookingStatus,
  type Prisma,
  PrismaClient,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { STREETS_BY_INSEE, type SeedStreet } from "./fixtures/streets";
import { COMMUNES, type Commune } from "../src/lib/territory";
import { parisDayMinuteToUtc, utcToParisWallClock } from "../src/lib/time";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL est requise pour exécuter le seed.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// ---------------------------------------------------------------------------
// Tirage déterministe
// ---------------------------------------------------------------------------

/** Générateur mulberry32 : court, correct, et surtout reproductible. */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(33850);

function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) {
    throw new Error("Tirage dans une liste vide.");
  }
  return item;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

// ---------------------------------------------------------------------------
// Données éditoriales
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "Sophie",
  "Karim",
  "Nadia",
  "Élodie",
  "Mathieu",
  "Fatima",
  "Laurent",
  "Céline",
  "Jean-Marc",
  "Amandine",
  "Bruno",
  "Sandrine",
  "Patrick",
  "Isabelle",
  "Hervé",
  "Marion",
  "Thierry",
  "Valérie",
  "Nicolas",
  "Corinne",
  "Émilie",
  "Damien",
  "Nathalie",
  "Olivier",
  "Christelle",
  "Pascal",
  "Sylvie",
  "Frédéric",
  "Aurélie",
  "Vincent",
  "Béatrice",
  "Alexandre",
] as const;

const LAST_NAMES = [
  "Dubourg",
  "Lafitte",
  "Mérignac",
  "Cazaux",
  "Duhamel",
  "Bardin",
  "Peyrot",
  "Lasserre",
  "Bonnet",
  "Fontaine",
  "Marchand",
  "Gauthier",
  "Rey",
  "Vidal",
  "Sarrazin",
  "Loubet",
  "Castaing",
  "Dupuy",
  "Barrière",
  "Ferran",
] as const;

const CLEANER_BIOS = [
  "Dix ans de ménage chez des particuliers dans les Graves. J'habite à {commune}, je connais chaque quartier.",
  "Je travaille sur le secteur depuis 2019. Ponctuelle, discrète, et je laisse toujours un mot en partant.",
  "Ancienne aide à domicile, installée à {commune}. J'aime le travail bien fait et les habitudes qu'on prend ensemble.",
  "Je m'occupe surtout de maisons familiales. Repassage compris si besoin, et je suis à l'aise avec les animaux.",
  "Habitante de {commune} depuis toujours. Je me déplace en voiture sur toute la Communauté de communes.",
  "Je privilégie les produits écologiques et je m'adapte à ceux que vous utilisez déjà.",
] as const;

const REVIEW_COMMENTS = [
  "Ponctuelle et très soigneuse. La maison est impeccable, on a pris un abonnement dans la foulée.",
  "Rien à redire, c'est toujours la même personne qui vient et c'est exactement ce qu'on cherchait.",
  "Très bon travail sur les vitres, ce que je n'arrivais jamais à faire correctement.",
  "Sérieuse et discrète. Elle a même pensé à refermer le portail, ce qui compte quand on a un chien.",
  "Intervention rapide après notre déménagement à {commune}. L'appartement était nickel pour l'état des lieux.",
  "Un peu en retard une fois à cause de la circulation sur la D651, mais prévenue à l'avance. Rien de gênant.",
  "Excellent rapport qualité-prix, surtout avec le crédit d'impôt.",
  "Trois mois que ça dure, toujours au rendez-vous. Je recommande sans hésiter.",
] as const;

const ACCESS_NOTES = [
  "Portail à gauche, le digicode est communiqué la veille.",
  "Clé chez la voisine du 12 en cas d'absence.",
  "Chien très gentil mais qui aboie à l'arrivée.",
  "Stationnement possible dans l'allée.",
  "Merci de bien refermer le portail en partant.",
  null,
  null,
  null,
] as const;

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

interface ServiceSeed {
  slug: string;
  name: string;
  kind:
    "MENAGE_REGULIER" | "GRAND_MENAGE" | "REPASSAGE" | "VITRES" | "FIN_DE_BAIL";
  description: string;
  sqmPerHour: number;
  minDurationMinutes: number;
  options: {
    slug: string;
    name: string;
    description: string;
    extraMinutes: number;
  }[];
}

const CATALOGUE: ServiceSeed[] = [
  {
    slug: "menage-regulier",
    name: "Ménage régulier",
    kind: "MENAGE_REGULIER",
    description:
      "Entretien complet du logement : sols, sanitaires, cuisine, poussière et rangement léger.",
    sqmPerHour: 25,
    minDurationMinutes: 120,
    options: [
      {
        slug: "repassage",
        name: "Repassage",
        description: "Une corbeille de linge repassée et pliée.",
        extraMinutes: 60,
      },
      {
        slug: "vitres",
        name: "Nettoyage des vitres",
        description:
          "Vitres accessibles, intérieur et extérieur de plain-pied.",
        extraMinutes: 30,
      },
      {
        slug: "four",
        name: "Nettoyage du four",
        description: "Dégraissage complet du four et de la plaque.",
        extraMinutes: 30,
      },
      {
        slug: "refrigerateur",
        name: "Nettoyage du réfrigérateur",
        description: "Vidage, nettoyage et désinfection des clayettes.",
        extraMinutes: 30,
      },
    ],
  },
  {
    slug: "grand-menage",
    name: "Grand ménage",
    kind: "GRAND_MENAGE",
    description:
      "Remise à neuf en profondeur : plinthes, intérieur des placards, électroménager, traces et calcaire.",
    sqmPerHour: 15,
    minDurationMinutes: 180,
    options: [
      {
        slug: "placards",
        name: "Intérieur des placards",
        description: "Vidage et nettoyage de l'intérieur des rangements.",
        extraMinutes: 60,
      },
      {
        slug: "terrasse",
        name: "Terrasse et mobilier de jardin",
        description: "Balayage, lavage de la terrasse et du salon de jardin.",
        extraMinutes: 45,
      },
    ],
  },
  {
    slug: "fin-de-bail",
    name: "Ménage de fin de bail",
    kind: "FIN_DE_BAIL",
    description:
      "Nettoyage complet avant état des lieux de sortie, conforme aux attentes des agences.",
    sqmPerHour: 12,
    minDurationMinutes: 240,
    options: [
      {
        slug: "vitres-completes",
        name: "Vitrerie complète",
        description: "Toutes les vitres, encadrements et rails compris.",
        extraMinutes: 90,
      },
    ],
  },
  {
    slug: "repassage-seul",
    name: "Repassage à domicile",
    kind: "REPASSAGE",
    description: "Repassage et pliage de votre linge, chez vous.",
    sqmPerHour: 100,
    minDurationMinutes: 120,
    options: [],
  },
];

/** Tarif horaire en centimes, par fréquence. Voir CLAUDE.md. */
const HOURLY_RATES: Record<
  "ONE_OFF" | "WEEKLY" | "BIWEEKLY" | "MONTHLY",
  number
> = {
  ONE_OFF: 3200,
  WEEKLY: 2700,
  BIWEEKLY: 2900,
  MONTHLY: 2900,
};

const TAX_CREDIT_RATE_BP = 5000;

// ---------------------------------------------------------------------------
// Créneaux
// ---------------------------------------------------------------------------

/**
 * Créneaux de la journée, en minutes depuis minuit, heure locale.
 *
 * Ils sont espacés d'au moins trente minutes pour laisser passer le tampon de
 * trajet : la contrainte d'exclusion en base rejetterait des missions dont les
 * plages élargies se chevauchent, et un seed qui ne respecte pas ses propres
 * règles métier n'aurait aucune valeur.
 */
const DAY_SLOTS = [
  { start: 8 * 60, duration: 120 },
  { start: 11 * 60, duration: 120 },
  { start: 14 * 60 + 30, duration: 150 },
] as const;

const TRAVEL_BUFFER_MINUTES = 25;

function dayParts(offsetDays: number): {
  year: number;
  month: number;
  day: number;
} {
  const base = new Date();
  base.setUTCHours(12, 0, 0, 0);
  const shifted = new Date(base.getTime() + offsetDays * 86_400_000);
  const wall = utcToParisWallClock(shifted);
  return { year: wall.year, month: wall.month, day: wall.day };
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

interface OrganizationSeed {
  slug: string;
  name: string;
  type: "MARKETPLACE" | "COMPANY";
  legalName: string;
  tagline: string;
  description: string;
  commune: Commune;
  commissionRateBp: number;
  cleanerCount: number;
  clientCount: number;
  isPubliclyBookable: boolean;
}

function communeBySlug(slug: string): Commune {
  const commune = COMMUNES.find((c) => c.slug === slug);
  if (!commune) {
    throw new Error(`Commune inconnue dans le référentiel : ${slug}`);
  }
  return commune;
}

const ORGANIZATIONS: OrganizationSeed[] = [
  {
    slug: "leoclean",
    name: "LéoClean",
    type: "MARKETPLACE",
    legalName: "LéoClean SAS",
    tagline: "Le ménage à domicile, par des gens d'ici",
    description:
      "LéoClean met en relation des particuliers de la Communauté de communes de Montesquieu avec des intervenants indépendants qui habitent le territoire.",
    commune: communeBySlug("leognan"),
    commissionRateBp: 2500,
    cleanerCount: 8,
    clientCount: 26,
    isPubliclyBookable: true,
  },
  {
    slug: "net-des-graves",
    name: "Net des Graves",
    type: "COMPANY",
    legalName: "Net des Graves SARL",
    tagline: "Entreprise de ménage familiale à La Brède depuis 2011",
    description:
      "Net des Graves est une société de ménage installée à La Brède, qui emploie ses propres agents d'entretien et intervient chez les particuliers et les professionnels du secteur.",
    commune: communeBySlug("la-brede"),
    commissionRateBp: 1200,
    cleanerCount: 2,
    clientCount: 9,
    isPubliclyBookable: true,
  },
  {
    slug: "ateliers-du-propre",
    name: "Les Ateliers du Propre",
    type: "COMPANY",
    legalName: "Les Ateliers du Propre SARL",
    tagline: "Ménage et remise en état à Cadaujac",
    description:
      "Les Ateliers du Propre interviennent à Cadaujac et alentour, avec une spécialité de remise en état après travaux et de ménage de fin de bail.",
    commune: communeBySlug("cadaujac"),
    commissionRateBp: 1200,
    cleanerCount: 2,
    clientCount: 7,
    isPubliclyBookable: false,
  },
];

function streetsFor(commune: Commune): readonly SeedStreet[] {
  const streets = STREETS_BY_INSEE[commune.insee];
  if (!streets || streets.length === 0) {
    throw new Error(
      `Aucune voie connue pour ${commune.name} (${commune.insee}).`,
    );
  }
  return streets;
}

/** Jitter de quelques dizaines de mètres autour du point de la voie. */
function jitter(value: number): number {
  return Number((value + (random() - 0.5) * 0.0016).toFixed(6));
}

function addressData(
  commune: Commune,
  organizationId: string,
  clientProfileId: string | null,
): Prisma.AddressUncheckedCreateInput {
  const street = pick(streetsFor(commune));
  return {
    organizationId,
    clientProfileId,
    street: `${randomInt(1, 84)} ${street.street}`,
    postalCode: commune.postalCode,
    cityName: commune.name,
    inseeCode: commune.insee,
    lat: jitter(street.lat),
    lng: jitter(street.lng),
    banId: street.banId,
    accessNotes: pick(ACCESS_NOTES),
    hasElevator: random() < 0.15 ? true : null,
  };
}

async function main(): Promise<void> {
  console.log("Nettoyage des tables…");
  const tables = [
    "AuditLog",
    "WebhookEvent",
    "Lead",
    "Message",
    "Review",
    "Invoice",
    "Payout",
    "Payment",
    "Assignment",
    "BookingStatusEvent",
    "BookingItem",
    "Booking",
    "Subscription",
    "ExternalBusyBlock",
    "CalendarConnection",
    "AvailabilityException",
    "AvailabilityRule",
    "PricingRule",
    "ServiceOption",
    "Service",
    "CleanerDocument",
    "Address",
    "CleanerProfile",
    "ClientProfile",
    "Membership",
    "Session",
    "Account",
    "VerificationToken",
    "TravelTimeCache",
    "User",
    "Organization",
  ];
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`,
  );

  let bookingsCreated = 0;
  let assignmentsCreated = 0;
  const targetBookings = 60;

  for (const orgSeed of ORGANIZATIONS) {
    console.log(`\nOrganisation : ${orgSeed.name}`);

    const organization = await prisma.organization.create({
      data: {
        slug: orgSeed.slug,
        name: orgSeed.name,
        type: orgSeed.type,
        status: "ACTIVE",
        legalName: orgSeed.legalName,
        tagline: orgSeed.tagline,
        description: orgSeed.description,
        commissionRateBp: orgSeed.commissionRateBp,
        isPubliclyBookable: orgSeed.isPubliclyBookable,
        publicEmail: `contact@${orgSeed.slug}.fr`,
      },
    });

    // --- Catalogue ---------------------------------------------------------
    const services: {
      id: string;
      slug: string;
      minDurationMinutes: number;
      sqmPerHour: number;
    }[] = [];
    for (const [index, serviceSeed] of CATALOGUE.entries()) {
      const service = await prisma.service.create({
        data: {
          organizationId: organization.id,
          slug: serviceSeed.slug,
          name: serviceSeed.name,
          kind: serviceSeed.kind,
          description: serviceSeed.description,
          sqmPerHour: serviceSeed.sqmPerHour,
          minDurationMinutes: serviceSeed.minDurationMinutes,
          sortOrder: index,
          options: {
            create: serviceSeed.options.map((option, optionIndex) => ({
              organizationId: organization.id,
              slug: option.slug,
              name: option.name,
              description: option.description,
              extraMinutes: option.extraMinutes,
              sortOrder: optionIndex,
            })),
          },
        },
      });
      services.push({
        id: service.id,
        slug: service.slug,
        minDurationMinutes: service.minDurationMinutes,
        sqmPerHour: service.sqmPerHour,
      });

      for (const [frequency, rate] of Object.entries(HOURLY_RATES)) {
        await prisma.pricingRule.create({
          data: {
            organizationId: organization.id,
            serviceId: service.id,
            frequency: frequency as keyof typeof HOURLY_RATES,
            // Le grand ménage et la fin de bail sont plus exigeants : ils se
            // facturent quelques euros de plus de l'heure.
            hourlyRateCents:
              serviceSeed.kind === "MENAGE_REGULIER" ||
              serviceSeed.kind === "REPASSAGE"
                ? rate
                : rate + 400,
            taxCreditRateBp: TAX_CREDIT_RATE_BP,
          },
        });
      }
    }

    // --- Propriétaire de l'organisation ------------------------------------
    const ownerUser = await prisma.user.create({
      data: {
        email: `direction@${orgSeed.slug}.fr`,
        name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        emailVerified: new Date(),
      },
    });
    await prisma.membership.create({
      data: {
        userId: ownerUser.id,
        organizationId: organization.id,
        role: orgSeed.type === "MARKETPLACE" ? "PLATFORM_ADMIN" : "ORG_OWNER",
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
    });

    // --- Intervenants ------------------------------------------------------
    const cleaners: { id: string; homeCommune: Commune }[] = [];
    for (let i = 0; i < orgSeed.cleanerCount; i += 1) {
      const firstName =
        FIRST_NAMES[(i * 3 + orgSeed.slug.length) % FIRST_NAMES.length]!;
      const homeCommune =
        orgSeed.type === "MARKETPLACE" ? pick(COMMUNES) : orgSeed.commune;

      const user = await prisma.user.create({
        data: {
          email: `${firstName.toLowerCase().replace(/[^a-z]/g, "")}.${i}@${orgSeed.slug}.fr`,
          name: `${firstName} ${pick(LAST_NAMES)}`,
          emailVerified: new Date(),
        },
      });
      await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: "CLEANER",
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
      });

      // Un intervenant sur huit reste en attente de vérification : l'écran
      // d'administration doit avoir de quoi travailler.
      const pending =
        i === orgSeed.cleanerCount - 1 && orgSeed.type === "MARKETPLACE";

      const cleaner = await prisma.cleanerProfile.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          displayName: firstName,
          bio: pick(CLEANER_BIOS).replace("{commune}", homeCommune.name),
          status: pending ? "PENDING_VERIFICATION" : "ACTIVE",
          employmentType:
            orgSeed.type === "MARKETPLACE" ? "INDEPENDENT" : "EMPLOYEE",
          siret:
            orgSeed.type === "MARKETPLACE"
              ? `${randomInt(10000000, 99999999)}00019`
              : null,
          payoutsEnabled: !pending && orgSeed.type === "MARKETPLACE",
          maxTravelMinutes: pick([20, 25, 30, 35]),
          activatedAt: pending ? null : new Date(),
        },
      });

      const home = await prisma.address.create({
        data: {
          ...addressData(homeCommune, organization.id, null),
          label: "Domicile",
          accessNotes: null,
        },
      });
      await prisma.cleanerProfile.update({
        where: { id: cleaner.id },
        data: { homeAddressId: home.id },
      });

      // Documents de vérification.
      for (const type of [
        "SIRET",
        "INSURANCE_RC_PRO",
        "IDENTITY",
        "BANK_DETAILS",
      ] as const) {
        if (orgSeed.type !== "MARKETPLACE" && type === "SIRET") continue;
        await prisma.cleanerDocument.create({
          data: {
            organizationId: organization.id,
            cleanerProfileId: cleaner.id,
            type,
            status: pending ? "PENDING" : "APPROVED",
            fileUrl: `https://exemple.invalid/documents/${cleaner.id}/${type.toLowerCase()}.pdf`,
            verifiedAt: pending ? null : new Date(),
            expiresAt:
              type === "INSURANCE_RC_PRO"
                ? new Date(Date.now() + randomInt(30, 400) * 86_400_000)
                : null,
          },
        });
      }

      // Disponibilités déclarées : du lundi au vendredi, plus un samedi matin
      // pour une partie des intervenants.
      for (let weekday = 1; weekday <= 5; weekday += 1) {
        await prisma.availabilityRule.create({
          data: {
            organizationId: organization.id,
            cleanerProfileId: cleaner.id,
            weekday,
            startMinute: pick([8 * 60, 8 * 60 + 30, 9 * 60]),
            endMinute: pick([17 * 60, 17 * 60 + 30, 18 * 60]),
          },
        });
      }
      if (random() < 0.4) {
        await prisma.availabilityRule.create({
          data: {
            organizationId: organization.id,
            cleanerProfileId: cleaner.id,
            weekday: 6,
            startMinute: 9 * 60,
            endMinute: 13 * 60,
          },
        });
      }

      if (!pending) {
        cleaners.push({ id: cleaner.id, homeCommune });
      }

      // Deux intervenants de la marketplace ont connecté leur agenda
      // personnel, dont un en erreur : l'écran d'état de santé doit pouvoir
      // montrer les deux cas.
      if (orgSeed.type === "MARKETPLACE" && i < 2) {
        const broken = i === 1;
        const connection = await prisma.calendarConnection.create({
          data: {
            organizationId: organization.id,
            cleanerProfileId: cleaner.id,
            provider: "GOOGLE",
            status: broken ? "NEEDS_RECONSENT" : "HEALTHY",
            externalAccountEmail: `${firstName.toLowerCase()}.perso@exemple.invalid`,
            externalCalendarId: "primary",
            syncCursor: broken ? null : `jeton-de-synchro-${i}`,
            lastSyncAt: broken
              ? new Date(Date.now() - 5 * 86_400_000)
              : new Date(Date.now() - 900_000),
            lastErrorAt: broken ? new Date(Date.now() - 5 * 86_400_000) : null,
            lastErrorMessage: broken
              ? "invalid_grant : l'accès a été révoqué depuis le compte Google."
              : null,
            consecutiveFailures: broken ? 7 : 0,
            pushExpiresAt: broken
              ? null
              : new Date(Date.now() + 6 * 86_400_000),
          },
        });

        // Occupations personnelles importées : uniquement des plages, jamais
        // le contenu des événements.
        for (let b = 0; b < 3; b += 1) {
          const day = dayParts(randomInt(1, 12));
          const startMinute = pick([9 * 60, 13 * 60, 16 * 60]);
          await prisma.externalBusyBlock.create({
            data: {
              organizationId: organization.id,
              cleanerProfileId: cleaner.id,
              calendarConnectionId: connection.id,
              startAt: parisDayMinuteToUtc(day, startMinute),
              endAt: parisDayMinuteToUtc(day, startMinute + 90),
              externalEventId: `evt-${cleaner.id}-${b}`,
            },
          });
        }
      }
    }

    // --- Clients -----------------------------------------------------------
    const clients: { id: string; addressId: string; commune: Commune }[] = [];
    for (let i = 0; i < orgSeed.clientCount; i += 1) {
      const commune =
        orgSeed.type === "MARKETPLACE"
          ? COMMUNES[i % COMMUNES.length]!
          : pick([orgSeed.commune, ...COMMUNES.slice(0, 4)]);

      const user = await prisma.user.create({
        data: {
          email: `client${i}@${orgSeed.slug}.exemple.invalid`,
          name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
          emailVerified: new Date(),
        },
      });
      await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: "CLIENT",
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
      });
      const clientProfile = await prisma.clientProfile.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          phone: `05 56 ${randomInt(10, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)}`,
        },
      });
      const address = await prisma.address.create({
        data: addressData(commune, organization.id, clientProfile.id),
      });

      clients.push({ id: clientProfile.id, addressId: address.id, commune });
    }

    // --- Abonnements : le cas nominal --------------------------------------
    const subscriptions: {
      id: string;
      clientIndex: number;
      cleanerId: string;
    }[] = [];
    const subscriptionCount = orgSeed.type === "MARKETPLACE" ? 9 : 3;
    for (let i = 0; i < subscriptionCount && i < clients.length; i += 1) {
      const client = clients[i]!;
      const cleaner = cleaners[i % cleaners.length]!;
      const service = services[0]!;
      const frequency = pick(["WEEKLY", "BIWEEKLY", "MONTHLY"] as const);

      const subscription = await prisma.subscription.create({
        data: {
          organizationId: organization.id,
          clientProfileId: client.id,
          addressId: client.addressId,
          serviceId: service.id,
          frequency,
          weekday: randomInt(1, 5),
          startMinute: pick(DAY_SLOTS).start,
          durationMinutes: pick([120, 150, 180]),
          weekOfMonth: frequency === "MONTHLY" ? randomInt(1, 4) : null,
          anchorDate: new Date(Date.now() - randomInt(30, 180) * 86_400_000),
          // L'intervenant attitré : c'est lui que le moteur privilégiera
          // absolument sur cet abonnement.
          preferredCleanerId: cleaner.id,
          status: i === subscriptionCount - 1 ? "PAUSED" : "ACTIVE",
          pausedUntil:
            i === subscriptionCount - 1
              ? new Date(Date.now() + 21 * 86_400_000)
              : null,
        },
      });
      subscriptions.push({
        id: subscription.id,
        clientIndex: i,
        cleanerId: cleaner.id,
      });
    }

    // --- Réservations ------------------------------------------------------
    // Chaque intervenant reçoit au plus une mission par créneau et par jour, ce
    // qui garantit le respect de la contrainte d'exclusion posée en base.
    const orgBookingTarget = Math.round(
      (targetBookings * orgSeed.clientCount) /
        ORGANIZATIONS.reduce((sum, o) => sum + o.clientCount, 0),
    );

    let created = 0;

    /**
     * Occupations déjà posées, par intervenant.
     *
     * Le seed doit respecter la contrainte d'exclusion qu'il vient de créer :
     * les durées varient de deux à cinq heures, si bien qu'une mission partie
     * du créneau de 8 h peut mordre sur celui de 11 h. On raisonne donc sur les
     * intervalles réels, tampons de trajet compris, et non sur des étiquettes
     * de créneau.
     */
    const busyByCleaner = new Map<string, { start: number; end: number }[]>();

    const isFree = (cleanerId: string, start: number, end: number): boolean =>
      !(busyByCleaner.get(cleanerId) ?? []).some(
        (slot) => start < slot.end && end > slot.start,
      );

    const markBusy = (cleanerId: string, start: number, end: number): void => {
      const slots = busyByCleaner.get(cleanerId) ?? [];
      slots.push({ start, end });
      busyByCleaner.set(cleanerId, slots);
    };

    /**
     * Créneaux candidats sur toute la fenêtre, mélangés.
     *
     * Un parcours chronologique remplirait le quota avec le seul passé et ne
     * produirait aucune réservation en attente d'attribution — précisément les
     * cas dont le moteur d'attribution et l'espace intervenant ont besoin. Le
     * mélange, déterministe, garantit la présence de tous les statuts.
     */
    const candidates: { offset: number; slot: (typeof DAY_SLOTS)[number] }[] =
      [];
    for (let offset = -24; offset <= 18; offset += 1) {
      const day = dayParts(offset);
      const weekday = new Date(
        Date.UTC(day.year, day.month - 1, day.day),
      ).getUTCDay();
      if (weekday === 0) continue; // pas de ménage le dimanche
      for (const slot of DAY_SLOTS) {
        candidates.push({ offset, slot });
      }
    }
    for (let i = candidates.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
    }

    {
      for (const { offset, slot } of candidates) {
        if (created >= orgBookingTarget) break;
        const day = dayParts(offset);

        const subscription =
          created % 3 === 0 && subscriptions.length > 0
            ? subscriptions[created % subscriptions.length]!
            : null;
        const client = subscription
          ? clients[subscription.clientIndex]!
          : pick(clients);
        const service = subscription ? services[0]! : pick(services);

        // L'abonnement impose son intervenant attitré ; c'est donc lui qu'il
        // faut consulter pour savoir si le créneau est libre.
        const assignedCleanerId = subscription
          ? subscription.cleanerId
          : cleaners[created % cleaners.length]!.id;

        const surface = randomInt(45, 175);
        const durationMinutes = Math.max(
          service.minDurationMinutes,
          Math.round(((surface / service.sqmPerHour) * 60) / 30) * 30,
        );
        const frequency = subscription ? "WEEKLY" : "ONE_OFF";
        const rule = await prisma.pricingRule.findFirstOrThrow({
          where: {
            organizationId: organization.id,
            serviceId: service.id,
            frequency,
          },
        });

        const grossAmountCents = Math.round(
          (rule.hourlyRateCents * durationMinutes) / 60,
        );
        const taxCreditAmountCents = Math.round(
          (grossAmountCents * TAX_CREDIT_RATE_BP) / 10000,
        );
        const commissionAmountCents = Math.round(
          (grossAmountCents * organization.commissionRateBp) / 10000,
        );

        const status = pickStatus(offset, random());
        const scheduledStart = parisDayMinuteToUtc(day, slot.start);
        const scheduledEnd = new Date(
          scheduledStart.getTime() + durationMinutes * 60_000,
        );

        // Seules les affectations vivantes réservent le créneau : une mission
        // annulée ou refusée doit rester réattribuable, comme en production.
        const assignmentStatus = assignmentStatusFor(status);
        const holdsSlot =
          status !== "DRAFT" &&
          status !== "PENDING_ASSIGNMENT" &&
          (assignmentStatus === "PROPOSED" || assignmentStatus === "ACCEPTED");
        const buffer = TRAVEL_BUFFER_MINUTES * 60_000;
        const blockStart = scheduledStart.getTime() - buffer;
        const blockEnd = scheduledEnd.getTime() + buffer;

        if (holdsSlot && !isFree(assignedCleanerId, blockStart, blockEnd)) {
          continue;
        }

        const booking = await prisma.booking.create({
          data: {
            organizationId: organization.id,
            clientProfileId: client.id,
            addressId: client.addressId,
            serviceId: service.id,
            subscriptionId: subscription?.id ?? null,
            status,
            source: orgSeed.type === "MARKETPLACE" ? "LEOCLEAN" : "ORG_PAGE",
            scheduledStart,
            scheduledEnd,
            durationMinutes,
            surfaceSqm: surface,
            frequency,
            hourlyRateCents: rule.hourlyRateCents,
            grossAmountCents,
            taxCreditRateBp: TAX_CREDIT_RATE_BP,
            taxCreditAmountCents,
            netAmountCents: grossAmountCents - taxCreditAmountCents,
            commissionRateBp: organization.commissionRateBp,
            commissionAmountCents,
            cancellationFeeCents:
              status === "CANCELLED_BY_CLIENT" && random() < 0.5
                ? Math.round(grossAmountCents / 2)
                : 0,
            cancelledAt: status.startsWith("CANCELLED") ? new Date() : null,
            completedAt: status === "COMPLETED" ? scheduledEnd : null,
            clientNotes: random() < 0.3 ? pick(ACCESS_NOTES) : null,
            items: {
              create: [
                {
                  organizationId: organization.id,
                  kind: "SERVICE",
                  sourceId: service.id,
                  label: CATALOGUE.find((s) => s.slug === service.slug)!.name,
                  unitPriceCents: rule.hourlyRateCents,
                  totalCents: grossAmountCents,
                },
              ],
            },
            statusEvents: {
              create: [
                {
                  organizationId: organization.id,
                  toStatus: "PENDING_ASSIGNMENT",
                  reason: "Réservation créée",
                },
                ...(status === "DRAFT"
                  ? []
                  : [{ organizationId: organization.id, toStatus: status }]),
              ],
            },
          },
        });
        created += 1;
        bookingsCreated += 1;

        // --- Affectation ---------------------------------------------------
        if (status !== "DRAFT" && status !== "PENDING_ASSIGNMENT") {
          if (holdsSlot) {
            markBusy(assignedCleanerId, blockStart, blockEnd);
          }

          await prisma.assignment.create({
            data: {
              organizationId: organization.id,
              bookingId: booking.id,
              cleanerProfileId: assignedCleanerId,
              status: assignmentStatus,
              startAt: scheduledStart,
              endAt: scheduledEnd,
              blockStartAt: new Date(blockStart),
              blockEndAt: new Date(blockEnd),
              travelMinutesBefore: TRAVEL_BUFFER_MINUTES,
              travelMinutesAfter: TRAVEL_BUFFER_MINUTES,
              respondBy: new Date(scheduledStart.getTime() - 86_400_000),
              respondedAt: assignmentStatus === "PROPOSED" ? null : new Date(),
              score: Number((0.55 + random() * 0.4).toFixed(3)),
              scoreBreakdown: {
                coutInsertionTrajet: Number((random() * 0.4).toFixed(3)),
                note: Number((0.6 + random() * 0.4).toFixed(3)),
                tauxAcceptation: Number((0.7 + random() * 0.3).toFixed(3)),
                equiteCharge: Number(random().toFixed(3)),
                cleanerAttitre: subscription ? 1 : 0,
              },
            },
          });
          assignmentsCreated += 1;
        }

        // --- Paiement, facture, avis ---------------------------------------
        if (status === "COMPLETED") {
          await prisma.payment.create({
            data: {
              organizationId: organization.id,
              bookingId: booking.id,
              status: "CAPTURED",
              stripePaymentIntentId: `pi_seed_${booking.id}`,
              amountCents: grossAmountCents,
              capturedAmountCents: grossAmountCents,
              authorizedAt: new Date(scheduledStart.getTime() - 86_400_000),
              capturedAt: scheduledEnd,
            },
          });
          await prisma.invoice.create({
            data: {
              organizationId: organization.id,
              bookingId: booking.id,
              type: "CLIENT_SERVICE",
              number: `${new Date().getFullYear()}-${String(bookingsCreated).padStart(5, "0")}`,
              issuedAt: scheduledEnd,
              totalCents: grossAmountCents,
              taxCreditEligibleCents: grossAmountCents,
            },
          });

          if (random() < 0.65) {
            await prisma.review.create({
              data: {
                organizationId: organization.id,
                bookingId: booking.id,
                clientProfileId: client.id,
                cleanerProfileId: assignedCleanerId,
                rating: random() < 0.82 ? 5 : randomInt(3, 4),
                comment: pick(REVIEW_COMMENTS).replace(
                  "{commune}",
                  client.commune.name,
                ),
                communeInsee: client.commune.insee,
                isPublic: true,
                publishedAt: new Date(scheduledEnd.getTime() + 3_600_000),
              },
            });
          }
        }
      }
    }

    // --- Demandes de rappel issues du site public --------------------------
    for (let i = 0; i < (orgSeed.type === "MARKETPLACE" ? 7 : 2); i += 1) {
      const commune = pick(COMMUNES);
      await prisma.lead.create({
        data: {
          organizationId: organization.id,
          name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
          phone: `06 ${randomInt(10, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)}`,
          email: random() < 0.7 ? `contact${i}@exemple.invalid` : null,
          communeInsee: commune.insee,
          message: pick([
            "Bonjour, je cherche quelqu'un pour 3 heures par semaine.",
            "Besoin d'un ménage de fin de bail avant état des lieux le mois prochain.",
            "Est-ce que vous intervenez aussi le samedi matin ?",
          ]),
          sourcePath: `/menage-a-domicile/${commune.slug}`,
          status: pick(["NEW", "NEW", "CONTACTED", "CONVERTED"] as const),
        },
      });
    }

    console.log(
      `  ${orgSeed.cleanerCount} intervenants, ${orgSeed.clientCount} clients, ${created} réservations`,
    );
  }

  // --- Recalcul des agrégats affichés --------------------------------------
  const cleanerProfiles = await prisma.cleanerProfile.findMany({
    select: { id: true },
  });
  for (const cleaner of cleanerProfiles) {
    const stats = await prisma.review.aggregate({
      where: { cleanerProfileId: cleaner.id },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.cleanerProfile.update({
      where: { id: cleaner.id },
      data: {
        ratingAverage: Number((stats._avg.rating ?? 0).toFixed(2)),
        ratingCount: stats._count,
      },
    });
  }

  const counts = {
    organisations: await prisma.organization.count(),
    utilisateurs: await prisma.user.count(),
    intervenants: await prisma.cleanerProfile.count(),
    clients: await prisma.clientProfile.count(),
    adresses: await prisma.address.count(),
    réservations: bookingsCreated,
    affectations: assignmentsCreated,
    abonnements: await prisma.subscription.count(),
    avis: await prisma.review.count(),
    demandes: await prisma.lead.count(),
  };

  console.log("\nJeu de données créé :");
  for (const [label, value] of Object.entries(counts)) {
    console.log(`  ${label.padEnd(16)} ${value}`);
  }
}

/** Répartit les statuts selon que la réservation est passée, en cours ou à venir. */
function pickStatus(dayOffset: number, roll: number): BookingStatus {
  if (dayOffset < -1) {
    if (roll < 0.78) return "COMPLETED";
    if (roll < 0.86) return "CANCELLED_BY_CLIENT";
    if (roll < 0.92) return "CANCELLED_BY_CLEANER";
    if (roll < 0.97) return "NO_SHOW";
    return "DISPUTED";
  }
  // Le jour même est toujours une mission en cours : c'est ce que la « tournée
  // du jour » de l'intervenant doit montrer, et le laisser au hasard reviendrait
  // à livrer régulièrement un jeu de données sans ce cas.
  if (dayOffset === 0) return "IN_PROGRESS";
  if (dayOffset < 0) return "CONFIRMED";
  if (roll < 0.5) return "CONFIRMED";
  if (roll < 0.72) return "ASSIGNED";
  if (roll < 0.88) return "PENDING_ASSIGNMENT";
  // Tunnels abandonnés : l'état du parcours est persisté, il faut pouvoir le
  // reprendre et le relancer.
  return "DRAFT";
}

/**
 * Statut d'affectation cohérent avec celui de la réservation.
 *
 * Les statuts terminaux sont indispensables : une affectation annulée ne doit
 * plus bloquer le créneau dans la contrainte d'exclusion, sinon l'historique
 * gèlerait le planning.
 */
function assignmentStatusFor(status: BookingStatus): AssignmentStatus {
  switch (status) {
    case "COMPLETED":
      return "COMPLETED";
    case "CANCELLED_BY_CLIENT":
    case "NO_SHOW":
    case "DISPUTED":
      return "CANCELLED";
    case "CANCELLED_BY_CLEANER":
      return "DECLINED";
    case "ASSIGNED":
      return "PROPOSED";
    default:
      return "ACCEPTED";
  }
}

main()
  .catch((error: unknown) => {
    console.error("Le seed a échoué :", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
