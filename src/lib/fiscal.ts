import { clientEnv } from "./env";
import { TAX_CREDIT_RATE_BP } from "./pricing/public-grid";
import { SITE } from "./site";

/**
 * Régime fiscal des prestations, et ce que le site a le droit d'en dire.
 *
 * Un service à la personne ouvre droit à une réduction d'impôt de 50 % — mais
 * seulement s'il est rendu par un organisme **déclaré**. Tant que la
 * déclaration n'est pas obtenue, en parler comme d'un acquis promet un droit
 * que les prestations n'ouvrent pas encore. Ce module est l'unique endroit où
 * cette frontière est tranchée : aucune page ne décide seule si elle peut
 * afficher un prix après réduction.
 *
 * **Le statut n'est pas écrit ici, il est dérivé.** Le dépôt pilotait déjà
 * l'affichage fiscal par `NEXT_PUBLIC_SAP_DECLARED`, validé par Zod et lu par
 * huit fichiers. Poser à côté un second interrupteur écrit en dur créerait
 * deux vérités concurrentes, et la question ne serait plus « sommes-nous
 * déclarés ? » mais « lequel des deux dit vrai ? ». Le basculement ne coûte
 * donc aucune ligne de code : une variable d'environnement, et le numéro dans
 * `site.ts`.
 *
 * **Les deux sont exigés.** Un statut « déclaré » sans numéro afficherait une
 * mention invérifiable, ce qui est précisément ce que la mention sert à
 * éviter. Le drapeau seul ne suffit donc pas à basculer, et c'est voulu : la
 * direction sûre est celle qui n'affirme rien.
 *
 * Vocabulaire : l'entretien de la maison relève de la **déclaration** (dépôt
 * d'un récépissé auprès de la DDETS), l'**agrément** étant réservé aux
 * activités auprès de publics fragiles. La copy dit donc « déclaration », et
 * jamais « agréé ».
 */

export type SapStatus = "pending" | "declared";

const declared: boolean =
  clientEnv.NEXT_PUBLIC_SAP_DECLARED === true &&
  SITE.sapDeclarationNumber !== null;

const status: SapStatus = declared ? "declared" : "pending";

/**
 * Plafond annuel de dépenses ouvrant droit à la réduction, en centimes.
 *
 * 12 000 € de droit commun (CGI, art. 199 sexdecies), majorable selon la
 * composition du foyer. On annonce le cas général : détailler les majorations
 * sur une page d'accueil ferait passer un avantage pour une déclaration de
 * revenus.
 */
export const CREDIT_IMPOT_ANNUAL_CAP_CENTS = 1_200_000;

export const FISCAL = {
  sap: {
    status,

    /** Numéro de déclaration, jamais affiché tant qu'il n'existe pas. */
    number: declared ? SITE.sapDeclarationNumber : null,

    /**
     * Libellé affiché dans le bandeau de cadre et le pied de page.
     *
     * « En cours » décrit un dossier déposé et non encore instruit. C'est une
     * affirmation sur une situation administrative : elle est vraie ou elle ne
     * s'écrit pas.
     */
    label: declared
      ? `Déclaration SAP n° ${SITE.sapDeclarationNumber}`
      : "Déclaration SAP en cours",
  },

  creditImpot: {
    /** Taux de la réduction, en points de base. 5 000 = 50 %. */
    rateBp: TAX_CREDIT_RATE_BP,
    annualCapCents: CREDIT_IMPOT_ANNUAL_CAP_CENTS,

    /**
     * Avance immédiate de crédit d'impôt (Urssaf).
     *
     * Elle suppose non seulement la déclaration, mais l'adhésion au service et
     * un circuit de paiement raccordé. Elle a donc son propre interrupteur :
     * être déclaré ne suffit pas à la promettre.
     */
    aiciEnabled: false,
  },
} as const;

/**
 * Le site peut-il afficher un montant après réduction d'impôt ?
 *
 * Un seul prédicat, lu partout, plutôt qu'un `status === "declared"` recopié
 * dans chaque composant : une comparaison dupliquée est une comparaison qu'on
 * oubliera de corriger quelque part.
 */
export function canShowTaxCredit(): boolean {
  return FISCAL.sap.status === "declared";
}

/**
 * Montant restant à charge après réduction d'impôt, en centimes.
 *
 * Calculé et retourné en toutes circonstances — le dépôt calcule et stocke
 * toujours le crédit d'impôt, seul l'affichage est conditionné. C'est
 * `canShowTaxCredit()` qui décide de le montrer, pas cette fonction.
 */
export function afterTaxCreditCents(amountCents: number): number {
  return (
    amountCents - Math.round((amountCents * FISCAL.creditImpot.rateBp) / 10_000)
  );
}

/**
 * Conditions de la réduction, en une phrase.
 *
 * Réservée aux blocs dédiés — page tarifs, FAQ — jamais à une carte de prix :
 * une condition en petits caractères sous un tarif est une condition que
 * personne ne lit.
 */
export function creditImpotConditions(): string {
  const cap = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(FISCAL.creditImpot.annualCapCents / 100);

  const base =
    `Réduction d'impôt de ${FISCAL.creditImpot.rateBp / 100} % sur les sommes versées, ` +
    `dans la limite de ${cap} de dépenses par an pour un foyer sans majoration, ` +
    `sous réserve d'éligibilité.`;

  return FISCAL.creditImpot.aiciEnabled
    ? `${base} L'avance immédiate déduit la réduction au moment du paiement.`
    : base;
}
