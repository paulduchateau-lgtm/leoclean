import type { BasisPoints } from "./money";

import { estDimanche, estFerie, estSamedi } from "./feries";

/**
 * Majorations de prix, et surtout : **qui les touche**.
 *
 * Module **pur** — il reçoit un instant et rend des lignes, sans base ni
 * horloge implicite.
 *
 * Le dépôt facturait jusqu'ici un dimanche au prix d'un mardi. Ce n'est pas
 * qu'une perte de recette : cela demande à quelqu'un de travailler le week-end
 * pour le même tarif que la semaine, ce qui finit par se voir dans les refus.
 *
 * **Une majoration a un bénéficiaire, et il change selon sa cause.** La
 * majoration de jour — samedi, dimanche, férié — revient à l'intervenant :
 * c'est lui qui travaille le week-end. La majoration de délai — réservation à
 * moins de 48 heures — revient à la plateforme : c'est elle qui place une
 * mission en urgence, sans tournée à remplir ni trajet à amortir.
 *
 * Ce partage prolonge la règle que le dépôt tient depuis le début — la marge
 * est un écart, pas un taux — et il évite la question insoluble d'un
 * pourcentage réparti au prorata.
 */

export type CauseMajoration = "SAMEDI" | "DIMANCHE_FERIE" | "COURT_DELAI";

export type Beneficiaire = "PROFESSIONAL" | "PLATFORM";

export interface RegleMajoration {
  cause: CauseMajoration;
  rateBp: BasisPoints;
  beneficiaire: Beneficiaire;
  /** Libellé lu par le client, sur la ligne de devis. */
  label: string;
}

/**
 * Délai en deçà duquel une réservation est dite de dernière minute.
 *
 * Quarante-huit heures : c'est l'horizon en dessous duquel une mission ne
 * s'insère plus dans une tournée en construction, mais se place au forceps
 * dans une journée déjà arrêtée.
 */
export const COURT_DELAI_HEURES = 48;

/**
 * La grille par défaut, celle de la marketplace.
 *
 * Elle vit ici et dans `public-grid.ts` pour l'affichage, et en base
 * (`PricingSurcharge`) pour ce qui est facturé — la même construction que les
 * tarifs, et pour la même raison : une société cliente du SaaS fixe les siens.
 */
export const MAJORATIONS_PAR_DEFAUT: readonly RegleMajoration[] = [
  {
    cause: "SAMEDI",
    rateBp: 1000,
    beneficiaire: "PROFESSIONAL",
    label: "Samedi",
  },
  {
    cause: "DIMANCHE_FERIE",
    rateBp: 2500,
    beneficiaire: "PROFESSIONAL",
    label: "Dimanche ou jour férié",
  },
  {
    cause: "COURT_DELAI",
    rateBp: 1000,
    beneficiaire: "PLATFORM",
    label: "Réservation de dernière minute",
  },
];

export interface MajorationApplicable {
  cause: CauseMajoration;
  label: string;
  rateBp: BasisPoints;
  beneficiaire: Beneficiaire;
}

/**
 * Quelles majorations s'appliquent à cette intervention ?
 *
 * **Samedi et dimanche ne se cumulent pas** : une journée n'est pas les deux.
 * Un férié qui tombe un samedi relève du taux le plus élevé — c'est un férié
 * avant d'être un samedi, et le contraire ferait payer moins cher le 25
 * décembre qu'un samedi ordinaire dès lors qu'il tombe en fin de semaine.
 */
export function majorationsApplicables(
  debut: Date,
  reserveeLe: Date,
  regles: readonly RegleMajoration[] = MAJORATIONS_PAR_DEFAUT,
): MajorationApplicable[] {
  const applicables: MajorationApplicable[] = [];

  const ferie = estFerie(debut);
  const jour: CauseMajoration | null =
    ferie || estDimanche(debut)
      ? "DIMANCHE_FERIE"
      : estSamedi(debut)
        ? "SAMEDI"
        : null;

  if (jour) {
    const regle = regles.find((candidate) => candidate.cause === jour);
    if (regle && regle.rateBp > 0) {
      applicables.push({
        cause: regle.cause,
        /* Nommer le férié vaut mieux qu'un libellé générique : « Assomption »
           se comprend, « majoration jour spécial » se conteste. */
        label: ferie ? ferie.nom : regle.label,
        rateBp: regle.rateBp,
        beneficiaire: regle.beneficiaire,
      });
    }
  }

  const heuresAvant = (debut.getTime() - reserveeLe.getTime()) / 3_600_000;
  if (heuresAvant < COURT_DELAI_HEURES) {
    const regle = regles.find((candidate) => candidate.cause === "COURT_DELAI");
    if (regle && regle.rateBp > 0) {
      applicables.push({
        cause: regle.cause,
        label: regle.label,
        rateBp: regle.rateBp,
        beneficiaire: regle.beneficiaire,
      });
    }
  }

  return applicables;
}

export interface LigneMajoration extends MajorationApplicable {
  amountCents: number;
}

export interface RepartitionMajorations {
  lignes: LigneMajoration[];
  /** Total ajouté au prix client. */
  totalCents: number;
  /** Part qui revient à l'intervenant. */
  professionalCents: number;
  /** Part qui revient à la plateforme, déduite et jamais calculée à part. */
  platformCents: number;
}

/**
 * Chiffre les majorations sur une base donnée.
 *
 * **Chaque majoration porte sur le montant de base, jamais sur le résultat de
 * la précédente.** Un cumul multiplicatif ferait qu'un dimanche de dernière
 * minute coûte 37,5 % de plus au lieu de 35 %, écart que personne ne saurait
 * expliquer à un client — et que personne ne remarquerait avant qu'il le
 * calcule lui-même.
 *
 * La part de la plateforme est **déduite** du total, jamais additionnée : c'est
 * la règle du dépôt sur toutes les répartitions, et elle garantit que la somme
 * retombe au centime près quels que soient les arrondis.
 */
export function chiffrerMajorations(
  baseCents: number,
  applicables: readonly MajorationApplicable[],
): RepartitionMajorations {
  const lignes: LigneMajoration[] = applicables.map((majoration) => ({
    ...majoration,
    amountCents: Math.round((baseCents * majoration.rateBp) / 10_000),
  }));

  const totalCents = lignes.reduce(
    (somme, ligne) => somme + ligne.amountCents,
    0,
  );
  const professionalCents = lignes
    .filter((ligne) => ligne.beneficiaire === "PROFESSIONAL")
    .reduce((somme, ligne) => somme + ligne.amountCents, 0);

  return {
    lignes,
    totalCents,
    professionalCents,
    platformCents: totalCents - professionalCents,
  };
}
