import type { CleanerCardView } from "@/lib/booking/backend";
import type { WeeklyAvailabilityRule } from "@/lib/scheduling/availability";
import { computeAvailability } from "@/lib/scheduling/availability";
import type { CleanerSchedule } from "@/lib/scheduling/slots";
import { getCommuneBySlug } from "@/lib/territory";

/**
 * Équipe de démonstration.
 *
 * La vitrine statique n'a pas de base : il lui faut malgré tout des
 * disponibilités pour que le tunnel produise de vrais créneaux. Cette équipe
 * est donc écrite en clair, et c'est un choix de sincérité — un jeu de données
 * inventé doit se voir dans le code plutôt que se déguiser en extraction.
 *
 * Les intervenants sont ancrés dans des communes réelles du territoire, ce qui
 * fait entrer les temps de trajet dans le calcul : un client de Cabanac ne se
 * verra pas proposer les mêmes créneaux qu'un client de Léognan, exactement
 * comme en production.
 */

const ALWAYS = new Date(Date.UTC(2020, 0, 1));

/** Du lundi au vendredi, plus le samedi matin. */
function rules(
  weekdays: readonly number[],
  startHour: number,
  endHour: number,
): WeeklyAvailabilityRule[] {
  return weekdays.map((weekday) => ({
    weekday,
    startMinute: startHour * 60,
    endMinute: endHour * 60,
    validFrom: ALWAYS,
    validUntil: null,
  }));
}

interface DemoCleaner {
  id: string;
  /** Prénom affiché au client. Le nom complet n'est jamais publié. */
  firstName: string;
  communeSlug: string;
  /** Ancienneté sur la plateforme, en mois. */
  seniorityMonths: number;
  rules: WeeklyAvailabilityRule[];
  ratingAverage: number;
  ratingCount: number;
  acceptanceRate: number;
  maxTravelMinutes: number;
}

const DEMO_CLEANERS: readonly DemoCleaner[] = [
  {
    id: "demo-leognan",
    firstName: "Sabrina",
    seniorityMonths: 26,
    communeSlug: "leognan",
    rules: [...rules([1, 2, 3, 4, 5], 8, 18), ...rules([6], 9, 13)],
    ratingAverage: 4.8,
    ratingCount: 34,
    acceptanceRate: 0.95,
    maxTravelMinutes: 30,
  },
  {
    id: "demo-villenave",
    firstName: "Nadia",
    seniorityMonths: 14,
    communeSlug: "villenave-d-ornon",
    rules: rules([1, 2, 3, 4, 5], 9, 17),
    ratingAverage: 4.6,
    ratingCount: 21,
    acceptanceRate: 0.9,
    maxTravelMinutes: 25,
  },
  {
    id: "demo-gradignan",
    firstName: "Christelle",
    seniorityMonths: 31,
    communeSlug: "gradignan",
    rules: [...rules([1, 3, 5], 8, 19), ...rules([6], 9, 13)],
    ratingAverage: 4.9,
    ratingCount: 52,
    acceptanceRate: 1,
    maxTravelMinutes: 30,
  },
  {
    id: "demo-la-brede",
    firstName: "Fatima",
    seniorityMonths: 9,
    communeSlug: "la-brede",
    rules: rules([2, 3, 4, 5], 9, 18),
    ratingAverage: 4.4,
    ratingCount: 12,
    acceptanceRate: 0.85,
    maxTravelMinutes: 35,
  },
  {
    id: "demo-cestas",
    firstName: "Élodie",
    seniorityMonths: 1,
    communeSlug: "cestas",
    // Nouvelle sur la plateforme : aucun avis, note neutre au score.
    rules: rules([1, 2, 4, 5], 8, 14),
    ratingAverage: 0,
    ratingCount: 0,
    acceptanceRate: 1,
    maxTravelMinutes: 25,
  },
  {
    id: "demo-cabanac",
    firstName: "Marie-Line",
    seniorityMonths: 18,
    communeSlug: "cabanac-et-villagrains",
    rules: rules([1, 2, 3, 4, 5], 10, 17),
    ratingAverage: 4.7,
    ratingCount: 18,
    acceptanceRate: 0.88,
    maxTravelMinutes: 40,
  },
];

/**
 * Plannings de l'équipe de démonstration sur une fenêtre donnée.
 *
 * Le calcul passe par `computeAvailability`, le même code qu'en production :
 * ce qui est montré est bien ce que le moteur produit, pas une imitation.
 * Aucune mission n'est déjà planifiée — la démonstration part d'un planning
 * vierge, sinon les créneaux changeraient à chaque rechargement.
 */
export function demoSchedules(window: {
  start: number;
  end: number;
}): CleanerSchedule[] {
  return DEMO_CLEANERS.map((cleaner) => {
    const commune = getCommuneBySlug(cleaner.communeSlug);
    if (!commune) {
      throw new Error(
        `L'équipe de démonstration cite la commune inconnue « ${cleaner.communeSlug} ».`,
      );
    }

    return {
      cleanerProfileId: cleaner.id,
      homePoint: { lat: commune.lat, lng: commune.lng },
      maxTravelMinutes: cleaner.maxTravelMinutes,
      availability: computeAvailability({ window, rules: cleaner.rules }),
      stops: [],
      ratingAverage: cleaner.ratingAverage,
      ratingCount: cleaner.ratingCount,
      acceptanceRate: cleaner.acceptanceRate,
      assignedMinutesInPeriod: 0,
      isPreferred: false,
    };
  });
}

/**
 * Fiche d'un intervenant de démonstration, pour l'écran de confirmation.
 *
 * L'équipe est fictive et le code le dit ; ce qui compte est que la
 * confirmation montre bien la même chose qu'en production — quelqu'un, avec un
 * prénom et une commune, plutôt qu'une heure et un prix.
 */
export function demoCleanerCard(id: string): CleanerCardView | null {
  const cleaner = DEMO_CLEANERS.find((entry) => entry.id === id);
  if (!cleaner) return null;

  return {
    firstName: cleaner.firstName,
    communeName: getCommuneBySlug(cleaner.communeSlug)?.name ?? null,
    seniorityMonths: cleaner.seniorityMonths,
    // Même règle que le JSON-LD : pas de note affichée sans avis réels.
    ratingAverage: cleaner.ratingCount > 0 ? cleaner.ratingAverage : null,
    ratingCount: cleaner.ratingCount,
  };
}
