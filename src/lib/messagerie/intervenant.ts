import "server-only";

import { BusinessError } from "@/lib/booking/errors";
import type { TenantClient } from "@/lib/db";
import {
  filDe,
  lireEtMarquer,
  poserUnMessage,
} from "@/lib/messagerie/conversation";
import type { FilVue, MessageVue } from "@/lib/messagerie/vocabulaire";

/**
 * La messagerie, côté intervenant.
 *
 * Symétrique de `booking/client-space.ts`, avec la même règle : **le fil est
 * rattaché à l'intervention, pas au couple de personnes.** Un intervenant peut
 * changer d'une semaine sur l'autre, et un fil qui suivrait les personnes
 * mélangerait deux interventions sans rapport.
 *
 * L'appartenance est vérifiée à chaque appel sur l'affectation, jamais sur ce
 * que le navigateur envoie : une intervention qui n'est pas la sienne est
 * introuvable, avec le même message que si elle n'existait pas.
 */

export class MessageRefuseError extends BusinessError {}

/**
 * Les fils ouverts d'un intervenant.
 *
 * Ceux qui portent un message non lu passent devant, puis les plus récents.
 * Une intervention sans message n'apparaît pas : la liste sert à répondre, pas
 * à recenser.
 */
/**
 * Les fils d'une personne, du plus urgent au plus récent.
 *
 * Un fil par couple : la liste ne grandit donc plus d'une ligne par
 * intervention, mais d'une ligne par personne avec qui on parle. C'est
 * exactement ce qu'on attend d'une messagerie.
 *
 * La dernière intervention rattachée sert à situer le fil — « Léognan, lundi
 * dernier » — sans faire croire que le fil s'arrête avec elle.
 */
export async function lireLesFils(
  db: TenantClient,
  cleanerProfileId: string,
  userId: string,
): Promise<FilVue[]> {
  const fils = await db.conversation.findMany({
    where: { cleanerProfileId, messages: { some: {} } },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    select: {
      id: true,
      clientProfile: {
        select: {
          user: { select: { name: true } },
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

  /*
   * Le compte des non-lus est demandé séparément : le compter dans la
   * projection ci-dessus obligerait à charger tous les messages de chaque fil
   * pour n'en garder que le nombre.
   */
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
        interlocuteur: fil.clientProfile.user.name?.split(" ")[0] ?? null,
        dernierMessage: fil.messages[0]?.body ?? null,
        dernierLe: fil.messages[0]?.createdAt.toISOString() ?? null,
        nonLus: parFil.get(fil.id) ?? 0,
      };
    })
    .sort((a, b) => {
      // Ce qui attend une réponse remonte, puis le plus récent.
      if (a.nonLus > 0 !== b.nonLus > 0) return a.nonLus > 0 ? -1 : 1;
      return (b.dernierLe ?? "").localeCompare(a.dernierLe ?? "");
    });
}

/**
 * Le fil d'une intervention, et sa lecture.
 *
 * **Ouvrir le fil marque les messages comme lus**, dans le même appel. Séparer
 * les deux ferait dépendre l'accusé de lecture d'un second aller-retour qui
 * échoue parfois, et le client verrait « non lu » sur un message qu'on a
 * pourtant sous les yeux.
 */
export async function lireLeFil(
  db: TenantClient,
  cleanerProfileId: string,
  userId: string,
  conversationId: string,
): Promise<MessageVue[]> {
  const fil = await filDe(db, conversationId, { cleanerProfileId });
  if (!fil) {
    throw new MessageRefuseError("Ce fil est introuvable.");
  }

  const messages = await lireEtMarquer(db, fil.id, userId);

  return messages.map((message) => ({
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    deMoi: message.senderUserId === userId,
  }));
}

export async function repondre(
  db: TenantClient,
  cleanerProfileId: string,
  userId: string,
  conversationId: string,
  corps: string,
): Promise<MessageVue> {
  const fil = await filDe(db, conversationId, { cleanerProfileId });
  if (!fil) {
    throw new MessageRefuseError("Ce fil est introuvable.");
  }

  const texte = corps.trim();
  if (texte.length === 0) {
    throw new MessageRefuseError("Un message vide ne s'envoie pas.");
  }

  const cree = await poserUnMessage(db, {
    organizationId: fil.organizationId,
    conversationId: fil.id,
    senderUserId: userId,
    recipientUserId: fil.clientUserId,
    body: texte,
  });

  return {
    id: cree.id,
    body: texte,
    createdAt: cree.createdAt.toISOString(),
    deMoi: true,
  };
}

/** Combien de messages attendent une réponse, tous fils confondus. */
export async function compterLesNonLus(
  db: TenantClient,
  userId: string,
): Promise<number> {
  return db.message.count({ where: { recipientUserId: userId, readAt: null } });
}
