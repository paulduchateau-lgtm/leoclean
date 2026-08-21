import "server-only";

import { prisma } from "@/lib/db";
import {
  type ReclamationVue,
  RESOLUTION_MINIMUM,
  STATUTS_CLOS,
} from "@/lib/reclamation/vocabulaire";

/**
 * Les réclamations, côté plateforme.
 *
 * Elles arrivent par deux chemins — une note basse, ou une démarche du client —
 * et **on ne les traite pas de la même façon** : `ouvertParLaNote` distingue
 * celui qui a demandé quelque chose de celui à qui on écrit. Ne pas faire cette
 * différence produit soit une relance qui tombe de nulle part, soit une réponse
 * qui ignore une question posée.
 */

export async function lireLesReclamations(
  closes = false,
  limite = 100,
): Promise<ReclamationVue[]> {
  const reclamations = await prisma.reclamation.findMany({
    where: closes
      ? { statut: { in: [...STATUTS_CLOS] } }
      : { statut: { in: ["OUVERTE", "EN_COURS"] } },
    /*
     * Les plus anciennes d'abord sur les ouvertes : une réclamation qui vieillit
     * est celle qui se transforme en avis public, en litige, ou en départ.
     */
    orderBy: closes ? { resolueLe: "desc" } : { ouverteLe: "asc" },
    take: limite,
    select: {
      id: true,
      categorie: true,
      statut: true,
      priorite: true,
      description: true,
      ouvertParLaNote: true,
      ouverteLe: true,
      resolueLe: true,
      resolution: true,
      bookingId: true,
      clientProfile: {
        select: { user: { select: { name: true } }, phone: true },
      },
      booking: {
        select: {
          scheduledStart: true,
          address: { select: { cityName: true } },
          review: { select: { rating: true } },
          assignments: {
            where: { status: { in: ["ACCEPTED", "COMPLETED"] } },
            take: 1,
            select: { cleaner: { select: { displayName: true } } },
          },
        },
      },
    },
  });

  return reclamations.map((reclamation) => ({
    id: reclamation.id,
    categorie: reclamation.categorie,
    statut: reclamation.statut,
    priorite: reclamation.priorite,
    description: reclamation.description,
    ouvertParLaNote: reclamation.ouvertParLaNote,
    ouverteLe: reclamation.ouverteLe.toISOString(),
    resolueLe: reclamation.resolueLe?.toISOString() ?? null,
    resolution: reclamation.resolution,
    client: reclamation.clientProfile.user.name ?? "—",
    telephone: reclamation.clientProfile.phone,
    bookingId: reclamation.bookingId,
    quand: reclamation.booking?.scheduledStart.toISOString() ?? null,
    commune: reclamation.booking?.address.cityName ?? null,
    intervenant:
      reclamation.booking?.assignments[0]?.cleaner.displayName ?? null,
    etoiles: reclamation.booking?.review?.rating ?? null,
  }));
}

export class ReclamationRefuseeError extends Error {}

/** Prendre en charge : la réclamation cesse d'être une file d'attente. */
export async function prendreEnCharge(id: string): Promise<void> {
  const { count } = await prisma.reclamation.updateMany({
    where: { id, statut: "OUVERTE" },
    data: { statut: "EN_COURS" },
  });
  if (count === 0) {
    throw new ReclamationRefuseeError(
      "Cette réclamation est déjà prise en charge ou close.",
    );
  }
}

export async function clore(
  id: string,
  statut: "RESOLUE" | "CLASSEE",
  resolution: string,
  maintenant: Date = new Date(),
): Promise<void> {
  const texte = resolution.trim();
  if (texte.length < RESOLUTION_MINIMUM) {
    throw new ReclamationRefuseeError(
      "Une réclamation se clôt avec ce qui a été décidé, écrit.",
    );
  }

  const { count } = await prisma.reclamation.updateMany({
    where: { id, statut: { in: ["OUVERTE", "EN_COURS"] } },
    data: { statut, resolution: texte, resolueLe: maintenant },
  });
  if (count === 0) {
    throw new ReclamationRefuseeError("Cette réclamation est déjà close.");
  }
}
