/**
 * Vérification des identifiants professionnels d'un intervenant.
 *
 * Module **pur** : aucune base, aucun réseau. Ce qu'il valide est la forme, et
 * la forme seule — qu'un SIRET soit bien construit ne dit pas qu'il est actif,
 * et c'est l'annuaire des entreprises qui le dira. Mais rejeter tout de suite
 * ce qui ne peut pas exister évite d'envoyer en vérification humaine des
 * dossiers qu'une clé de contrôle suffit à écarter.
 *
 * Les trois pièces qui bloquent l'activation sont contrôlées ici : le SIRET,
 * l'attestation de responsabilité civile professionnelle par sa date de
 * validité, et le numéro de déclaration Services à la personne.
 */

/** Chiffres seuls : les gens écrivent « 898 228 705 00015 ». */
function digitsOf(input: string): string {
  return input.replace(/[\s.-]/g, "");
}

/**
 * Clé de Luhn d'un SIRET.
 *
 * Le SIRET porte sa propre clé de contrôle : une faute de frappe sur un seul
 * chiffre est détectée sans interroger personne. C'est la vérification la plus
 * rentable du formulaire — elle coûte dix lignes et évite un aller-retour.
 */
function luhnValide(digits: string): boolean {
  let somme = 0;
  // On parcourt de droite à gauche, en doublant un chiffre sur deux.
  for (let position = 0; position < digits.length; position++) {
    const chiffre = Number(digits[digits.length - 1 - position]);
    if (position % 2 === 1) {
      const double = chiffre * 2;
      somme += double > 9 ? double - 9 : double;
    } else {
      somme += chiffre;
    }
  }
  return somme % 10 === 0;
}

/**
 * SIREN de La Poste, seule exception connue à la clé de Luhn.
 *
 * Ses établissements ne respectent pas l'algorithme : la règle y est que la
 * somme des chiffres soit divisible par cinq. L'exception est documentée par
 * l'INSEE ; l'ignorer rejetterait des SIRET parfaitement valides.
 */
const SIREN_LA_POSTE = "356000000";

export type SiretRefusal = "LONGUEUR" | "CLE_INVALIDE";

export function checkSiret(input: string): {
  valid: boolean;
  refusal: SiretRefusal | null;
  /** Forme normalisée, sans espaces : celle qu'on enregistre. */
  normalized: string;
} {
  const digits = digitsOf(input);

  if (!/^\d{14}$/.test(digits)) {
    return { valid: false, refusal: "LONGUEUR", normalized: digits };
  }

  const valide = digits.startsWith(SIREN_LA_POSTE)
    ? [...digits].reduce((somme, chiffre) => somme + Number(chiffre), 0) % 5 ===
      0
    : luhnValide(digits);

  return {
    valid: valide,
    refusal: valide ? null : "CLE_INVALIDE",
    normalized: digits,
  };
}

/** Les neuf premiers chiffres d'un SIRET : l'entreprise, sans l'établissement. */
export function sirenOf(siret: string): string {
  return digitsOf(siret).slice(0, 9);
}

export type SapRefusal = "FORMAT" | "SIREN_DIFFERENT";

/**
 * Numéro de déclaration Services à la personne.
 *
 * Il s'écrit « SAP » suivi du SIREN de l'organisme déclaré. Cette construction
 * autorise un recoupement gratuit et redoutable : **le numéro doit porter le
 * même SIREN que le SIRET déclaré**. Deux identités différentes dans le même
 * formulaire sont soit une faute de frappe, soit le numéro de quelqu'un
 * d'autre — et un numéro SAP emprunté ouvrirait un crédit d'impôt indu au
 * client, qui le rembourserait.
 */
export function checkSapNumber(
  input: string,
  siret: string | null,
): { valid: boolean; refusal: SapRefusal | null; normalized: string } {
  const normalized = input.replace(/[\s.-]/g, "").toUpperCase();

  if (!/^SAP\d{9}$/.test(normalized)) {
    return { valid: false, refusal: "FORMAT", normalized };
  }

  if (siret !== null && normalized.slice(3) !== sirenOf(siret)) {
    return { valid: false, refusal: "SIREN_DIFFERENT", normalized };
  }

  return { valid: true, refusal: null, normalized };
}

/**
 * L'attestation de responsabilité civile professionnelle est-elle valable ?
 *
 * On refuse une attestation qui expire avant la date à laquelle l'intervenant
 * commencerait à travailler, pas seulement une attestation déjà périmée : une
 * couverture qui s'arrête dans huit jours ne couvre pas une mission prise pour
 * le mois prochain.
 */
export const INSURANCE_MIN_REMAINING_DAYS = 30;

export function checkInsurance(
  expiresAt: Date | null,
  now: Date,
): { valid: boolean; expiringSoon: boolean } {
  if (expiresAt === null) return { valid: false, expiringSoon: false };

  const remainingDays = (expiresAt.getTime() - now.getTime()) / 86_400_000;
  return {
    valid: remainingDays > 0,
    expiringSoon:
      remainingDays > 0 && remainingDays < INSURANCE_MIN_REMAINING_DAYS,
  };
}

/** Motifs affichables tels quels : un code montré à quelqu'un n'explique rien. */
export function identifiantRefusalMessage(
  refusal: SiretRefusal | SapRefusal,
): string {
  switch (refusal) {
    case "LONGUEUR":
      return "Un SIRET compte quatorze chiffres. Vérifiez votre saisie.";
    case "CLE_INVALIDE":
      return "Ce SIRET ne passe pas sa clé de contrôle : il y a une faute de frappe quelque part.";
    case "FORMAT":
      return "Un numéro de déclaration s'écrit « SAP » suivi de neuf chiffres, par exemple SAP123456789.";
    case "SIREN_DIFFERENT":
      return "Ce numéro de déclaration n'appartient pas à l'entreprise dont vous avez donné le SIRET.";
  }
}
