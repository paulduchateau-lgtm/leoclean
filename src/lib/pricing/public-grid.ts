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

/** Surface traitée en une heure pour un entretien courant. */
export const STANDARD_SQM_PER_HOUR = 25;

/** Taux du crédit d'impôt services à la personne, en points de base. */
export const TAX_CREDIT_RATE_BP = 5000;

/** Tarif le plus bas de la grille : le « à partir de » des pages publiques. */
export const LOWEST_HOURLY_RATE_CENTS = Math.min(
  ...PUBLIC_RATES.map((rate) => rate.hourlyRateCents),
);
