import type { PrismaClient } from "@prisma/client";

import { PUBLIC_RATES } from "../src/lib/pricing/public-grid";

/**
 * Socle d'une organisation : ce sans quoi le produit ne répond pas.
 *
 * L'organisation, son catalogue, ses options et ses tarifs. Rien d'autre —
 * ni intervenant, ni client, ni réservation. C'est exactement ce qu'il faut à
 * une base de production, et c'est le début de ce que le seed de développement
 * construit par-dessus.
 *
 * Le catalogue vit ici plutôt que dans `seed.ts` pour une raison simple :
 * deux définitions du même catalogue finiraient par diverger, et l'une des
 * deux serait celle qui facture.
 *
 * `ensureSocle` est **idempotente et n'efface rien**. C'est ce qui la rend
 * utilisable sur une base qui contient déjà des clients, là où `seed.ts`
 * commence par tout tronquer.
 */

export interface ServiceSeed {
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

export const CATALOGUE: ServiceSeed[] = [
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

/**
 * Tarif horaire en centimes, par fréquence.
 *
 * Grille retenue : 28 € de l'heure en régulier, 30 € en ponctuel, dont 23 € et
 * 21 € pour l'intervenant. La marge de coordination n'est donc pas un taux mais
 * un écart — 5 € et 9 € de l'heure — plus élevé sur une intervention unique,
 * dont le placement coûte davantage : trajet non amorti, aucune tournée à
 * remplir, aucune récurrence pour rentabiliser la mise en relation.
 *
 * Les valeurs viennent de `PUBLIC_RATES` et ne sont pas recopiées ici : le
 * guide affirme depuis toujours que le seed importe la grille publique pour que
 * les deux ne puissent pas diverger, et ce fichier en tenait pourtant une
 * seconde copie.
 */
export const RATES: Record<
  "ONE_OFF" | "WEEKLY" | "BIWEEKLY" | "MONTHLY",
  { hourlyRateCents: number; professionalHourlyRateCents: number }
> = (() => {
  const par = (key: "REGULIER" | "PONCTUEL") => {
    const rate = PUBLIC_RATES.find((candidate) => candidate.key === key)!;
    return {
      hourlyRateCents: rate.hourlyRateCents,
      professionalHourlyRateCents: rate.professionalHourlyRateCents,
    };
  };
  const regulier = par("REGULIER");
  return {
    ONE_OFF: par("PONCTUEL"),
    WEEKLY: regulier,
    BIWEEKLY: regulier,
    MONTHLY: regulier,
  };
})();

export const TAX_CREDIT_RATE_BP = 5000;

/** Organisation marketplace : Léo Clean elle-même. */
export const MARKETPLACE = {
  slug: "leoclean",
  name: "Léo Clean",
  legalName: "Léo Clean SAS",
  tagline: "Le ménage à domicile, par des gens d'ici",
  description:
    "Léo Clean met en relation des particuliers du sud de Bordeaux avec des intervenants indépendants qui habitent le territoire.",
  /**
   * Marge de coordination, relevée des CGU : 29 € payés par le client, 18 €
   * pour l'intervenant, soit 11 € de coordination.
   */
  commissionRateBp: 3800,
} as const;

export interface SocleResult {
  organizationId: string;
  servicesCreated: number;
  servicesExistants: number;
  tarifsCreated: number;
}

/**
 * Pose ou complète le socle de l'organisation marketplace.
 *
 * Chaque objet est recherché par sa clé naturelle avant d'être créé : relancer
 * la commande ne produit rien de plus, et ne détruit rien de ce qui existe.
 */
export async function ensureSocle(prisma: PrismaClient): Promise<SocleResult> {
  const organization = await prisma.organization.upsert({
    where: { slug: MARKETPLACE.slug },
    create: {
      slug: MARKETPLACE.slug,
      name: MARKETPLACE.name,
      type: "MARKETPLACE",
      status: "ACTIVE",
      engagementMode: "MISE_EN_RELATION",
      legalName: MARKETPLACE.legalName,
      tagline: MARKETPLACE.tagline,
      description: MARKETPLACE.description,
      commissionRateBp: MARKETPLACE.commissionRateBp,
      isPubliclyBookable: true,
    },
    // On ne réécrit pas une organisation existante : ses valeurs peuvent avoir
    // été ajustées en base, et ce n'est pas à une commande d'installation de
    // les reprendre.
    update: {},
    select: { id: true },
  });

  let servicesCreated = 0;
  let servicesExistants = 0;
  let tarifsCreated = 0;

  for (const [index, serviceSeed] of CATALOGUE.entries()) {
    const existant = await prisma.service.findFirst({
      where: { organizationId: organization.id, slug: serviceSeed.slug },
      select: { id: true },
    });

    let serviceId: string;
    if (existant) {
      serviceId = existant.id;
      servicesExistants += 1;
    } else {
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
        select: { id: true },
      });
      serviceId = service.id;
      servicesCreated += 1;
    }

    for (const [frequency, rate] of Object.entries(RATES)) {
      const tarifExistant = await prisma.pricingRule.findFirst({
        where: {
          organizationId: organization.id,
          serviceId,
          frequency: frequency as keyof typeof RATES,
          validUntil: null,
        },
        select: { id: true },
      });
      if (tarifExistant) continue;

      await prisma.pricingRule.create({
        data: {
          organizationId: organization.id,
          serviceId,
          frequency: frequency as keyof typeof RATES,
          /*
           * Le grand ménage et la fin de bail sont plus exigeants : quatre
           * euros de l'heure de plus. Le supplément va **à l'intervenant**,
           * c'est lui qui fournit l'effort — la marge de coordination reste la
           * même, le placement d'une mission n'étant pas plus difficile parce
           * qu'elle est plus dure.
           */
          hourlyRateCents:
            serviceSeed.kind === "MENAGE_REGULIER" ||
            serviceSeed.kind === "REPASSAGE"
              ? rate.hourlyRateCents
              : rate.hourlyRateCents + 400,
          professionalHourlyRateCents:
            serviceSeed.kind === "MENAGE_REGULIER" ||
            serviceSeed.kind === "REPASSAGE"
              ? rate.professionalHourlyRateCents
              : rate.professionalHourlyRateCents + 400,
          taxCreditRateBp: TAX_CREDIT_RATE_BP,
          validFrom: new Date(Date.UTC(2026, 0, 1)),
        },
      });
      tarifsCreated += 1;
    }
  }

  return {
    organizationId: organization.id,
    servicesCreated,
    servicesExistants,
    tarifsCreated,
  };
}
