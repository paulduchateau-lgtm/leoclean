"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { requireOrganization } from "@/lib/auth/session";
import {
  RAYON_MAX_KM,
  RAYON_MIN_KM,
  RAYON_PAS_KM,
  rayonValide,
} from "@/lib/availability/rayon";
import { type Plage, verifierSemaine } from "@/lib/availability/semaine";
import { BusinessError } from "@/lib/booking/errors";
import { marketplaceOrganizationId } from "@/lib/organizations";

/**
 * Déclaration des heures d'un intervenant.
 *
 * `availability:manage:own` est la capacité exigée, et **aucun rôle de gestion
 * ne la détient** : personne ne peut imposer un créneau à un indépendant. Cette
 * action est donc le seul chemin par lequel des heures entrent en base, et son
 * appelant est toujours la personne concernée.
 */

const plageSchema = z.object({
  jour: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal(7),
  ]),
  debutMinute: z
    .number()
    .int()
    .min(0)
    .max(24 * 60),
  finMinute: z
    .number()
    .int()
    .min(0)
    .max(24 * 60),
});

const semaineSchema = z.object({
  plages: z.array(plageSchema).max(21),
});

class SemaineInvalideError extends BusinessError {}

export const enregistrerSemaine = authedAction(
  semaineSchema,
  async ({ plages }, user) => {
    /*
     * Les mêmes règles sont appliquées ici et à l'écran, par le même module.
     * L'écran empêche de se tromper, cette vérification empêche de contourner :
     * une plage de dix minutes envoyée à la main produirait des créneaux que le
     * moteur ne peut pas remplir.
     */
    const anomalies = verifierSemaine(plages as Plage[]);
    if (anomalies.length > 0) {
      throw new SemaineInvalideError(
        "Ces horaires ne peuvent pas être enregistrés. Corrigez les plages signalées.",
      );
    }

    const organizationId = await marketplaceOrganizationId();
    const { db } = await requireOrganization(
      organizationId,
      "availability:manage:own",
    );

    const profil = await db.cleanerProfile.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!profil) {
      throw new SemaineInvalideError(
        "Votre compte n'est pas rattaché à un profil d'intervenant.",
      );
    }

    const maintenant = new Date();

    await db.$transaction(async (tx) => {
      /*
       * Les anciennes règles sont closes, pas supprimées.
       *
       * `validFrom`/`validUntil` historisent la disponibilité, et cela compte :
       * une mission déjà attribuée l'a été au vu des heures d'alors. Effacer
       * l'historique rendrait incompréhensible, trois mois plus tard, pourquoi
       * telle personne avait été retenue un mardi soir.
       */
      await tx.availabilityRule.updateMany({
        where: { cleanerProfileId: profil.id, validUntil: null },
        data: { validUntil: maintenant },
      });

      if (plages.length > 0) {
        await tx.availabilityRule.createMany({
          data: plages.map((plage) => ({
            organizationId,
            cleanerProfileId: profil.id,
            weekday: plage.jour,
            startMinute: plage.debutMinute,
            endMinute: plage.finMinute,
            validFrom: maintenant,
          })),
        });
      }
    });

    revalidatePath("/intervenant/disponibilites");
    revalidatePath("/intervenant");
    return { plages: plages.length };
  },
);

/**
 * Rayon d'action déclaré.
 *
 * Même capacité que les heures, et pour la même raison : c'est un choix de
 * conditions de travail. Aucun rôle de gestion ne détient
 * `availability:manage:own` — personne ne peut élargir le périmètre de
 * quelqu'un à sa place.
 */
export const enregistrerRayon = authedAction(
  z.object({ rayonKm: z.number().int() }),
  async ({ rayonKm }, user) => {
    /* La même règle qu'à l'écran, par le même module : l'écran empêche de se
       tromper, cette vérification empêche de contourner. */
    if (!rayonValide(rayonKm)) {
      throw new SemaineInvalideError(
        `Le rayon doit être compris entre ${RAYON_MIN_KM} et ${RAYON_MAX_KM} km, par pas de ${RAYON_PAS_KM}.`,
      );
    }

    const organizationId = await marketplaceOrganizationId();
    const { db } = await requireOrganization(
      organizationId,
      "availability:manage:own",
    );

    const profil = await db.cleanerProfile.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!profil) {
      throw new SemaineInvalideError(
        "Votre compte n'est pas rattaché à un profil d'intervenant.",
      );
    }

    await db.cleanerProfile.update({
      where: { id: profil.id },
      data: { serviceRadiusKm: rayonKm },
    });

    revalidatePath("/intervenant/disponibilites");
    revalidatePath("/intervenant");
    return { rayonKm };
  },
);
