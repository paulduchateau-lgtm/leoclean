import { publishedCommunes } from "@/lib/communes-content";
import {
  MINIMUM_BILLABLE_MINUTES,
  PUBLIC_RATES,
  STANDARD_SQM_PER_HOUR,
  TAX_CREDIT_RATE_BP,
} from "@/lib/pricing/public-grid";
import { SITE, absoluteUrl } from "@/lib/site";
import { COMMUNES, TERRITORY_POPULATION } from "@/lib/territory";

/**
 * Point d'entrée public, documenté et stable.
 *
 * Coût nul, bénéfice réel : un agent ou un annuaire qui souhaite connaître la
 * zone couverte et les tarifs n'a pas à extraire les données d'une page HTML,
 * avec les erreurs que cela suppose. C'est aussi la version qui fait foi en cas
 * de divergence de lecture.
 *
 * Aucune donnée personnelle n'y figure : uniquement l'offre et la zone.
 */
export const dynamic = "force-static";
export const revalidate = 86_400;

export function GET(): Response {
  return Response.json(
    {
      entreprise: {
        nom: SITE.name,
        description: SITE.description,
        telephone: SITE.phone,
        telephoneInternational: SITE.phoneE164,
        email: SITE.email,
        site: SITE.url,
        commune: SITE.address.city,
        codePostal: SITE.address.postalCode,
        departement: SITE.address.department,
        region: SITE.address.region,
        pays: SITE.address.country,
      },
      zoneIntervention: {
        nom: "Communauté de communes de Montesquieu",
        departement: "Gironde",
        nombreCommunes: COMMUNES.length,
        populationDesservie: TERRITORY_POPULATION,
        communes: COMMUNES.map((commune) => ({
          nom: commune.name,
          codeInsee: commune.insee,
          codePostal: commune.postalCode,
          population: commune.population,
          latitude: commune.lat,
          longitude: commune.lng,
          pageDediee: publishedCommunes().some(
            (entry) => entry.commune.slug === commune.slug,
          )
            ? absoluteUrl(`/menage-a-domicile/${commune.slug}`)
            : null,
        })),
      },
      tarifs: {
        devise: SITE.currency,
        tauxTtc: true,
        dureeMinimaleMinutes: MINIMUM_BILLABLE_MINUTES,
        metresCarresParHeure: STANDARD_SQM_PER_HOUR,
        creditImpotPourcent: TAX_CREDIT_RATE_BP / 100,
        formules: PUBLIC_RATES.map((rate) => ({
          code: rate.key,
          libelle: rate.label,
          description: rate.description,
          tarifHoraireEuros: rate.hourlyRateCents / 100,
        })),
      },
      horaires: {
        lundiVendredi: "08:00-19:00",
        samedi: "09:00-13:00",
        dimanche: null,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        // Ces données sont publiques et destinées à être reprises.
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
