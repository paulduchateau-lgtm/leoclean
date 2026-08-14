/**
 * Arithmétique monétaire.
 *
 * Tout montant est un entier de centimes. Aucun flottant ne représente de
 * l'argent : `0.1 + 0.2` ne vaut pas `0.3`, et une facture fausse d'un centime
 * est un litige avec le client comme un rejet côté URSSAF.
 *
 * Les fonctions de ce module garantissent une propriété que le reste du code
 * peut tenir pour acquise : **une répartition additionne toujours exactement au
 * total**. On ne calcule jamais les deux parts indépendamment pour espérer
 * qu'elles retombent juste ; on calcule l'une et on déduit l'autre.
 */

/** Points de base : 10 000 = 100 %. Évite les pourcentages flottants. */
export type BasisPoints = number;

export const BASIS_POINTS_TOTAL = 10_000;

/**
 * Applique un taux à un montant, en arrondissant au centime le plus proche.
 *
 * L'arrondi est « à l'unité supérieure à partir de la moitié », convention de
 * la facturation française.
 */
export function applyRate(amountCents: number, rateBp: BasisPoints): number {
  assertInteger(amountCents, "montant");
  return Math.round((amountCents * rateBp) / BASIS_POINTS_TOTAL);
}

/**
 * Répartit un montant entre une part et son complément.
 *
 * La part est arrondie, le reste en est déduit : la somme vaut donc toujours
 * exactement le montant de départ, quel que soit le taux.
 */
export function split(
  amountCents: number,
  shareRateBp: BasisPoints,
): { share: number; remainder: number } {
  const share = applyRate(amountCents, shareRateBp);
  return { share, remainder: amountCents - share };
}

/** Taux effectif d'une part, en points de base. Zéro si le total est nul. */
export function effectiveRateBp(
  partCents: number,
  totalCents: number,
): BasisPoints {
  if (totalCents === 0) {
    return 0;
  }
  return Math.round((partCents * BASIS_POINTS_TOTAL) / totalCents);
}

/** Montant facturé pour une durée, au taux horaire donné. */
export function amountForDuration(
  hourlyRateCents: number,
  durationMinutes: number,
): number {
  assertInteger(hourlyRateCents, "taux horaire");
  assertInteger(durationMinutes, "durée");
  return Math.round((hourlyRateCents * durationMinutes) / 60);
}

/** Plafonne un montant, en préservant l'entier. */
export function capAmount(amountCents: number, maximumCents: number): number {
  return Math.min(amountCents, maximumCents);
}

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(
      `Le ${label} doit être un entier de centimes ; reçu ${value}. ` +
        `Aucun montant ne doit transiter en flottant.`,
    );
  }
}

/** Formatage en euros, à la française : « 29,00 € ». */
export function formatEuros(amountCents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

/** Formatage d'un taux horaire : « 29 €/h », sans décimales inutiles. */
export function formatHourlyRate(amountCents: number): string {
  const hasCents = amountCents % 100 !== 0;
  const formatted = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(amountCents / 100);
  return `${formatted}/h`;
}

/** Formatage d'une durée : « 2 h 30 », « 3 h ». */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest === 0
    ? `${hours} h`
    : `${hours} h ${String(rest).padStart(2, "0")}`;
}
