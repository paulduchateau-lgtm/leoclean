/**
 * Attestation fiscale annuelle.
 *
 * Module **pur**. Il décide de ce qu'une attestation a le droit de déclarer, et
 * la règle centrale est celle que l'on rate le plus souvent :
 *
 * **L'avantage fiscal porte sur les sommes _effectivement versées_ au cours de
 * l'année civile** (CGI, art. 199 sexdecies), et non sur celles facturées. Une
 * prestation de décembre payée en janvier appartient à l'année du paiement.
 * Bâtir l'attestation sur les factures produirait un montant faux pour tout
 * client servi à cheval sur deux années — c'est-à-dire pour un abonné, donc
 * pour la clientèle que le service vise.
 *
 * Deux corollaires, tout aussi structurants :
 *
 * - **Un remboursement diminue la somme versée.** Attester d'un montant qu'on a
 *   rendu ferait déduire au client un impôt qu'il devra restituer.
 * - **Des frais d'annulation ne sont pas éligibles.** Ils indemnisent un créneau
 *   perdu ; aucune prestation n'a été rendue, et le crédit d'impôt rémunère un
 *   service, pas un dédommagement.
 *
 * Et une condition de forme : **seul un organisme déclaré peut attester.** Sans
 * numéro de déclaration, l'attestation n'a aucune valeur et exposerait celui
 * qui l'a signée autant que celui qui s'en est servi.
 */

export const ARTICLE = "199 sexdecies du code général des impôts";

/**
 * Plafond annuel de dépenses de droit commun, en centimes.
 *
 * **Il n'est jamais appliqué au montant attesté**, et c'est délibéré :
 * l'attestation rapporte ce qui a été versé, l'administration applique le
 * plafond sur l'ensemble du foyer, qui peut employer plusieurs organismes. Le
 * plafonner ici sous-déclarerait le client dès qu'il fait aussi appel à
 * quelqu'un d'autre. On l'annonce, on ne le calcule pas.
 */
export const PLAFOND_ANNUEL_CENTS = 1_200_000;

export interface LigneVersement {
  /** Instant de l'encaissement réel, jamais celui de la facture. */
  encaisseLe: Date;
  montantCents: number;
  rembourseCents: number;
  /**
   * Part de ce versement ouvrant droit, pour cet organisme-là. Elle vaut zéro
   * lorsque l'émetteur n'est pas déclaré — voir `document.partEligible`.
   */
  eligibleCents: number;
  /**
   * La prestation a-t-elle été rendue ? Faux pour des frais d'annulation, qui
   * indemnisent un créneau perdu et n'ouvrent aucun droit.
   */
  prestationRealisee: boolean;
}

export interface Organisme {
  nom: string;
  adresse: readonly string[];
  siret: string;
  /** Sans lui, rien ne s'atteste. */
  numeroSap: string | null;
}

export interface Beneficiaire {
  nom: string;
  adresse: readonly string[];
}

export interface Attestation {
  annee: number;
  organisme: Organisme;
  beneficiaire: Beneficiaire;
  /** Total encaissé sur des prestations réalisées, remboursements déduits. */
  verseCents: number;
  /** Part de ce total ouvrant droit à l'avantage fiscal. */
  eligibleCents: number;
  /** Nombre de prestations réglées dans l'année. */
  prestations: number;
  /** Ce que l'attestation écarte, dit plutôt que tu. */
  ecarteCents: number;
}

export type RefusAttestation =
  "ORGANISME_NON_DECLARE" | "ANNEE_NON_CLOSE" | "AUCUN_VERSEMENT";

export const MESSAGES_REFUS: Record<RefusAttestation, string> = {
  ORGANISME_NON_DECLARE:
    "Cet organisme n'a pas encore de numéro de déclaration Services à la personne : il ne peut rien attester.",
  ANNEE_NON_CLOSE:
    "L'attestation d'une année s'établit une fois l'année terminée, sur les sommes réellement versées.",
  AUCUN_VERSEMENT: "Aucune somme n'a été versée cette année-là.",
};

/**
 * L'année est-elle terminée ?
 *
 * L'attestation porte sur une année civile close. En émettre une en cours
 * d'année donnerait un document que le client joindrait à sa déclaration, et
 * qui serait faux dès la prestation suivante.
 */
export function anneeClose(annee: number, maintenant: Date): boolean {
  const anneeCourante = Number(
    new Intl.DateTimeFormat("fr-FR", {
      year: "numeric",
      timeZone: "Europe/Paris",
    }).format(maintenant),
  );
  return annee < anneeCourante;
}

/** Les versements de l'année civile française, et d'elle seule. */
export function versementsDeLannee(
  lignes: readonly LigneVersement[],
  annee: number,
): LigneVersement[] {
  const format = new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  return lignes.filter(
    (ligne) => Number(format.format(ligne.encaisseLe)) === annee,
  );
}

export function composerAttestation(input: {
  annee: number;
  organisme: Organisme;
  beneficiaire: Beneficiaire;
  lignes: readonly LigneVersement[];
  maintenant: Date;
}): { attestation: Attestation } | { refus: RefusAttestation } {
  if (!input.organisme.numeroSap) return { refus: "ORGANISME_NON_DECLARE" };
  if (!anneeClose(input.annee, input.maintenant)) {
    return { refus: "ANNEE_NON_CLOSE" };
  }

  const lignes = versementsDeLannee(input.lignes, input.annee);

  let verseCents = 0;
  let eligibleCents = 0;
  let ecarteCents = 0;
  let prestations = 0;

  for (const ligne of lignes) {
    /*
     * Le remboursement se déduit avant tout le reste : c'est le montant net
     * resté chez l'organisme qui a été « versé » au sens du texte. Un
     * remboursement supérieur au versement — un geste commercial, par exemple —
     * ne rend pas la ligne négative : elle vaut zéro, et n'entame pas les
     * autres.
     */
    const net = Math.max(0, ligne.montantCents - ligne.rembourseCents);
    if (net === 0) continue;

    if (!ligne.prestationRealisee) {
      ecarteCents += net;
      continue;
    }

    prestations += 1;
    verseCents += net;

    /*
     * La part éligible suit la même réduction, au prorata : rembourser la
     * moitié d'une prestation ne laisse pas la totalité de son crédit d'impôt.
     * On arrondit **vers le bas**, un centime attesté en trop étant un centime
     * que le client devra restituer.
     */
    const proportionnelle =
      ligne.montantCents === 0
        ? 0
        : Math.floor((ligne.eligibleCents * net) / ligne.montantCents);
    eligibleCents += Math.min(proportionnelle, net);
  }

  if (verseCents === 0) return { refus: "AUCUN_VERSEMENT" };

  return {
    attestation: {
      annee: input.annee,
      organisme: input.organisme,
      beneficiaire: input.beneficiaire,
      verseCents,
      eligibleCents,
      prestations,
      ecarteCents,
    },
  };
}

/**
 * Les mentions que l'attestation doit porter.
 *
 * Les deux dernières comptent autant que le montant. **Les aides perçues
 * doivent être déduites** — CESU préfinancé, aide de l'employeur, APA, PCH — et
 * un client qui déclare le montant brut se fait redresser. Taire cet
 * avertissement reviendrait à lui remettre un document qui l'induit en erreur.
 */
export function mentionsAttestation(attestation: Attestation): string[] {
  const plafond = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(PLAFOND_ANNUEL_CENTS / 100);

  const mentions = [
    `Les sommes ci-dessus sont celles que vous avez effectivement versées entre le 1ᵉʳ janvier et le 31 décembre ${attestation.annee}.`,
    `Elles ouvrent droit à l'avantage fiscal prévu à l'article ${ARTICLE}, dans la limite de ${plafond} de dépenses par an pour un foyer sans majoration.`,
    "Vous devez en déduire les aides que vous avez reçues pour ces mêmes prestations : CESU préfinancé, participation de votre employeur, APA, PCH.",
    "Ce document est établi sous la responsabilité de l'organisme qui le délivre. Conservez-le : l'administration peut vous le demander.",
  ];

  if (attestation.ecarteCents > 0) {
    /*
     * Le client a payé cette somme et ne la retrouve pas dans le total : le
     * silence produirait un appel, et l'impression d'une erreur.
     */
    mentions.push(
      "Les frais d'annulation que vous avez pu régler ne figurent pas dans ce total : ils indemnisent un créneau réservé et n'ouvrent pas droit à l'avantage fiscal.",
    );
  }

  return mentions;
}
