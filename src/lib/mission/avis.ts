import "server-only";

import { BusinessError } from "@/lib/booking/errors";
import type { TenantClient } from "@/lib/db";

import {
  type CategorieInsatisfaction,
  MESSAGES_AVIS,
  estPubliable,
  ouvreUnTicketQualite,
  type TagAvis,
  verifierAvis,
} from "./notation";

/**
 * Écriture d'un avis.
 *
 * `notation.ts` décide, ce module écrit. Une seule transaction, parce que les
 * deux écritures se tiennent : **un avis bas qui n'ouvrirait pas son ticket
 * serait un mécontentement enregistré que personne ne voit passer**, ce qui est
 * pire que pas d'avis du tout — on aurait la trace sans le traitement.
 */

export class AvisRefuseError extends BusinessError {}

export interface InterventionANoter {
  bookingId: string;
  quand: string;
  commune: string;
  intervenantPrenom: string | null;
  cleanerProfileId: string | null;
}

/**
 * Les interventions terminées que ce client n'a pas encore notées.
 *
 * Le délai est appliqué ici plutôt qu'à l'écriture seule : proposer de noter
 * une mission qu'on refusera ensuite fait perdre le geste après l'avoir
 * demandé.
 */
export async function interventionsANoter(
  db: TenantClient,
  clientProfileId: string,
  maintenant: Date = new Date(),
  delaiJours: number,
): Promise<InterventionANoter[]> {
  const reservations = await db.booking.findMany({
    where: {
      clientProfileId,
      status: "COMPLETED",
      review: null,
      scheduledEnd: {
        gte: new Date(maintenant.getTime() - delaiJours * 86_400_000),
      },
    },
    orderBy: { scheduledStart: "desc" },
    select: {
      id: true,
      scheduledStart: true,
      address: { select: { cityName: true } },
      assignments: {
        where: { status: { in: ["ACCEPTED", "COMPLETED"] } },
        take: 1,
        select: {
          cleanerProfileId: true,
          cleaner: { select: { displayName: true } },
        },
      },
    },
  });

  return reservations.map((reservation) => {
    const affectation = reservation.assignments[0];
    return {
      bookingId: reservation.id,
      quand: reservation.scheduledStart.toISOString(),
      commune: reservation.address.cityName,
      intervenantPrenom: affectation?.cleaner.displayName ?? null,
      cleanerProfileId: affectation?.cleanerProfileId ?? null,
    };
  });
}

export interface Avis {
  bookingId: string;
  etoiles: number;
  tags: TagAvis[];
  commentaire: string | null;
  /** Renseignée seulement quand la note ouvre un ticket. */
  categorie: CategorieInsatisfaction | null;
}

export async function noter(
  db: TenantClient,
  clientProfileId: string,
  avis: Avis,
  maintenant: Date = new Date(),
): Promise<{ ticketOuvert: boolean; publie: boolean }> {
  const reservation = await db.booking.findFirst({
    where: { id: avis.bookingId, clientProfileId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      scheduledEnd: true,
      address: { select: { inseeCode: true } },
      /*
       * La fin réelle, quand elle existe : le délai de notation court depuis le
       * moment où la personne est partie, pas depuis l'heure prévue. Sur une
       * mission écourtée l'écart est d'une heure, sur une mission pointée le
       * lendemain il compte.
       */
      checks: {
        where: { kind: "DEPART" },
        take: 1,
        select: { at: true, deviceAt: true },
      },
      review: { select: { id: true } },
      assignments: {
        where: { status: { in: ["ACCEPTED", "COMPLETED"] } },
        take: 1,
        select: { cleanerProfileId: true },
      },
    },
  });

  /*
   * Une intervention qui n'est pas la sienne est introuvable, avec le même
   * message que si elle n'existait pas : confirmer un identifiant à un curieux
   * lui apprend qu'il a visé juste.
   */
  if (!reservation) {
    throw new AvisRefuseError(MESSAGES_AVIS.MISSION_NON_TERMINEE);
  }

  const depart = reservation.checks[0];
  const refus = verifierAvis({
    terminee: reservation.status === "COMPLETED",
    termineeLe: depart
      ? (depart.deviceAt ?? depart.at)
      : reservation.scheduledEnd,
    dejaNotee: reservation.review !== null,
    etoiles: avis.etoiles,
    maintenant,
  });
  if (refus) throw new AvisRefuseError(MESSAGES_AVIS[refus]);

  const cleanerProfileId = reservation.assignments[0]?.cleanerProfileId;
  if (!cleanerProfileId) {
    /*
     * Sans intervenant désigné il n'y a personne à noter. Le cas est théorique
     * — une mission terminée en a forcément un — mais écrire un avis rattaché à
     * personne créerait une ligne que ni le client ni l'intervenant ne peut
     * relire.
     */
    throw new AvisRefuseError(
      "Cette intervention n'a pas d'intervenant rattaché. Écrivez-nous.",
    );
  }

  const commentaire = avis.commentaire?.trim() || null;
  const publie = estPubliable(avis.etoiles, commentaire);
  const ticket = ouvreUnTicketQualite(avis.etoiles);

  await db.$transaction(async (tx) => {
    await tx.review.create({
      data: {
        organizationId: reservation.organizationId,
        bookingId: reservation.id,
        clientProfileId,
        cleanerProfileId,
        rating: avis.etoiles,
        comment: commentaire,
        tags: avis.tags,
        communeInsee: reservation.address.inseeCode,
        isPublic: publie,
        publishedAt: publie ? maintenant : null,
      },
    });

    if (ticket) {
      await tx.reclamation.create({
        data: {
          organizationId: reservation.organizationId,
          bookingId: reservation.id,
          clientProfileId,
          categorie: avis.categorie ?? "AUTRE",
          /*
           * Une casse est un sinistre assurable : elle passe devant tout le
           * reste, parce que la déclaration à l'assureur a ses propres délais
           * et qu'un retard s'y paie en refus d'indemnisation.
           */
          priorite: avis.categorie === "CASSE" ? "P1" : "P2",
          description: commentaire,
          ouvertParLaNote: true,
          ouverteLe: maintenant,
        },
      });
    }
  });

  return { ticketOuvert: ticket, publie };
}
