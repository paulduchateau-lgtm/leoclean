import { formatEuros, formatHourlyRate } from "./money";
import { MAJORATIONS_PAR_DEFAUT } from "./majorations";

/**
 * Grille tarifaire publique de Léo Clean.
 *
 * Source unique des prix affichés sur le site, dans les fichiers destinés aux
 * modèles de langage, et dans le seed. Les pages publiques ne lisent pas la
 * base : elles doivent être statiques et rapides, et un tarif marketing n'a pas
 * à dépendre d'une connexion.
 *
 * `PricingRule` en base reste la source opérationnelle, propre à chaque
 * organisation et historisée — une société cliente du SaaS a ses propres prix.
 * Cette grille-ci est celle de la marketplace, et le seed l'importe pour que
 * les deux ne puissent pas diverger.
 */

export interface PublicRate {
  key: "REGULIER" | "PONCTUEL";
  label: string;
  description: string;
  /** Ce que paie le client, par heure. */
  hourlyRateCents: number;
  /**
   * Ce que perçoit l'intervenant, par heure.
   *
   * C'est la grandeur primaire, et la marge de coordination s'en déduit — pas
   * l'inverse. Le modèle du dépôt le dit depuis le début : la rémunération est
   * un montant proposé à l'intervenant, qu'il accepte avant de prendre la
   * mission, jamais un pourcentage appliqué après coup.
   *
   * Conséquence directe : la marge n'est pas un taux unique. Elle vaut 5 € de
   * l'heure en régulier et 9 € en ponctuel, parce qu'une mission unique coûte
   * davantage à placer — trajet non amorti, pas de tournée à remplir, aucune
   * récurrence pour rentabiliser la mise en relation.
   */
  professionalHourlyRateCents: number;
}

export const PUBLIC_RATES: readonly PublicRate[] = [
  {
    key: "REGULIER",
    label: "Ménage régulier",
    description:
      "Toutes les semaines, tous les quinze jours ou une fois par mois, avec un intervenant attitré.",
    hourlyRateCents: 2800,
    professionalHourlyRateCents: 2300,
  },
  {
    key: "PONCTUEL",
    label: "Intervention ponctuelle",
    description:
      "Une seule fois, sans engagement : grand ménage, fin de bail, après réception.",
    hourlyRateCents: 3000,
    professionalHourlyRateCents: 2100,
  },
];

/** Durée minimale facturée, en minutes. */
export const MINIMUM_BILLABLE_MINUTES = 120;

/**
 * Surface traitée en une heure pour un entretien courant.
 *
 * **Écrite comme le rapport qu'elle sert, pas comme sa décimale.** La grille
 * voulue est 50 m² en 1 h 30, 100 m² en 3 h, 150 m² en 4 h 30 — soit cent
 * mètres carrés pour trois heures. `33.3` casserait l'aller-retour que
 * `surfaceForDuration` doit tenir : trois heures y rendraient 99 m², qui
 * réestimés donnent bien trois heures, mais affichent un mètre carré de moins
 * que ce qu'on a promis. `100 / 3` retombe juste, et un test le vérifie sur
 * tous les pas de la grille.
 *
 * Le rendement précédent était de 25 m²/h. Le relever raccourcit les durées
 * estimées d'un quart, donc les prix : c'est un arbitrage commercial du
 * porteur du projet (21 août 2026), pas un ajustement technique.
 */
export const STANDARD_SQM_PER_HOUR = 100 / 3;

/**
 * Le même rendement, tel qu'une phrase l'écrit.
 *
 * Les pages publiques impriment ce nombre en toutes lettres ; y verser
 * `33.33333333333333` serait illisible. Arrondi une fois ici plutôt que dans
 * chaque page, pour que les quatre surfaces qui le citent disent le même
 * chiffre.
 */
export const STANDARD_SQM_PER_HOUR_AFFICHE = Math.round(STANDARD_SQM_PER_HOUR);

/** Taux du crédit d'impôt services à la personne, en points de base. */
export const TAX_CREDIT_RATE_BP = 5000;

/** Tarif d'une formule, en centimes, cherché par sa clé. */
function tarif(key: "REGULIER" | "PONCTUEL"): number {
  return PUBLIC_RATES.find((rate) => rate.key === key)!.hourlyRateCents;
}

/**
 * Les tarifs, tels qu'une phrase les écrit.
 *
 * Le contenu éditorial cite des prix — pages communes, pages d'intention, page
 * tarifs. Recopiés à la main, ils survivent à un changement de grille et
 * laissent derrière eux des pages qui annoncent un tarif que le tunnel ne
 * pratique plus. C'est arrivé : la page tarifs a affiché 28 € dans son tableau
 * et 29 € dans sa prose, sur le même écran.
 *
 * Deux formes, parce que la langue en demande deux : « 28 €/h » dans un
 * tableau ou une méta-description, « 28 € de l'heure » dans une phrase.
 */
export const TARIF_REGULIER_HEURE = formatHourlyRate(tarif("REGULIER"));
export const TARIF_PONCTUEL_HEURE = formatHourlyRate(tarif("PONCTUEL"));
export const TARIF_REGULIER = formatHourlyRate(tarif("REGULIER")).replace(
  "/h",
  "",
);
export const TARIF_PONCTUEL = formatHourlyRate(tarif("PONCTUEL")).replace(
  "/h",
  "",
);

/**
 * Total d'un nombre d'heures, tel qu'une phrase l'écrit.
 *
 * Le contenu éditorial illustre les tarifs par des exemples — « trois heures,
 * soit 84 € ». Recopiés, ces totaux mentent au premier changement de grille, et
 * plus discrètement qu'un tarif horaire : personne ne les recalcule en lisant.
 */
export function totalRegulier(heures: number): string {
  return formatEuros(tarif("REGULIER") * heures);
}

export function totalPonctuel(heures: number): string {
  return formatEuros(tarif("PONCTUEL") * heures);
}

/** Tarif le plus bas de la grille : le « à partir de » des pages publiques. */
export const LOWEST_HOURLY_RATE_CENTS = Math.min(
  ...PUBLIC_RATES.map((rate) => rate.hourlyRateCents),
);

/**
 * Les majorations, telles que le site les annonce.
 *
 * Importées du moteur plutôt que recopiées : une valeur dupliquée finit
 * toujours par diverger, et celle-ci divergerait entre ce qu'on affiche et ce
 * qu'on facture — c'est-à-dire au pire endroit possible.
 *
 * Elles sont annoncées **avant** l'engagement, sur la page tarifs et dans le
 * tunnel. Une majoration découverte au récapitulatif est une majoration
 * contestée.
 */
export const PUBLIC_SURCHARGES = MAJORATIONS_PAR_DEFAUT.map((regle) => ({
  cause: regle.cause,
  label: regle.label,
  /** « +25 % », tel qu'il se lit. */
  display: `+${regle.rateBp / 100} %`.replace(".", ","),
}));

/** Délai en deçà duquel une réservation est majorée, en heures. */
export { COURT_DELAI_HEURES } from "./majorations";
