"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { tracer } from "@/lib/analytics/journal";
import { requireOrganization } from "@/lib/auth/session";
import { BusinessError } from "@/lib/booking/errors";
import { lireSecret, MESSAGES_REFUS_SECRET } from "@/lib/logement/secret";
import { TYPES_ANOMALIE } from "@/lib/mission/cycle";
import {
  basculerTache,
  pointer,
  signalerAnomalie,
} from "@/lib/mission/travail";
import { marketplaceOrganizationId } from "@/lib/organizations";

/**
 * Le travail de la mission, du côté de l'intervenant.
 *
 * Toutes ces actions supposent une affectation acceptée, et `travail.ts` la
 * vérifie lui-même : la relire ici la ferait vérifier deux fois et oublier une
 * fois.
 */

class ProfilIntrouvableError extends BusinessError {}

async function intervenant(userId: string) {
  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(organizationId, "assignment:read:own");
  const profil = await db.cleanerProfile.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!profil) {
    throw new ProfilIntrouvableError(
      "Votre compte n'est pas rattaché à un profil d'intervenant.",
    );
  }
  return { db, organizationId, profil };
}

const pointageSchema = z.object({
  bookingId: z.string().min(1),
  sens: z.enum(["ARRIVEE", "DEPART"]),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  codeClientFourni: z.boolean().optional(),
  /** Instant relevé par l'appareil, pour un pointage enregistré hors ligne. */
  deviceAt: z.iso.datetime().optional(),
});

export const pointerLaMission = authedAction(
  pointageSchema,
  async (input, user) => {
    const { db, organizationId, profil } = await intervenant(user.id);

    const resultat = await pointer(
      db,
      organizationId,
      {
        bookingId: input.bookingId,
        cleanerProfileId: profil.id,
        sens: input.sens,
        position:
          input.lat !== undefined && input.lng !== undefined
            ? { lat: input.lat, lng: input.lng }
            : null,
        codeClientFourni: input.codeClientFourni,
        deviceAt: input.deviceAt ? new Date(input.deviceAt) : null,
      },
      new Date(),
    );

    revalidatePath("/intervenant");
    revalidatePath(`/intervenant/mission/${input.bookingId}`);
    return resultat;
  },
);

/**
 * La consigne d'accès, demandée au moment où l'on est devant la porte.
 *
 * Elle n'est jamais rendue avec la page : une consigne posée dans le HTML est
 * une consigne qui vit dans un cache, un historique et un rendu serveur. On la
 * demande, on l'affiche, et la lecture est journalisée.
 */
export const demanderLaConsigne = authedAction(
  z.object({ bookingId: z.string().min(1) }),
  async ({ bookingId }, user) => {
    const { profil } = await intervenant(user.id);
    const lecture = await lireSecret(bookingId, profil.id, new Date());

    if (!lecture.accorde) {
      return {
        consigne: null,
        message: MESSAGES_REFUS_SECRET[lecture.refus!],
      };
    }
    return { consigne: lecture.consigne, message: null };
  },
);

export const cocherUneTache = authedAction(
  z.object({
    bookingId: z.string().min(1),
    tacheId: z.string().min(1),
    faite: z.boolean(),
  }),
  async ({ bookingId, tacheId, faite }, user) => {
    const { db } = await intervenant(user.id);
    await basculerTache(db, tacheId, bookingId, faite);
    revalidatePath(`/intervenant/mission/${bookingId}`);
    return { faite };
  },
);

export const signalerUneAnomalie = authedAction(
  z.object({
    bookingId: z.string().min(1),
    type: z.enum(TYPES_ANOMALIE),
    description: z.string().trim().max(1000).optional(),
    minutesSupplementaires: z.number().int().min(0).max(240).optional(),
  }),
  async (input, user) => {
    const { db, organizationId } = await intervenant(user.id);

    const resultat = await signalerAnomalie(db, organizationId, {
      bookingId: input.bookingId,
      type: input.type,
      description: input.description ?? null,
      proposedExtraMinutes: input.minutesSupplementaires ?? null,
    });

    void tracer(
      { nom: "anomalie_signalee", type: input.type },
      { organizationId, userId: user.id },
    );

    revalidatePath(`/intervenant/mission/${input.bookingId}`);
    return resultat;
  },
);
