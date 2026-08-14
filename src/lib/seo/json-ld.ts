import { SITE, SOCIAL_PROFILES, absoluteUrl } from "@/lib/site";
import { COMMUNES, coverageRadiusKm } from "@/lib/territory";

/**
 * Données structurées.
 *
 * Le JSON-LD est ce que lisent Google et les modèles de langage lorsqu'ils
 * cherchent des faits plutôt que de la prose. Il doit donc être exact et
 * cohérent avec ce qui est affiché : une NAP qui diverge entre le balisage et
 * la page est pénalisée, et une note agrégée déclarée sans avis réels expose à
 * une sanction manuelle.
 *
 * Rien n'est inventé ici. Les champs dont Léo Clean ne dispose pas encore sont
 * omis plutôt que remplis d'un espace réservé.
 */

type JsonLd = Record<string, unknown>;

const ORGANIZATION_ID = absoluteUrl("/#organisation");

/** Adresse postale, réduite aux champs réellement connus. */
function postalAddress(): JsonLd {
  return {
    "@type": "PostalAddress",
    ...(SITE.address.street ? { streetAddress: SITE.address.street } : {}),
    addressLocality: SITE.address.city,
    postalCode: SITE.address.postalCode,
    addressRegion: SITE.address.region,
    addressCountry: SITE.address.country,
  };
}

/**
 * Zone desservie : les treize communes nommées, plus un cercle géographique.
 *
 * Les deux formes sont utiles. La liste nominative permet à un modèle de
 * répondre « oui, ils interviennent à Saint-Morillon » ; le cercle permet à un
 * moteur de rattacher une requête géolocalisée sans connaître le découpage
 * administratif.
 */
function areaServed(): JsonLd[] {
  return [
    ...COMMUNES.map((commune) => ({
      "@type": "City",
      name: commune.name,
      postalCode: commune.postalCode,
      identifier: commune.insee,
      address: {
        "@type": "PostalAddress",
        addressLocality: commune.name,
        postalCode: commune.postalCode,
        addressRegion: "Nouvelle-Aquitaine",
        addressCountry: "FR",
      },
    })),
    {
      "@type": "GeoCircle",
      geoMidpoint: {
        "@type": "GeoCoordinates",
        latitude: SITE.address.lat,
        longitude: SITE.address.lng,
      },
      geoRadius: coverageRadiusKm() * 1000,
    },
  ];
}

/**
 * L'entreprise elle-même.
 *
 * `HomeAndConstructionBusiness` est le type le plus proche d'un service de
 * ménage à domicile dans le vocabulaire schema.org, et il hérite de
 * `LocalBusiness`, ce qui est l'essentiel pour le référencement local.
 */
export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "@id": ORGANIZATION_ID,
    name: SITE.name,
    ...(SITE.legalName ? { legalName: SITE.legalName } : {}),
    description: SITE.description,
    url: SITE.url,
    telephone: SITE.phoneE164,
    email: SITE.email,
    address: postalAddress(),
    geo: {
      "@type": "GeoCoordinates",
      latitude: SITE.address.lat,
      longitude: SITE.address.lng,
    },
    areaServed: areaServed(),
    ...(SITE.foundingDate ? { foundingDate: SITE.foundingDate } : {}),
    ...(SITE.founder
      ? { founder: { "@type": "Person", name: SITE.founder } }
      : {}),
    ...(SITE.siret ? { taxID: SITE.siret } : {}),
    ...(SOCIAL_PROFILES.length > 0 ? { sameAs: SOCIAL_PROFILES } : {}),
    currenciesAccepted: SITE.currency,
    paymentAccepted: "Carte bancaire",
    /**
     * Horaires de joignabilité, pas d'ouverture d'un local : Léo Clean n'a pas
     * de guichet. On décrit quand on répond au téléphone.
     */
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "08:00",
        closes: "19:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "09:00",
        closes: "13:00",
      },
    ],
  };
}

export interface ServiceOfferInput {
  name: string;
  description: string;
  /** Tarif horaire en centimes. */
  hourlyRateCents: number;
  /** Libellé de la fréquence, tel qu'affiché au client. */
  unitLabel: string;
}

/** Prestation avec ses tarifs, rattachée à l'entreprise et à sa zone. */
export function serviceJsonLd(
  serviceName: string,
  description: string,
  offers: readonly ServiceOfferInput[],
  path: string,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": absoluteUrl(`${path}#service`),
    name: serviceName,
    description,
    serviceType: "Ménage à domicile",
    provider: { "@id": ORGANIZATION_ID },
    areaServed: areaServed(),
    offers: offers.map((offer) => ({
      "@type": "Offer",
      name: offer.name,
      description: offer.description,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: (offer.hourlyRateCents / 100).toFixed(2),
        priceCurrency: SITE.currency,
        unitCode: "HUR",
        unitText: offer.unitLabel,
        valueAddedTaxIncluded: true,
      },
      availableAtOrFrom: { "@id": ORGANIZATION_ID },
    })),
  };
}

export interface BreadcrumbEntry {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(entries: readonly BreadcrumbEntry[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: absoluteUrl(entry.path),
    })),
  };
}

export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * Foire aux questions.
 *
 * Le format question/réponse est celui que les modèles de langage reprennent
 * le plus fidèlement, à condition que chaque réponse se suffise à elle-même —
 * une réponse qui commence par « oui, et dans ce cas… » ne peut pas être citée.
 */
export function faqJsonLd(entries: readonly FaqEntry[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

export interface ArticleJsonLdInput {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified: string;
  /** Nombre de mots, que Google utilise pour jauger la profondeur du contenu. */
  wordCount: number;
}

/**
 * Article éditorial.
 *
 * L'auteur déclaré est l'entreprise, pas une personne : Léo Clean n'a pas de
 * rédaction, et attribuer un article à un auteur fictif pour cocher une case
 * serait exactement le genre de signal que ce balisage sert à vérifier.
 */
export function articleJsonLd(input: ArticleJsonLdInput): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": absoluteUrl(`${input.path}#article`),
    headline: input.headline,
    description: input.description,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    wordCount: input.wordCount,
    inLanguage: "fr-FR",
    author: { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(input.path),
    },
    about: {
      "@type": "Service",
      serviceType: "Ménage à domicile",
      areaServed: areaServed(),
    },
  };
}

export interface ReviewEntry {
  author: string;
  rating: number;
  body: string;
  publishedAt: string;
  communeName: string;
}

/**
 * Avis et note agrégée.
 *
 * Volontairement omis tant qu'aucun avis réel n'existe : déclarer une note
 * agrégée sans avis correspondants est un motif de sanction manuelle chez
 * Google, et cela reviendrait à mentir sur la seule chose qui fonde la
 * confiance dans ce métier.
 */
export function reviewsJsonLd(reviews: readonly ReviewEntry[]): JsonLd | null {
  if (reviews.length === 0) {
    return null;
  }

  const average =
    reviews.reduce((total, review) => total + review.rating, 0) /
    reviews.length;

  return {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "@id": ORGANIZATION_ID,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: average.toFixed(1),
      reviewCount: reviews.length,
      bestRating: 5,
      worstRating: 1,
    },
    review: reviews.map((review) => ({
      "@type": "Review",
      author: { "@type": "Person", name: review.author },
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.rating,
        bestRating: 5,
      },
      reviewBody: review.body,
      datePublished: review.publishedAt,
      locationCreated: { "@type": "Place", name: review.communeName },
    })),
  };
}

/**
 * Sérialise le balisage pour insertion dans la page.
 *
 * Les chevrons sont échappés : une chaîne contenant `</script>` — un avis
 * client, par exemple — refermerait la balise et permettrait l'injection de
 * code arbitraire.
 */
export function serializeJsonLd(data: JsonLd | readonly JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
