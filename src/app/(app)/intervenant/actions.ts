"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { reattribuer } from "@/lib/assignments/reattribution";
import { requireOrganization } from "@/lib/auth/session";
import { BusinessError } from "@/lib/booking/errors";
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
async function affectationEnAttente(assignmentId: string, userId: string) {
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
     * L'affectation et la réservation changent d'état ensemble : une mission
     * acceptée dont la réservation resterait « attribuée » laisserait le client
     * sans confirmation, et l'écart ne se verrait qu'à la lecture.
     */
    await db.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id: affectation.id },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
      await tx.booking.update({
        where: { id: affectation.bookingId },
        data: { status: "CONFIRMED" },
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

    revalidatePath("/intervenant");
    return { accepte: true as const };
  },
);

export const refuserMission = authedAction(
  refusSchema,
  async ({ assignmentId, motif }, user) => {
    const { db, organizationId, affectation } = await affectationEnAttente(
      assignmentId,
      user.id,
    );
    const now = new Date();

    /*
     * Le refus est enregistré avant la réattribution, et séparément.
     *
     * Les tenir dans une même transaction paraîtrait plus propre, mais la
     * contrainte d'exclusion se prononce à l'écriture de la nouvelle
     * affectation : une transaction unique qui échouerait sur elle annulerait
     * aussi le refus, et l'intervenant se retrouverait avec la mission qu'il
     * vient de décliner. Un refus enregistré et une réattribution qui échoue
     * laisse une réservation à traiter — un état visible, pas un mensonge.
     */
    await db.assignment.update({
      where: { id: affectation.id },
      data: {
        status: "DECLINED",
        respondedAt: now,
        declineReason: motif ?? null,
      },
    });

    const dejaRefuse = await db.assignment.findMany({
      where: { bookingId: affectation.bookingId, status: "DECLINED" },
      select: { cleanerProfileId: true },
    });

    const remplacant = await reattribuer(
      db,
      { id: organizationId },
      {
        bookingId: affectation.bookingId,
        exclureCleanerProfileIds: dejaRefuse.map(
          (ligne) => ligne.cleanerProfileId,
        ),
        now,
      },
    );

    if (!remplacant) {
      /*
       * Personne d'autre ne peut prendre ce créneau. La réservation revient en
       * attente d'attribution et l'événement le dit : c'est ce qui permettra à
       * la plateforme de rattraper la situation — appeler le client, élargir la
       * recherche — au lieu de laisser quelqu'un attendre une personne qui ne
       * viendra pas.
       */
      await db.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: affectation.bookingId },
          data: { status: "PENDING_ASSIGNMENT" },
        });
        await tx.bookingStatusEvent.create({
          data: {
            organizationId,
            bookingId: affectation.bookingId,
            toStatus: "PENDING_ASSIGNMENT",
            reason:
              "Mission refusée, aucun autre intervenant disponible sur ce créneau",
          },
        });
      });
    }

    revalidatePath("/intervenant");
    return { refuse: true as const, reattribuee: remplacant !== null };
  },
);
