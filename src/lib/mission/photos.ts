import "server-only";

import { BusinessError } from "@/lib/booking/errors";
import type { TenantClient } from "@/lib/db";
import { stockage } from "@/lib/stockage/resolution";

import {
  PHOTOS_MAXIMUM_PAR_PHASE,
  type PhasePhoto,
  type PhotoVue,
} from "./rapport-photo";

/**
 * Les photos d'une mission.
 *
 * Deux avant, deux après : c'est ce que `rapportComplet` attend, et cela n'a
 * jamais rien bloqué — **un rapport incomplet ne retient ni la fin de mission
 * ni le paiement**. Un produit qui empêche de travailler pour protéger une
 * mesure obtient des mesures fausses : quelqu'un photographierait n'importe
 * quoi pour finir sa journée.
 *
 * Elles vont dans le coffre `missions/`, dont la politique retire les
 * métadonnées : sans cela, une photo de salon arriverait avec les coordonnées
 * GPS du domicile d'un client, et la preuve de réalisation deviendrait une
 * fuite d'adresse.
 *
 * **Rien n'est jamais servi en direct.** Une lecture passe par une URL signée
 * de soixante secondes, engendrée à la demande et jamais mise en cache.
 */

export class PhotoRefuseeError extends BusinessError {}

/**
 * L'affectation de cet intervenant sur cette mission, ou rien.
 *
 * L'appartenance se vérifie dans la requête : une mission qui n'est pas la
 * sienne est introuvable, avec le même résultat que si elle n'existait pas.
 */
async function missionDe(
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
    select: { booking: { select: { id: true, organizationId: true } } },
  });

  if (!affectation) {
    throw new PhotoRefuseeError("Cette mission est introuvable.");
  }
  return affectation.booking;
}

export async function deposerUnePhoto(
  db: TenantClient,
  cleanerProfileId: string,
  input: {
    bookingId: string;
    phase: PhasePhoto;
    piece: string | null;
    octets: Uint8Array;
  },
  maintenant: Date = new Date(),
): Promise<{ id: string }> {
  const mission = await missionDe(db, cleanerProfileId, input.bookingId);

  const deja = await db.missionPhoto.count({
    where: { bookingId: mission.id, phase: input.phase },
  });
  if (deja >= PHOTOS_MAXIMUM_PAR_PHASE) {
    throw new PhotoRefuseeError(
      `Vous avez déjà ${PHOTOS_MAXIMUM_PAR_PHASE} photos pour cette phase. C'est largement assez.`,
    );
  }

  const coffre = stockage();
  const depose = await coffre.deposer({
    coffre: "missions",
    proprietaireId: mission.id,
    /*
     * L'identifiant porte la phase et le rang : deux photos de la même mission
     * ne doivent pas se recouvrir dans le coffre, et un chemin devinable
     * n'aurait de toute façon aucune valeur — la lecture exige une signature.
     */
    identifiant: `${input.phase.toLowerCase()}-${deja + 1}`,
    octets: input.octets,
  });

  const creee = await db.missionPhoto.create({
    data: {
      organizationId: mission.organizationId,
      bookingId: mission.id,
      phase: input.phase,
      room: input.piece?.trim() || null,
      storagePath: depose.chemin,
      takenAt: maintenant,
    },
    select: { id: true },
  });

  return creee;
}

export async function lireLesPhotos(
  db: TenantClient,
  bookingId: string,
): Promise<PhotoVue[]> {
  const photos = await db.missionPhoto.findMany({
    where: { bookingId },
    orderBy: [{ phase: "asc" }, { uploadedAt: "asc" }],
    select: { id: true, phase: true, room: true, takenAt: true },
  });

  return photos.map((photo) => ({
    id: photo.id,
    phase: photo.phase,
    piece: photo.room,
    priseLe: photo.takenAt?.toISOString() ?? null,
  }));
}

/**
 * Une URL de lecture, valable soixante secondes.
 *
 * Engendrée à la demande et **jamais mise en cache** : une URL signée mise en
 * cache est une URL publique à retardement. L'appartenance est revérifiée à
 * chaque appel — c'est le seul endroit où l'on décide qui voit l'intérieur du
 * domicile d'un client.
 */
export async function urlDeLecture(
  db: TenantClient,
  photoId: string,
  acces: { cleanerProfileId?: string; clientProfileId?: string },
): Promise<string> {
  const photo = await db.missionPhoto.findFirst({
    where: {
      id: photoId,
      booking: {
        ...(acces.clientProfileId
          ? { clientProfileId: acces.clientProfileId }
          : {}),
        ...(acces.cleanerProfileId
          ? {
              assignments: {
                some: {
                  cleanerProfileId: acces.cleanerProfileId,
                  status: { in: ["ACCEPTED", "COMPLETED"] },
                },
              },
            }
          : {}),
      },
    },
    select: { storagePath: true },
  });

  if (!photo) {
    throw new PhotoRefuseeError("Cette photo est introuvable.");
  }

  return stockage().lireUrl(photo.storagePath);
}
