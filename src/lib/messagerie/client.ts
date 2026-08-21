import "server-only";

import type { TenantClient } from "@/lib/db";
import type { FilVue } from "@/lib/messagerie/vocabulaire";

/**
 * La messagerie, côté client.
 *
 * Symétrique de `messagerie/intervenant.ts`, et pour la même raison : **le fil
 * est rattaché à l'intervention, pas au couple de personnes.** L'intervenant
 * peut changer d'une semaine sur l'autre ; un fil qui suivrait les personnes
 * mélangerait deux interventions sans rapport.
 *
 * Le client écrivait déjà, depuis un panneau ouvert sur chaque intervention —
 * mais il n'avait **aucun endroit où retrouver ses fils**. Répondre supposait
 * de se rappeler à quelle réservation on avait écrit, ce qui est exactement ce
 * qu'un index évite.
 *
 * L'appartenance se vérifie dans la requête, sur le profil client résolu depuis
 * la session : une intervention qui n'est pas la sienne est introuvable.
 */

export async function lireLesFilsDuClient(
  db: TenantClient,
  clientProfileId: string,
  userId: string,
): Promise<FilVue[]> {
  const reservations = await db.booking.findMany({
    where: { clientProfileId, messages: { some: {} } },
    orderBy: { scheduledStart: "desc" },
    take: 50,
    select: {
      id: true,
      scheduledStart: true,
      address: { select: { cityName: true } },
      assignments: {
        where: { status: { in: ["ACCEPTED", "COMPLETED"] } },
        take: 1,
        select: { cleaner: { select: { displayName: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true },
      },
    },
  });

  /*
   * Le compte des non-lus est demandé séparément : le compter dans la
   * projection ci-dessus obligerait à charger tous les messages de chaque fil
   * pour n'en garder que le nombre.
   */
  const nonLus = await db.message.groupBy({
    by: ["bookingId"],
    where: {
      recipientUserId: userId,
      readAt: null,
      bookingId: { in: reservations.map((reservation) => reservation.id) },
    },
    _count: { _all: true },
  });

  const parBooking = new Map(
    nonLus.map((ligne) => [ligne.bookingId, ligne._count._all]),
  );

  return reservations
    .map((reservation) => ({
      bookingId: reservation.id,
      quand: reservation.scheduledStart.toISOString(),
      commune: reservation.address.cityName,
      /*
       * Le prénom seul, jamais le nom complet : c'est la règle tenue partout
       * ailleurs pour les intervenants comme pour les clients.
       */
      interlocuteur:
        reservation.assignments[0]?.cleaner.displayName.split(" ")[0] ?? null,
      dernierMessage: reservation.messages[0]?.body ?? null,
      dernierLe: reservation.messages[0]?.createdAt.toISOString() ?? null,
      nonLus: parBooking.get(reservation.id) ?? 0,
    }))
    .sort((a, b) => {
      // Ce qui attend une réponse remonte, puis le plus récent.
      if (a.nonLus > 0 !== b.nonLus > 0) return a.nonLus > 0 ? -1 : 1;
      return (b.dernierLe ?? "").localeCompare(a.dernierLe ?? "");
    });
}

/** Combien de messages attendent une lecture du client ? */
export async function compterLesNonLusDuClient(
  db: TenantClient,
  userId: string,
): Promise<number> {
  return db.message.count({
    where: { recipientUserId: userId, readAt: null },
  });
}
