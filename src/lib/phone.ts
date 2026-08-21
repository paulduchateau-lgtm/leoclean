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

/**
 * Le numéro mis en forme **pendant la frappe**, forme partielle comprise.
 *
 * `formatFrenchPhone` ne sait traiter qu'un numéro complet et valide : elle
 * rend l'entrée telle quelle dès qu'il manque un chiffre, ce qui la rend
 * inutilisable sur un champ en cours de saisie. Celle-ci groupe ce qu'elle a,
 * quel qu'en soit le nombre.
 *
 * **Trois précautions, toutes destinées à ne pas se battre avec la personne :**
 *
 * - le `+` initial est **conservé**. Le convertir en `0` à la volée ferait
 *   disparaître sous les doigts le caractère qu'on vient de taper, et c'est le
 *   plus sûr moyen de faire abandonner un champ ;
 * - rien n'est jamais **ajouté** en fin de chaîne — pas d'espace en attente du
 *   chiffre suivant. Un espace final que l'effacement doit franchir donne
 *   l'impression d'une touche morte ;
 * - au-delà de la longueur d'un numéro français, les chiffres excédentaires
 *   sont rendus sans groupement plutôt que tronqués. Tronquer ferait
 *   silencieusement perdre ce qui a été saisi ; la validation, elle, dira que
 *   c'est trop long.
 *
 * Le groupement suit l'usage français : par paires en forme nationale
 * (`06 84 36 38 62`), et un chiffre isolé après l'indicatif en forme
 * internationale (`+33 6 84 36 38 62`).
 */
export function formatFrenchPhoneAsTyped(input: string): string {
  const international = /^\s*(\+|00)/.test(input);
  const chiffres = input.replace(/\D/g, "");

  if (chiffres.length === 0) {
    // On garde le « + » seul : il vient d'être tapé, et le rendre vide le
    // ferait disparaître à l'instant même où on le saisit.
    return international && input.includes("+") ? "+" : "";
  }

  if (international) {
    const sansIndicatif = chiffres.replace(/^(?:33|0033)/, "");
    if (sansIndicatif.length === 0) return `+${chiffres}`;

    // Un numéro français international s'écrit indicatif, chiffre isolé, puis
    // paires : le premier zéro national disparaît, il ne se double pas.
    const national = sansIndicatif.replace(/^0/, "");
    const [tete, ...reste] = [
      national.slice(0, 1),
      ...grouper(national.slice(1)),
    ];
    return ["+33", tete, ...reste].filter(Boolean).join(" ");
  }

  return grouper(chiffres).join(" ");
}

/**
 * Groupe des chiffres par paires, sans rien inventer au-delà.
 *
 * Les chiffres en trop sortent d'un bloc : un numéro trop long est une faute
 * de frappe, et la découper en fausses paires la rendrait plus difficile à
 * repérer, pas moins.
 */
function grouper(chiffres: string): string[] {
  const groupes: string[] = [];
  const utiles = chiffres.slice(0, 10);
  for (let i = 0; i < utiles.length; i += 2) {
    groupes.push(utiles.slice(i, i + 2));
  }
  if (chiffres.length > 10) groupes.push(chiffres.slice(10));
  return groupes;
}

/**
 * Ce qui ne va pas dans ce numéro, ou `null` s'il est bon.
 *
 * Rend un message plutôt qu'un booléen : « numéro invalide » n'apprend rien à
 * quelqu'un qui a tapé neuf chiffres au lieu de dix, et c'est la faute la plus
 * fréquente. Un champ vide ne rend **pas** d'erreur — l'obligation de le
 * remplir est dite par le formulaire, pas par le validateur.
 */
export function diagnosticPhone(input: string): string | null {
  const normalise = normalizePhone(input);
  if (normalise.length === 0) return null;
  if (isValidFrenchPhone(normalise)) return null;

  const chiffres = normalise.replace(/\D/g, "");
  if (normalise.length !== chiffres.length) {
    return "Ce numéro contient un caractère inattendu.";
  }
  if (chiffres.length < 10) {
    return `Il manque ${10 - chiffres.length} chiffre${10 - chiffres.length > 1 ? "s" : ""}.`;
  }
  if (chiffres.length > 10) {
    return "Ce numéro a trop de chiffres.";
  }
  if (!chiffres.startsWith("0")) {
    return "Un numéro français commence par 0, ou par +33.";
  }
  // Dix chiffres, commençant par 0, mais un second chiffre à 0 : le seul cas
  // qui reste, et le dire précisément évite de chercher ailleurs.
  return "Le chiffre après le 0 ne peut pas être un 0.";
}
