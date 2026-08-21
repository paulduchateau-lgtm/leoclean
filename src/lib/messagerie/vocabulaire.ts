/**
 * La forme d'un fil de messages.
 *
 * Module **pur**, pour la même raison que `reclamation/vocabulaire.ts` : ces
 * types sont lus par un composant client, tandis que la lecture en base est
 * `server-only`. Les garder ensemble tirerait le client Prisma dans le graphe
 * du navigateur — le typage ne le voit pas, le compilateur si.
 */

export interface FilVue {
  bookingId: string;
  quand: string;
  commune: string;
  /**
   * Le prénom de l'autre personne du fil.
   *
   * Côté intervenant c'est le client, côté client c'est l'intervenant : le fil
   * est le même objet vu des deux bords, et le nommer « clientPrenom » aurait
   * obligé le second à lire un champ qui dit le contraire de ce qu'il porte.
   */
  interlocuteur: string | null;
  dernierMessage: string | null;
  dernierLe: string | null;
  nonLus: number;
}

export interface MessageVue {
  id: string;
  body: string;
  createdAt: string;
  /** Écrit par la personne qui regarde l'écran, par opposition à l'autre. */
  deMoi: boolean;
}
