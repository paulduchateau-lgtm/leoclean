/**
 * Le document « facture ».
 *
 * Module **pur**, et volontairement séparé de son écriture en base : ce qui
 * doit figurer sur une facture est une question de droit, pas de schéma, et
 * cela se vérifie sans PostgreSQL.
 *
 * La prestation est vendue à un **particulier**. Le régime applicable n'est
 * donc pas celui des factures entre professionnels — pénalités de retard,
 * indemnité forfaitaire de 40 €, mentions de l'article L441-9 du code de
 * commerce — mais celui de la « note » de l'arrêté n° 83-50/A du 3 octobre
 * 1983, obligatoire pour toute prestation de services dépassant 25 €. Elle
 * exige : la date de rédaction, l'identité et l'adresse du prestataire, le nom
 * du client, la date et le lieu d'exécution, le **décompte détaillé en quantité
 * et en prix** de chaque prestation, et la somme totale à payer.
 *
 * On y ajoute ce que la situation impose : la mention de TVA, celle
 * d'autofacturation, et celle de la déclaration Services à la personne.
 */

export type RegimeTva =
  /** Franchise en base : aucune TVA facturée, article 293 B du CGI. */
  | "FRANCHISE_EN_BASE"
  /** Assujetti : la TVA est due et doit figurer, taux et montant. */
  | "ASSUJETTI";

export interface Emetteur {
  /** Raison sociale ou nom de l'entrepreneur individuel. */
  nom: string;
  formeJuridique: string | null;
  /** Adresse, une ligne par élément. */
  adresse: readonly string[];
  siret: string;
  regimeTva: RegimeTva;
  /** Taux de TVA en points de base, exigé si assujetti. 2 000 = 20 %. */
  tauxTvaBp: number | null;
  /**
   * Numéro de déclaration Services à la personne.
   *
   * **Nul tant qu'il n'existe pas**, et c'est lui qui commande l'éligibilité au
   * crédit d'impôt de cette facture-là. Un organisme non déclaré n'ouvre aucun
   * droit, même si l'autre facture de la même prestation en ouvre un.
   */
  numeroSap: string | null;
  /**
   * La facture est établie par la plateforme au nom et pour le compte de
   * l'émetteur — article 289, I-2 du CGI. La mention correspondante est alors
   * obligatoire, et son absence rend la facture irrégulière.
   */
  autofacturee: boolean;
}

export interface Destinataire {
  nom: string;
  adresse: readonly string[];
}

export interface LigneFacture {
  designation: string;
  /** Quantité en centièmes d'unité : 3 h 30 valent 350. */
  quantiteCentiemes: number;
  unite: string;
  prixUnitaireCents: number;
  totalCents: number;
}

export interface Facture {
  numero: string;
  /** Date de rédaction du document. */
  emiseLe: string;
  /** Date d'exécution de la prestation — mention obligatoire. */
  executeeLe: string;
  /** Lieu d'exécution — mention obligatoire. */
  lieu: string;
  emetteur: Emetteur;
  destinataire: Destinataire;
  lignes: readonly LigneFacture[];
  /** Total hors taxes. Égal au TTC en franchise en base. */
  totalHtCents: number;
  tvaCents: number;
  totalTtcCents: number;
  /**
   * Part ouvrant droit au crédit d'impôt, telle qu'elle sera reprise sur
   * l'attestation annuelle. **Zéro si l'émetteur n'est pas déclaré.**
   */
  eligibleCreditImpotCents: number;
}

/** Le nom de la plateforme, pour la mention d'autofacturation. */
export const MANDATAIRE = "Léo Clean";

/**
 * Les mentions à imprimer en pied de facture.
 *
 * Elles sont **engendrées depuis les faits de la facture**, jamais recopiées
 * dans un gabarit : une mention de TVA qui ne suivrait pas le régime réel de
 * l'émetteur est une facture irrégulière, et le gabarit est précisément
 * l'endroit où l'on oublie de la changer.
 */
export function mentionsObligatoires(facture: Facture): string[] {
  const mentions: string[] = [];

  if (facture.emetteur.regimeTva === "FRANCHISE_EN_BASE") {
    mentions.push("TVA non applicable, article 293 B du CGI.");
  }

  if (facture.emetteur.autofacturee) {
    mentions.push(
      `Facture établie par ${MANDATAIRE} au nom et pour le compte de ${facture.emetteur.nom}, ` +
        "conformément au mandat de facturation accepté par ce dernier.",
    );
  }

  if (facture.emetteur.numeroSap) {
    mentions.push(
      `Prestation de services à la personne. Organisme déclaré sous le numéro ${facture.emetteur.numeroSap}.`,
    );
  }

  /*
   * Le crédit d'impôt n'est annoncé que si l'émetteur est déclaré. L'écrire sur
   * la facture d'un intervenant qui ne l'est pas ferait porter au client une
   * réduction que l'administration lui reprendrait — avec les intérêts.
   */
  if (facture.eligibleCreditImpotCents > 0 && facture.emetteur.numeroSap) {
    mentions.push(
      "Cette prestation ouvre droit à l'avantage fiscal de l'article 199 sexdecies du CGI. " +
        "Une attestation annuelle récapitulant les sommes effectivement versées vous sera adressée.",
    );
  }

  mentions.push("Paiement par carte bancaire, à l'issue de la prestation.");

  return mentions;
}

export type ManqueFacture =
  | "NUMERO"
  | "DATE_EMISSION"
  | "DATE_EXECUTION"
  | "LIEU"
  | "EMETTEUR_NOM"
  | "EMETTEUR_ADRESSE"
  | "EMETTEUR_SIRET"
  | "DESTINATAIRE_NOM"
  | "AUCUNE_LIGNE"
  | "LIGNE_INCOMPLETE"
  | "TOTAL_INCOHERENT"
  | "TVA_SANS_TAUX"
  | "CREDIT_IMPOT_SANS_DECLARATION";

export const MESSAGES_MANQUE: Record<ManqueFacture, string> = {
  NUMERO: "La facture n'a pas de numéro.",
  DATE_EMISSION: "La date de rédaction manque.",
  DATE_EXECUTION: "La date d'exécution de la prestation manque.",
  LIEU: "Le lieu d'exécution manque.",
  EMETTEUR_NOM: "Le nom du prestataire manque.",
  EMETTEUR_ADRESSE: "L'adresse du prestataire manque.",
  EMETTEUR_SIRET: "Le SIRET du prestataire manque.",
  DESTINATAIRE_NOM: "Le nom du client manque.",
  AUCUNE_LIGNE: "Le décompte détaillé des prestations manque.",
  LIGNE_INCOMPLETE:
    "Une ligne ne porte pas sa quantité ou son prix unitaire : le décompte doit être détaillé.",
  TOTAL_INCOHERENT: "Le total ne correspond pas à la somme des lignes.",
  TVA_SANS_TAUX: "Un émetteur assujetti doit faire figurer le taux de TVA.",
  CREDIT_IMPOT_SANS_DECLARATION:
    "Une part éligible au crédit d'impôt est annoncée sans numéro de déclaration SAP.",
};

/**
 * Cette facture est-elle régulière ?
 *
 * Rend la liste de ce qui manque. Elle n'est pas décorative : `emission.ts`
 * refuse d'écrire une facture qui ne la passe pas, parce qu'une facture
 * irrégulière déjà remise au client ne se corrige que par un avoir — un second
 * document, et une explication.
 */
export function verifierLaFacture(facture: Facture): ManqueFacture[] {
  const manques: ManqueFacture[] = [];

  if (!facture.numero.trim()) manques.push("NUMERO");
  if (!facture.emiseLe) manques.push("DATE_EMISSION");
  if (!facture.executeeLe) manques.push("DATE_EXECUTION");
  if (!facture.lieu.trim()) manques.push("LIEU");

  if (!facture.emetteur.nom.trim()) manques.push("EMETTEUR_NOM");
  if (facture.emetteur.adresse.length === 0) manques.push("EMETTEUR_ADRESSE");
  if (!facture.emetteur.siret.trim()) manques.push("EMETTEUR_SIRET");
  if (!facture.destinataire.nom.trim()) manques.push("DESTINATAIRE_NOM");

  if (facture.lignes.length === 0) {
    manques.push("AUCUNE_LIGNE");
  } else if (
    facture.lignes.some(
      (ligne) =>
        ligne.quantiteCentiemes <= 0 ||
        ligne.prixUnitaireCents <= 0 ||
        !ligne.designation.trim(),
    )
  ) {
    manques.push("LIGNE_INCOMPLETE");
  }

  const somme = facture.lignes.reduce(
    (total, ligne) => total + ligne.totalCents,
    0,
  );
  if (
    somme !== facture.totalHtCents ||
    facture.totalHtCents + facture.tvaCents !== facture.totalTtcCents
  ) {
    manques.push("TOTAL_INCOHERENT");
  }

  if (
    facture.emetteur.regimeTva === "ASSUJETTI" &&
    (facture.emetteur.tauxTvaBp === null || facture.emetteur.tauxTvaBp <= 0)
  ) {
    manques.push("TVA_SANS_TAUX");
  }

  if (
    facture.eligibleCreditImpotCents > 0 &&
    facture.emetteur.numeroSap === null
  ) {
    manques.push("CREDIT_IMPOT_SANS_DECLARATION");
  }

  return manques;
}

/**
 * Part éligible au crédit d'impôt d'une facture.
 *
 * **Le calcul du devis dit ce qui serait éligible ; celui-ci dit ce qui l'est.**
 * La différence est le numéro de déclaration : sans lui, la part de cet
 * émetteur n'ouvre aucun droit, quelle que soit la nature de la prestation.
 *
 * C'est la seule règle du module qui décide d'argent, et elle est ramenée à une
 * ligne pour qu'aucun appelant ne soit tenté de la refaire.
 */
export function partEligible(
  montantCents: number,
  numeroSap: string | null,
): number {
  return numeroSap ? montantCents : 0;
}

/** Quantité lisible : 350 centièmes d'heure s'écrivent « 3,5 h ». */
export function quantiteLisible(ligne: LigneFacture): string {
  const valeur = (ligne.quantiteCentiemes / 100).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  });
  return `${valeur} ${ligne.unite}`;
}
