/**
 * Numéros de téléphone français.
 *
 * Les gens écrivent « 06 84 36 38 62 », « 0684363862 », « +33 6 84 36 38 62 »
 * ou « 06.84.36.38.62 ». Refuser l'une de ces formes ferait perdre une demande
 * pour une raison que l'internaute ne comprendrait pas — et ce serait la
 * dernière chose qu'il ferait sur le site.
 *
 * Isolé de tout formulaire : la même normalisation doit s'appliquer au
 * formulaire de rappel, au tunnel de réservation et à l'espace client, sans
 * quoi le même numéro existerait sous deux formes en base.
 */

export function normalizePhone(input: string): string {
  const digits = input.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+33")) {
    return `0${digits.slice(3)}`;
  }
  if (digits.startsWith("0033")) {
    return `0${digits.slice(4)}`;
  }
  return digits;
}

/** Vraie pour un numéro français à dix chiffres, une fois normalisé. */
export function isValidFrenchPhone(value: string): boolean {
  return /^0[1-9]\d{8}$/.test(value);
}
