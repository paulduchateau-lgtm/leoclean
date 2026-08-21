import "server-only";

import type { TenantClient } from "@/lib/db";

/**
 * Un client capable d'écrire, transaction comprise.
 *
 * Le client rendu par `$transaction` n'expose pas les méthodes de niveau
 * connexion : typer ces fonctions sur `TenantClient` interdisait de les
 * appeler depuis une transaction, c'est-à-dire depuis l'endroit précis où
 * l'annulation pose son événement. On demande donc le minimum dont on se sert,
 * et le client complet y répond aussi.
 */
type ClientFil = Omit<
  TenantClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Ouvrir et alimenter un fil entre un client et un intervenant.
 *
 * **Le fil appartient au couple, pas à l'intervention.** Il suivait la
 * réservation : un client qui revoyait la même personne chaque semaine ouvrait
 * un fil par semaine. La promesse du service étant « la même personne chaque
 * semaine », c'est la relation qui dure — la prestation, elle, se termine.
 *
 * **Changer d'intervenant ouvre un fil neuf sans qu'on l'écrive** : le couple
 * change, donc la clé change. Le remplaçant n'hérite d'aucun historique, et
 * l'ancien fil reste lisible sans être alimenté. C'est la contrainte d'unicité
 * qui tient cette règle, pas une condition dans le code.
 */

export interface Interlocuteurs {
  clientProfileId: string;
  cleanerProfileId: string;
}

/**
 * Le fil de ce couple, créé au besoin.
 *
 * `upsert` sur la clé du couple plutôt que « chercher puis créer » : deux
 * messages envoyés en même temps par les deux bouts créeraient sinon deux
 * fils, dont l'un deviendrait invisible dès que l'autre est retenu.
 */
export async function ouvrirLeFil(
  db: ClientFil,
  organizationId: string,
  couple: Interlocuteurs,
): Promise<string> {
  const fil = await db.conversation.upsert({
    where: {
      organizationId_clientProfileId_cleanerProfileId: {
        organizationId,
        ...couple,
      },
    },
    update: {},
    create: { organizationId, ...couple },
    select: { id: true },
  });

  return fil.id;
}

/**
 * L'intervenant retenu sur une réservation, ou `null`.
 *
 * `COMPLETED` compte autant qu'`ACCEPTED` : une mission terminée a bel et bien
 * eu son intervenant, et l'écarter empêcherait d'écrire à quelqu'un le
 * lendemain de sa venue — c'est-à-dire au moment où on a le plus de raisons de
 * le faire.
 */
export async function intervenantDe(
  db: ClientFil,
  bookingId: string,
): Promise<string | null> {
  const affectation = await db.assignment.findFirst({
    where: { bookingId, status: { in: ["ACCEPTED", "COMPLETED"] } },
    select: { cleanerProfileId: true },
  });

  return affectation?.cleanerProfileId ?? null;
}

export interface EcritureMessage {
  organizationId: string;
  conversationId: string;
  /** `null` pour un événement système : il n'a pas d'auteur humain. */
  senderUserId: string | null;
  recipientUserId: string;
  body: string;
  /** L'intervention que ce message désigne, quand il en désigne une. */
  bookingId?: string | null;
  kind?: "TEXT" | "SYSTEM";
}

/**
 * Pose un message dans un fil et remonte la date du fil.
 *
 * **La transaction est laissée à l'appelant**, et ce n'est pas un oubli : la
 * moitié des appels ont déjà lieu dans une transaction — l'annulation écrit le
 * statut, les affectations et l'événement d'un seul tenant — et en ouvrir une
 * seconde à l'intérieur n'a pas de sens. Celui qui écrit hors transaction
 * enveloppe donc lui-même s'il y tient ; l'écart, si la seconde écriture
 * échoue, est un fil rangé au mauvais rang, pas un message perdu.
 */
export async function poserUnMessage(
  db: ClientFil,
  message: EcritureMessage,
  maintenant: Date = new Date(),
): Promise<{ id: string; createdAt: Date }> {
  const cree = await db.message.create({
    data: {
      organizationId: message.organizationId,
      conversationId: message.conversationId,
      senderUserId: message.senderUserId,
      recipientUserId: message.recipientUserId,
      bookingId: message.bookingId ?? null,
      kind: message.kind ?? "TEXT",
      body: message.body,
    },
    select: { id: true, createdAt: true },
  });

  await db.conversation.update({
    where: { id: message.conversationId },
    data: { lastMessageAt: maintenant },
  });

  return cree;
}

/**
 * Pose un événement système dans le fil du couple concerné par une réservation.
 *
 * **C'est une notification, jamais la source de vérité.** Elle dit qu'une chose
 * a changé et désigne l'objet ; si l'horaire vivait ici, quelqu'un finirait par
 * le lire dans le fil plutôt que sur la réservation, et le fil serait faux dès
 * le changement suivant.
 *
 * Silencieuse quand la réservation n'a pas d'intervenant retenu : il n'y a
 * alors personne à qui annoncer quoi que ce soit, et lever ferait échouer
 * l'action qui l'appelle — un déplacement d'horaire ne doit pas être annulé
 * parce qu'un message n'a pas pu être posé.
 */
export async function annoncerDansLeFil(
  db: ClientFil,
  organizationId: string,
  bookingId: string,
  texte: string,
  destinataire: "client" | "intervenant",
  maintenant: Date = new Date(),
): Promise<void> {
  const reservation = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      clientProfileId: true,
      clientProfile: { select: { userId: true } },
      assignments: {
        where: { status: { in: ["ACCEPTED", "COMPLETED"] } },
        take: 1,
        select: {
          cleanerProfileId: true,
          cleaner: { select: { userId: true } },
        },
      },
    },
  });

  const affectation = reservation?.assignments[0];
  if (!reservation || !affectation) return;

  const conversationId = await ouvrirLeFil(db, organizationId, {
    clientProfileId: reservation.clientProfileId,
    cleanerProfileId: affectation.cleanerProfileId,
  });

  await poserUnMessage(
    db,
    {
      organizationId,
      conversationId,
      senderUserId: null,
      recipientUserId:
        destinataire === "client"
          ? reservation.clientProfile.userId
          : affectation.cleaner.userId,
      bookingId,
      kind: "SYSTEM",
      body: texte,
    },
    maintenant,
  );
}

/**
 * Le fil d'un couple, vérifié pour celui qui l'ouvre.
 *
 * L'appartenance se lit **dans la requête** : un fil qui n'est pas le sien est
 * introuvable, avec le même message que s'il n'existait pas. Charger puis
 * comparer laisserait à l'appelant le soin de ne pas oublier la comparaison.
 */
export async function filDe(
  db: ClientFil,
  conversationId: string,
  qui: { cleanerProfileId?: string; clientProfileId?: string },
): Promise<{
  id: string;
  organizationId: string;
  clientProfileId: string;
  cleanerProfileId: string;
  clientUserId: string;
  cleanerUserId: string;
  interlocuteur: string | null;
  /** Photo de l'intervenant, quand il en a une. */
  photoUrl: string | null;
} | null> {
  const fil = await db.conversation.findFirst({
    where: {
      id: conversationId,
      ...(qui.cleanerProfileId
        ? { cleanerProfileId: qui.cleanerProfileId }
        : {}),
      ...(qui.clientProfileId ? { clientProfileId: qui.clientProfileId } : {}),
    },
    select: {
      id: true,
      organizationId: true,
      clientProfileId: true,
      cleanerProfileId: true,
      clientProfile: {
        select: { userId: true, user: { select: { name: true } } },
      },
      cleaner: {
        select: { userId: true, displayName: true, photoUrl: true },
      },
    },
  });
  if (!fil) return null;

  return {
    id: fil.id,
    organizationId: fil.organizationId,
    clientProfileId: fil.clientProfileId,
    cleanerProfileId: fil.cleanerProfileId,
    clientUserId: fil.clientProfile.userId,
    cleanerUserId: fil.cleaner.userId,
    /* Le prénom seul de l'autre bord, selon qui regarde. */
    interlocuteur: qui.cleanerProfileId
      ? (fil.clientProfile.user.name?.split(" ")[0] ?? null)
      : (fil.cleaner.displayName.split(" ")[0] ?? null),
    /* Seul le client voit une photo : l'intervenant n'en a pas du client. */
    photoUrl: qui.clientProfileId ? fil.cleaner.photoUrl : null,
  };
}

/** Les messages d'un fil, et leur marquage comme lus dans le même appel. */
export async function lireEtMarquer(
  db: ClientFil,
  conversationId: string,
  userId: string,
): Promise<
  { id: string; body: string; createdAt: Date; senderUserId: string | null }[]
> {
  const messages = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, body: true, createdAt: true, senderUserId: true },
  });

  /*
   * Ouvrir le fil marque ses messages comme lus, dans le même appel. Séparer
   * les deux ferait dépendre l'accusé d'un second aller-retour qui échoue
   * parfois, et l'autre verrait « non lu » sur un message qu'on a sous les yeux.
   */
  await db.message.updateMany({
    where: { conversationId, recipientUserId: userId, readAt: null },
    data: { readAt: new Date() },
  });

  return messages;
}
