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

/**
 * Numéro tel qu'on le lit : « 06 12 34 56 78 ».
 *
 * La base stocke la forme normalisée, sans espaces, parce que c'est elle qui
 * se compare. Un humain qui relit ses coordonnées, lui, n'y reconnaît pas son
 * numéro : dix chiffres collés se vérifient mal, et c'est précisément ce
 * qu'on lui demande de faire au récapitulatif.
 */
export function formatFrenchPhone(value: string): string {
  const normalized = normalizePhone(value);
  if (!isValidFrenchPhone(normalized)) {
    // Une forme inattendue est rendue telle quelle : mieux vaut un affichage
    // brut qu'un découpage qui inventerait des groupes.
    return value;
  }
  return normalized.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}
