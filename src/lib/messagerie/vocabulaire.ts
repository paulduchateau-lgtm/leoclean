/**
 * La forme d'un fil de messages.
 *
 * Module **pur**, pour la même raison que `reclamation/vocabulaire.ts` : ces
 * types sont lus par un composant client, tandis que la lecture en base est
 * `server-only`. Les garder ensemble tirerait le client Prisma dans le graphe
 * du navigateur — le typage ne le voit pas, le compilateur si.
 */

export interface FilVue {
  /** L'identifiant du fil. Il ne désigne plus une réservation mais un couple. */
  conversationId: string;
  /**
   * La dernière intervention connue de ce couple, pour situer le fil.
   *
   * Indicative : le fil dure au-delà d'elle. `null` quand aucune intervention
   * n'y est rattachée, ce qui arrive à un fil dont les réservations ont été
   * effacées au titre du RGPD.
   */
  quand: string | null;
  commune: string | null;
  /**
   * Le prénom de l'autre personne du fil.
   *
   * Côté intervenant c'est le client, côté client c'est l'intervenant : le fil
   * est le même objet vu des deux bords, et le nommer « clientPrenom » aurait
   * obligé le second à lire un champ qui dit le contraire de ce qu'il porte.
   */
  interlocuteur: string | null;
  /** Portrait de l'interlocuteur, ou `null` — l'avatar retombe sur ses initiales. */
  photoUrl: string | null;
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
