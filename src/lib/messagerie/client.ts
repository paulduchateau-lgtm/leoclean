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
  const fils = await db.conversation.findMany({
    where: { clientProfileId, messages: { some: {} } },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    select: {
      id: true,
      cleaner: { select: { displayName: true } },
      clientProfile: {
        select: {
          bookings: {
            orderBy: { scheduledStart: "desc" },
            take: 1,
            select: {
              scheduledStart: true,
              address: { select: { cityName: true } },
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true },
      },
    },
  });

  const nonLus = await db.message.groupBy({
    by: ["conversationId"],
    where: {
      recipientUserId: userId,
      readAt: null,
      conversationId: { in: fils.map((fil) => fil.id) },
    },
    _count: { _all: true },
  });

  const parFil = new Map(
    nonLus.map((ligne) => [ligne.conversationId, ligne._count._all]),
  );

  return fils
    .map((fil) => {
      const derniere = fil.clientProfile.bookings[0] ?? null;
      return {
        conversationId: fil.id,
        quand: derniere?.scheduledStart.toISOString() ?? null,
        commune: derniere?.address.cityName ?? null,
        /* Le prénom seul, jamais le nom complet : règle tenue partout. */
        interlocuteur: fil.cleaner.displayName.split(" ")[0] ?? null,
        dernierMessage: fil.messages[0]?.body ?? null,
        dernierLe: fil.messages[0]?.createdAt.toISOString() ?? null,
        nonLus: parFil.get(fil.id) ?? 0,
      };
    })
    .sort((a, b) => {
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
