import { publishedCommunes } from "./communes-content";
import { CANCELLATION_TIERS } from "./pricing/cancellation";
import {
  LOWEST_HOURLY_RATE_CENTS,
  MINIMUM_BILLABLE_MINUTES,
} from "./pricing/public-grid";
import { MAX_REFERRAL_DEPTH, REFERRAL_PROGRAMS } from "./referral/rules";
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

// ===========================================================================
// Côté offre — ce qu'on annonce aux intervenants
// ===========================================================================

/**
 * Conditions faites aux intervenants.
 *
 * Les champs à `null` ne sont pas des oublis : ce sont des décisions que le
 * porteur du projet n'a pas encore prises. Ils suivent la convention de
 * `site.ts` — une valeur absente est masquée, jamais remplacée par un espace
 * réservé, et `PENDING_INTERVENANT_FIELDS` empêche la page de partir tant
 * qu'il en reste.
 *
 * Le montant net est le seul chiffre de la page qu'un intervenant vérifiera
 * sur son relevé bancaire. Il n'est pas écrit tant qu'il n'est pas arbitré,
 * parce qu'un chiffre provisoire affiché une semaine devient un chiffre qu'on
 * nous oppose un an plus tard.
 */
export const INTERVENANTS = {
  /** Rémunération nette horaire, en centimes. Décision non prise. */
  netHourlyRateCents: null as number | null,

  /** Formulation du délai de paiement, par exemple « le 5 de chaque mois ». */
  paymentTerms: null as string | null,

  /**
   * Ce que couvre le mot « garanti ».
   *
   * Le mot n'engage à rien tant qu'on n'a pas dit **contre quoi** il garantit.
   * Ces trois cas sont ceux qu'un intervenant ayant déjà travaillé pour une
   * plateforme lira en premier, et le seul usage honnête du mot suppose que
   * les trois aient une réponse. Tant que l'un manque, `netRateLabel()` écrit
   * « net, versé à date fixe » — qui est déjà un argument, et qui est vrai.
   */
  guarantee: {
    /** Le client règle en retard. */
    latePayment: null as string | null,
    /** Le client ne règle pas du tout. L'impayé est-il porté par Léo Clean ? */
    unpaidClient: null as string | null,
    /** Le client annule tardivement : quelle part du barème revient à l'intervenant ? */
    lateCancellation: null as string | null,
  },

  /** Frais d'inscription, en centimes. Zéro, et ce n'est pas provisoire. */
  signupFeeCents: 0,

  /** Aucune exclusivité n'est demandée. Voir les points juridiques du dépôt. */
  requiresExclusivity: false,

  /** Rayon de travail, en minutes de route. Le même chiffre que côté client. */
  maxDriveMinutes: MAX_DRIVE_MINUTES,

  /**
   * Pièces exigées avant la première intervention.
   *
   * Exactement la liste promise aux clients sous « professionnels vérifiés » :
   * les deux faces du site énoncent la même chose, et n'importe qui peut le
   * vérifier en ouvrant les deux pages.
   */
  requirements: [
    "SIRET actif",
    "Attestation de responsabilité civile professionnelle à jour",
    "Pièce d'identité",
    "RIB",
    "Expérience du ménage à domicile",
    "Résider ou travailler dans l'une des seize communes",
  ],
} as const;

/**
 * Ce qui manque avant que `/travailler-avec-nous` puisse être publiée.
 *
 * Même mécanique que `PENDING_IDENTITY_FIELDS` : la liste est dérivée, et
 * c'est elle — non un drapeau posé à côté — qui décide si la page entre dans
 * le sitemap et si les moteurs ont le droit de l'indexer. Une page d'offre
 * dont le premier chiffre est absent ne doit pas se classer : elle décevrait
 * exactement les gens qu'elle cherche à convaincre.
 */
export const PENDING_INTERVENANT_FIELDS: readonly string[] = [
  ...(INTERVENANTS.netHourlyRateCents === null ? ["rémunération nette"] : []),
  ...(INTERVENANTS.paymentTerms === null ? ["délai de paiement"] : []),
  ...(INTERVENANTS.guarantee.latePayment === null
    ? ["garantie en cas de retard de paiement"]
    : []),
  ...(INTERVENANTS.guarantee.unpaidClient === null
    ? ["garantie en cas d'impayé"]
    : []),
  ...(INTERVENANTS.guarantee.lateCancellation === null
    ? ["part de l'intervenant sur une annulation tardive"]
    : []),
];

/** La page d'offre est-elle complète, donc publiable et indexable ? */
export const INTERVENANT_PAGE_READY: boolean =
  PENDING_INTERVENANT_FIELDS.length === 0;

/**
 * Peut-on écrire « garanti » ?
 *
 * Seulement si les trois situations ont une réponse écrite. Le mot est le seul
 * des quatre chiffres du bandeau qui dise quelque chose qu'une plateforme
 * nationale ne dit pas : l'employer à vide le viderait aussi pour le jour où
 * il sera mérité.
 */
export function canSayGuaranteed(): boolean {
  const { latePayment, unpaidClient, lateCancellation } =
    INTERVENANTS.guarantee;
  return (
    latePayment !== null && unpaidClient !== null && lateCancellation !== null
  );
}

/** Qualificatif du montant net, dérivé de ce qu'on est en mesure de tenir. */
export function netRateLabel(): string {
  return canSayGuaranteed() ? "net garanti" : "net, versé à date fixe";
}

/**
 * Programme de cooptation entre intervenants.
 *
 * **Rien n'est décidé ici.** Tout est lu dans `referral/rules.ts`, qui est le
 * module opérationnel : c'est lui qui calcule les commissions réellement
 * versées, et ses règles sont verrouillées par des tests qui existaient avant
 * cette page. Une page d'offre qui annoncerait un taux ou une durée différents
 * de ceux que la machine applique serait une promesse non tenue, découverte au
 * premier versement.
 *
 * Le plafond mensuel en fait partie. Il n'était pas prévu au brief de la page,
 * mais il existe dans le calcul : annoncer « 5 % de votre filleul » sans dire
 * qu'ils sont bornés à 150 € par mois reviendrait à cacher la seule limite du
 * dispositif.
 */
export const PARRAINAGE = {
  /** Part du chiffre d'affaires du filleul, en points de base. */
  rateBp: REFERRAL_PROGRAMS.CLEANER.recurringRateBp,

  /** Missions que le filleul doit avoir réalisées avant le premier versement. */
  qualifyingBookings: REFERRAL_PROGRAMS.CLEANER.qualifyingCompletedBookings,

  /** Durée de la commission, en mois, à compter du déclenchement. */
  months: REFERRAL_PROGRAMS.CLEANER.recurringMonths,

  /** Plafond mensuel, tous filleuls confondus, en centimes. */
  monthlyCapCents: REFERRAL_PROGRAMS.CLEANER.monthlyCapCents,

  /** Délai au-delà duquel un parrainage sans suite expire, en jours. */
  expiryDays: REFERRAL_PROGRAMS.CLEANER.expiryDays,

  /**
   * Profondeur du réseau. Vaut 1, et ce n'est pas un réglage.
   *
   * Toucher sur les filleuls de ses filleuls ferait dépendre une partie du
   * gain du recrutement opéré par autrui, ce qui est la définition de la vente
   * à la boule de neige à l'article L.121-15 du code de la consommation.
   */
  depth: MAX_REFERRAL_DEPTH,

  /** Versement en espèces : c'est un revenu, il entre dans le CA du parrain. */
  rewardKind: REFERRAL_PROGRAMS.CLEANER.rewardKind,
} as const;
