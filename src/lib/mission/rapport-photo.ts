/**
 * Le vocabulaire du rapport photo.
 *
 * Module **pur**, pour la raison qui s'est déjà présentée deux fois : ces
 * valeurs sont lues par un composant client, tandis que le dépôt est
 * `server-only` et tire le SDK S3. Les garder ensemble mettait le client de
 * stockage dans le graphe du navigateur — le typage ne le voit pas, le
 * compilateur si, et la construction s'arrête.
 */

export type PhasePhoto = "AVANT" | "APRES";

/** Au-delà, ce n'est plus un rapport, c'est un album. */
export const PHOTOS_MAXIMUM_PAR_PHASE = 8;

/**
 * Ce qu'on demande, sans jamais l'exiger.
 *
 * Deux avant, deux après. Le rapport ne retient ni la fin de mission ni le
 * paiement : un produit qui empêche de travailler pour protéger une mesure
 * obtient des mesures fausses.
 */
export const PHOTOS_ATTENDUES_PAR_PHASE = 2;

export interface PhotoVue {
  id: string;
  phase: string;
  piece: string | null;
  priseLe: string | null;
}
