"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { requireOrganization } from "@/lib/auth/session";
import { proposeSlot } from "@/lib/booking/slot-proposal-store";
import { BusinessError, isRaceLost } from "@/lib/booking/errors";
import { annoncerLAcceptation } from "@/lib/notifications/evenements";
import { marketplaceOrganizationId } from "@/lib/organizations";

/**
 * Réponse d'un intervenant à une mission qu'on lui propose.
 *
 * L'organisation est résolue côté serveur, jamais transmise par le navigateur :
 * c'est la même règle que dans le tunnel, et elle vaut d'autant plus ici que
 * l'entrée ne porte qu'un identifiant d'affectation.
 *
 * `assignment:respond:own` est la capacité exigée, et aucun rôle de gestion ne
 * la détient. Répondre à la place de quelqu'un reviendrait à lui imposer la
 * mission.
 */

const reponseSchema = z.object({
  assignmentId: z.string().min(1),
});

const refusSchema = reponseSchema.extend({
  motif: z.string().trim().max(300).optional(),
});

/**
 * La course est perdue : quelqu'un du même lot a accepté le premier.
 *
 * Le message dit ce qui s'est passé sans le déguiser en erreur technique ni en
 * reproche : la personne a répondu de bonne foi, quelques secondes trop tard.
 */
class MissionDejaPriseError extends BusinessError {
  constructor() {
    super(
      "Cette mission vient d'être acceptée par quelqu'un de plus rapide. " +
        "Elle ne vous est plus proposée.",
    );
  }
}

/** Erreurs métier écrites pour être lues par l'intervenant. */
class MissionIntrouvableError extends BusinessError {
  constructor() {
    super(
      "Cette mission ne vous est plus proposée. Elle a peut-être été reprise " +
        "par quelqu'un d'autre, ou son délai de réponse est passé.",
    );
  }
}

/**
 * Retrouve l'affectation, en s'assurant qu'elle appartient bien à celui qui
 * répond et qu'elle attend encore une réponse.
 *
 * Le filtre porte sur le profil d'intervenant de la session, pas sur un
 * identifiant reçu : personne ne peut répondre à la place d'un autre en
 * changeant un champ.
 */
async function profilIntervenant(userId: string) {
  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(
    organizationId,
    "assignment:respond:own",
  );

  const profil = await db.cleanerProfile.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!profil) {
    throw new MissionIntrouvableError();
  }

  return { db, organizationId, profil };
}

async function affectationEnAttente(assignmentId: string, userId: string) {
  const { db, organizationId, profil } = await profilIntervenant(userId);

  const affectation = await db.assignment.findFirst({
    where: {
      id: assignmentId,
      cleanerProfileId: profil.id,
      status: "PROPOSED",
    },
    select: { id: true, bookingId: true, cleanerProfileId: true },
  });
  if (!affectation) {
    throw new MissionIntrouvableError();
  }

  return { db, organizationId, affectation };
}

export const accepterMission = authedAction(
  reponseSchema,
  async ({ assignmentId }, user) => {
    const { db, organizationId, affectation } = await affectationEnAttente(
      assignmentId,
      user.id,
    );

    /*
     * L'acceptation, la réservation et le sort des autres propositions
     * changent ensemble : une mission acceptée dont la réservation resterait en
     * recherche laisserait le client sans confirmation, et des propositions
     * restées ouvertes feraient répondre quatre personnes à une mission déjà
     * prise.
     *
     * **La course se tranche en base, pas ici.** Vérifier d'abord que personne
     * n'a accepté ne servirait à rien : entre la lecture et l'écriture, une
     * autre transaction passe. C'est l'index unique partiel
     * `Assignment_one_accepted_per_booking` qui départage, et le refus se
     * traduit en message lisible.
     */
    // Relevés avant la transaction : après, ils ne sont plus `PROPOSED`.
    const perdants = await db.assignment.findMany({
      where: {
        bookingId: affectation.bookingId,
        status: "PROPOSED",
        id: { not: affectation.id },
      },
      select: { cleanerProfileId: true },
    });

    try {
      await db.$transaction(async (tx) => {
        await tx.assignment.update({
          where: { id: affectation.id },
          data: { status: "ACCEPTED", respondedAt: new Date() },
        });

        /*
         * Les autres passent en `SUPERSEDED`, et non en `DECLINED` : ils n'ont
         * rien refusé, leur taux d'acceptation ne doit pas en souffrir. Ni en
         * `CANCELLED`, qui laisserait croire à une décision de la plateforme.
         */
        await tx.assignment.updateMany({
          where: {
            bookingId: affectation.bookingId,
            status: "PROPOSED",
            id: { not: affectation.id },
          },
          data: { status: "SUPERSEDED" },
        });

        await tx.booking.update({
          where: { id: affectation.bookingId },
          data: {
            status: "CONFIRMED",
            // La recherche est finie : plus d'échéance à surveiller.
            diffusionDeadlineAt: null,
          },
        });
        await tx.bookingStatusEvent.create({
          data: {
            organizationId,
            bookingId: affectation.bookingId,
            toStatus: "CONFIRMED",
            reason: "Mission acceptée par l'intervenant",
          },
        });
      });
    } catch (error) {
      if (isRaceLost(error)) {
        throw new MissionDejaPriseError();
      }
      throw error;
    }

    void annoncerLAcceptation(
      db,
      affectation.bookingId,
      affectation.cleanerProfileId,
      perdants.map((perdant) => perdant.cleanerProfileId),
    );

    revalidatePath("/intervenant");
    return { accepte: true as const };
  },
);

/**
 * Proposer un autre créneau sur une mission que personne n'a prise.
 *
 * L'intervenant ne réserve rien : il propose, et le client tranche. La
 * réservation ne bouge qu'à la validation, et c'est à ce moment-là seulement
 * que la contrainte d'exclusion se prononce sur sa disponibilité.
 */
export const proposerUnAutreCreneau = authedAction(
  z.object({
    bookingId: z.string().min(1),
    proposedStart: z.iso.datetime(),
    message: z.string().trim().max(500).optional(),
  }),
  async (input, user) => {
    const { db, profil } = await profilIntervenant(user.id);
    const result = await proposeSlot(
      db,
      profil.id,
      {
        bookingId: input.bookingId,
        proposedStart: new Date(input.proposedStart),
        message: input.message ?? null,
      },
      new Date(),
    );

    revalidatePath("/intervenant");
    return { proposalId: result.proposalId };
  },
);

export const refuserMission = authedAction(
  refusSchema,
  async ({ assignmentId, motif }, user) => {
    const { db, affectation } = await affectationEnAttente(
      assignmentId,
      user.id,
    );
    const now = new Date();

    /*
     * Le refus n'a plus à déclencher de réattribution, et c'est la diffusion
     * par lots qui l'a rendu inutile : quatre autres personnes tiennent la même
     * proposition. Rejouer le moteur ici solliciterait quelqu'un de plus mal
     * classé alors que les mieux classés n'ont pas encore répondu.
     *
     * Ce qui arrive ensuite est affaire d'échéance, pas de refus : à la fin du
     * lot, l'ordonnanceur élargit au secteur ou rend la main au client s'il a
     * reçu des horaires alternatifs. Un refus n'avance donc rien — il retire
     * seulement une chance sur cinq, et le dit.
     */
    await db.assignment.update({
      where: { id: affectation.id },
      data: {
        status: "DECLINED",
        respondedAt: now,
        declineReason: motif ?? null,
      },
    });

    const restantes = await db.assignment.count({
      where: { bookingId: affectation.bookingId, status: "PROPOSED" },
    });

    revalidatePath("/intervenant");
    return { refuse: true as const, restantes };
  },
);
