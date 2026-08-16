import { publishedCommunes } from "./communes-content";
import { CANCELLATION_TIERS } from "./pricing/cancellation";
import {
  LOWEST_HOURLY_RATE_CENTS,
  MINIMUM_BILLABLE_MINUTES,
} from "./pricing/public-grid";
import { SITE } from "./site";
import { COMMUNES, TERRITORY_POPULATION } from "./territory";

/**
 * Les chiffres que le site met en avant.
 *
 * Ce module n'est **pas** une source de vérité : c'est un agrégateur. Chaque
 * valeur est dérivée du module qui la détient déjà — `territory.ts` pour le
 * périmètre, `public-grid.ts` pour les prix, `site.ts` pour la NAP,
 * `communes-content.ts` pour les temps de trajet. Rien n'est recopié, sans
 * quoi un chiffre affiché en page d'accueil finirait par contredire celui
 * qu'on facture, et personne ne s'en apercevrait avant un client.
 *
 * Il existe pour une raison précise : un bandeau de crédibilité rassemble en
 * quatre nombres ce que quatre modules détiennent séparément. Sans point de
 * rassemblement, ces quatre nombres seraient écrits en dur dans le JSX — ce
 * qui est exactement l'erreur qu'on veut rendre impossible.
 *
 * **Aucune métrique d'activité ici.** Nombre de clients, note moyenne, nombre
 * d'interventions réalisées : tant qu'elles n'existent pas, elles ne sont pas
 * dans ce fichier, donc pas affichables. Un chiffre d'activité inventé est une
 * pratique commerciale trompeuse, et le gain est sans rapport avec le risque.
 */

/**
 * Temps de trajet le plus long du territoire, en minutes.
 *
 * C'est la preuve chiffrée de la thèse du site — un rayon volontairement court
 * est ce qui permet d'envoyer la même personne chaque semaine. Il est calculé,
 * jamais écrit : le jour où une commune s'ajoute, le chiffre affiché suit, et
 * s'il devient impossible à défendre c'est le périmètre qu'il faut discuter,
 * pas la page d'accueil qu'il faut retoucher.
 *
 * Vaut 21 aujourd'hui, Saint-Morillon étant la commune la plus éloignée. La
 * prose du site dit « une vingtaine de minutes », ce qui reste vrai ; le
 * bandeau annonce la valeur exacte, parce qu'un chiffre présenté comme un
 * maximum doit en être un.
 */
export const MAX_DRIVE_MINUTES: number = Math.max(
  ...publishedCommunes().map(({ content }) => content.driveMinutesFromLeognan),
);

/**
 * Délai au-delà duquel une annulation ne coûte rien, en heures.
 *
 * Lu dans le barème plutôt qu'écrit : « annulation gratuite jusqu'à 24 h
 * avant » est un engagement affiché en page d'accueil et une somme prélevée en
 * production. Les deux doivent venir du même endroit, sinon le premier palier
 * du barème peut bouger sans que la promesse suive.
 */
export const FREE_CANCELLATION_HOURS: number = CANCELLATION_TIERS.find(
  (tier) => tier.rateBp === 0 && tier.capCents === 0,
)!.fromHoursBefore;

export const FACTS = {
  /** Communes desservies. */
  communeCount: COMMUNES.length,

  /** Heures avant l'intervention en deçà desquelles l'annulation est payante. */
  freeCancellationHours: FREE_CANCELLATION_HOURS,

  /** Habitants du territoire couvert. */
  populationServed: TERRITORY_POPULATION,

  /** Trajet le plus long depuis le siège, en minutes. */
  maxDriveMinutes: MAX_DRIVE_MINUTES,

  /** Tarif horaire le plus bas de la grille publique, en centimes. */
  lowestHourlyRateCents: LOWEST_HOURLY_RATE_CENTS,

  /** Durée minimale facturée, en minutes. */
  minimumBillableMinutes: MINIMUM_BILLABLE_MINUTES,

  /** Le numéro qu'on affiche, et celui qu'on compose. */
  phone: SITE.phone,
  phoneE164: SITE.phoneE164,

  /**
   * Existe-t-il des avis clients réels et publiables ?
   *
   * Faux aujourd'hui, et il n'y a rien à maquiller : le bloc de confiance de
   * l'accueil dit ce sur quoi Léo Clean s'engage, ce qui est vrai, plutôt que
   * de dérouler un carrousel de témoignages qui ne le seraient pas. Le
   * composant `<Avis />` est en place et ne rend rien tant que ce drapeau est
   * faux — le jour où des avis existent, il n'y a qu'à le lever.
   *
   * Le même drapeau garde le `aggregateRating` du JSON-LD : déclarer une note
   * agrégée sans avis est un motif de sanction manuelle.
   */
  hasReviews: false,
} as const;
