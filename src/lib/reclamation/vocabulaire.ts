/**
 * Le vocabulaire des réclamations.
 *
 * Module **pur**, et il l'est pour une raison précise : les libellés et la
 * forme d'une réclamation sont lus par un composant client, tandis que la
 * lecture en base est `server-only`. Les garder ensemble tirait tout le client
 * Prisma dans le graphe du navigateur — le typage ne le voyait pas, le
 * compilateur si.
 *
 * C'est la même séparation que `mission/notation.ts` et `mission/avis.ts` :
 * ce qui décrit d'un côté, ce qui écrit de l'autre.
 */

export const CATEGORIES_RECLAMATION = [
  "PROPRETE",
  "RETARD",
  "COMPORTEMENT",
  "CASSE",
  "AUTRE",
] as const;

export type CategorieReclamation = (typeof CATEGORIES_RECLAMATION)[number];

export const LIBELLES_CATEGORIES: Record<CategorieReclamation, string> = {
  PROPRETE: "Ménage insuffisant",
  RETARD: "Retard ou horaire non respecté",
  COMPORTEMENT: "Comportement",
  CASSE: "Objet abîmé",
  AUTRE: "Autre",
};

export const STATUTS_RECLAMATION = [
  "OUVERTE",
  "EN_COURS",
  "RESOLUE",
  "CLASSEE",
] as const;

export type StatutReclamation = (typeof STATUTS_RECLAMATION)[number];

/**
 * Une réclamation close sans rien décider n'existe pas.
 *
 * `CLASSEE` est le classement sans suite, et il **exige une résolution écrite**
 * comme `RESOLUE` : « on n'a rien fait » est une décision qui se justifie, et
 * qui se relit quand la même personne rappelle.
 */
export const STATUTS_CLOS: readonly StatutReclamation[] = [
  "RESOLUE",
  "CLASSEE",
];

/** Longueur minimale d'une résolution écrite. */
export const RESOLUTION_MINIMUM = 10;

export interface ReclamationVue {
  id: string;
  categorie: string;
  statut: string;
  priorite: string;
  description: string | null;
  ouvertParLaNote: boolean;
  ouverteLe: string;
  resolueLe: string | null;
  resolution: string | null;
  client: string;
  telephone: string | null;
  bookingId: string | null;
  quand: string | null;
  commune: string | null;
  intervenant: string | null;
  etoiles: number | null;
}
