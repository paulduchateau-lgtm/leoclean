import "server-only";

import { BusinessError } from "@/lib/booking/errors";
import type { TenantClient } from "@/lib/db";
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

async function affectationDe(
  db: TenantClient,
  cleanerProfileId: string,
  bookingId: string,
) {
  const affectation = await db.assignment.findFirst({
    where: {
      bookingId,
      cleanerProfileId,
      status: { in: ["ACCEPTED", "COMPLETED"] },
    },
    select: {
      booking: {
        select: {
          id: true,
          organizationId: true,
          clientProfile: { select: { userId: true } },
        },
      },
    },
  });

  if (!affectation) {
    throw new MessageRefuseError("Cette intervention est introuvable.");
  }
  return affectation.booking;
}

/**
 * Les fils ouverts d'un intervenant.
 *
 * Ceux qui portent un message non lu passent devant, puis les plus récents.
 * Une intervention sans message n'apparaît pas : la liste sert à répondre, pas
 * à recenser.
 */
export async function lireLesFils(
  db: TenantClient,
  cleanerProfileId: string,
  userId: string,
): Promise<FilVue[]> {
  const affectations = await db.assignment.findMany({
    where: {
      cleanerProfileId,
      status: { in: ["ACCEPTED", "COMPLETED"] },
      booking: { messages: { some: {} } },
    },
    orderBy: { startAt: "desc" },
    take: 50,
    select: {
      bookingId: true,
      startAt: true,
      booking: {
        select: {
          address: { select: { cityName: true } },
          clientProfile: { select: { user: { select: { name: true } } } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true, createdAt: true },
          },
        },
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
      bookingId: {
        in: affectations.map((affectation) => affectation.bookingId),
      },
    },
    _count: { _all: true },
  });

  const parBooking = new Map(
    nonLus.map((ligne) => [ligne.bookingId, ligne._count._all]),
  );

  return affectations
    .map((affectation) => ({
      bookingId: affectation.bookingId,
      quand: affectation.startAt.toISOString(),
      commune: affectation.booking.address.cityName,
      interlocuteur:
        affectation.booking.clientProfile.user.name?.split(" ")[0] ?? null,
      dernierMessage: affectation.booking.messages[0]?.body ?? null,
      dernierLe:
        affectation.booking.messages[0]?.createdAt.toISOString() ?? null,
      nonLus: parBooking.get(affectation.bookingId) ?? 0,
    }))
    .sort((a, b) => {
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
  bookingId: string,
): Promise<MessageVue[]> {
  await affectationDe(db, cleanerProfileId, bookingId);

  const messages = await db.message.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, body: true, createdAt: true, senderUserId: true },
  });

  await db.message.updateMany({
    where: { bookingId, recipientUserId: userId, readAt: null },
    data: { readAt: new Date() },
  });

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
  bookingId: string,
  corps: string,
): Promise<MessageVue> {
  const reservation = await affectationDe(db, cleanerProfileId, bookingId);

  const texte = corps.trim();
  if (texte.length === 0) {
    throw new MessageRefuseError("Un message vide ne s'envoie pas.");
  }

  const cree = await db.message.create({
    data: {
      organizationId: reservation.organizationId,
      bookingId: reservation.id,
      senderUserId: userId,
      recipientUserId: reservation.clientProfile.userId,
      body: texte,
    },
    select: { id: true, body: true, createdAt: true },
  });

  return {
    id: cree.id,
    body: cree.body,
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
