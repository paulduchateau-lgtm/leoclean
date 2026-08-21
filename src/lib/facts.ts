import { publishedCommunes } from "./communes-content";
import { CANCELLATION_TIERS } from "./pricing/cancellation";
import {
  LOWEST_HOURLY_RATE_CENTS,
  MINIMUM_BILLABLE_MINUTES,
  PUBLIC_RATES,
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
  /**
   * Rémunération nette horaire, en centimes.
   *
   * **Dérivée de la grille publique, plus écrite ici.** Elle y valait 18 € en
   * dur, à côté d'une grille qui portait déjà la réponse : deux vérités pour un
   * seul chiffre, et c'est celle de la page qui aurait vieilli — un intervenant
   * vérifie ce montant sur son relevé bancaire.
   *
   * 23 € de l'heure en formule régulière, sur 28 € payés par le client : la
   * coordination est l'écart, cinq euros, et le bloc rémunération déduit les
   * deux autres lignes de celle-ci plutôt que de les écrire.
   */
  netHourlyRateCents: (PUBLIC_RATES.find((rate) => rate.key === "REGULIER")
    ?.professionalHourlyRateCents ?? null) as number | null,

  /**
   * Délai de paiement, tel qu'il se dit.
   *
   * Cinq jours ouvrés après l'intervention. C'est un délai, pas une date fixe
   * mensuelle : la copy dit donc « sous 5 jours ouvrés » et jamais « à date
   * fixe », qui décrirait un autre engagement.
   */
  paymentTerms: "sous 5 jours ouvrés" as string | null,

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
    /**
     * Le client règle en retard.
     *
     * Le délai de règlement du client n'entre pas dans le calcul : la
     * rémunération part sur son propre délai. C'est la conséquence directe de
     * la ligne suivante — si l'impayé complet ne prive de rien, le simple
     * retard encore moins.
     */
    latePayment:
      "Vous êtes payé sous 5 jours ouvrés après l'intervention. Le délai de règlement du client ne décale pas le vôtre." as
        string | null,

    /**
     * Le client ne règle pas du tout.
     *
     * **L'impayé est porté par Léo Clean**, pas par l'intervenant : la
     * prestation a été faite, elle est due. Ce qui est suspendu est la
     * **suite** — l'intervention suivante est gelée tant que la situation
     * n'est pas régularisée, et l'intervenant le sait avant de partir plutôt
     * que de le découvrir devant la porte.
     *
     * La phrase dit le gel comme une règle, pas comme un écran : rien dans le
     * produit ne pose aujourd'hui `SUSPENDED` sur une réservation impayée —
     * `traiterLesImpayes` calcule la liste `aSuspendre` et personne ne la
     * consomme, et aucune notification ne part vers l'intervenant. Le gel est
     * donc tenu à la main. Écrire ici « vous êtes prévenu automatiquement »
     * promettrait un logiciel qui n'existe pas.
     */
    unpaidClient:
      "Vous êtes payé : la prestation a été réalisée, elle vous est due, et l'impayé reste notre affaire. Seule l'intervention suivante chez ce client est gelée tant que la situation n'est pas régularisée — vous en êtes informé, vous ne vous déplacez pas pour rien." as
        string | null,

    /**
     * Le client annule tardivement.
     *
     * **Moitié-moitié sur les frais réellement encaissés**, jamais sur le prix
     * de la mission : le barème des CGU est plafonné — 5 €, 10 €, 50 % dans la
     * limite de 20 €, 80 % dans la limite de 30 €, 100 % dans la limite de
     * 40 € — et annoncer une part du prix ferait attendre davantage que ce qui
     * rentre. La formulation renvoie donc au barème public plutôt que de
     * recopier un montant qui vieillirait.
     */
    lateCancellation:
      "Les frais d'annulation encaissés sont partagés en deux parts égales entre vous et Léo Clean. Le barème est public et figure sur la page tarifs." as
        string | null,
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

/**
 * Qualificatif court du montant net, pour un bandeau.
 *
 * « garanti » ne s'écrit que si les trois situations ont une réponse ; sinon
 * le montant est simplement net, ce qui est vrai et déjà distinctif.
 */
export function netRateLabel(): string {
  return canSayGuaranteed() ? "net garanti" : "net";
}

/**
 * Le même qualificatif, en prose.
 *
 * Tant que « garanti » n'est pas mérité, on dit ce qu'on tient réellement —
 * le délai de versement — plutôt que rien. Il est lu dans `paymentTerms` et
 * non recopié : écrire « à date fixe » quand l'engagement est un délai de cinq
 * jours ouvrés décrirait un autre engagement que celui qu'on prend.
 */
export function netRatePhrase(): string {
  if (canSayGuaranteed()) return "net garanti";
  return INTERVENANTS.paymentTerms === null
    ? "net, versé à date fixe"
    : `net, versé ${INTERVENANTS.paymentTerms}`;
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
