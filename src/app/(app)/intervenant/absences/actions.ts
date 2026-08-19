"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { requireOrganization } from "@/lib/auth/session";
import {
  type Absence,
  MESSAGES_ABSENCE,
  absencesVivantes,
  joursCouverts,
  verifierAbsence,
} from "@/lib/availability/absences";
import { BusinessError } from "@/lib/booking/errors";
import { marketplaceOrganizationId } from "@/lib/organizations";
import { tracer } from "@/lib/analytics/journal";
import { parisDayMinuteToUtc } from "@/lib/time";

/**
 * Déclaration et retrait des absences d'un intervenant.
 *
 * Même capacité que la semaine type — `availability:manage:own`, qu'aucun rôle
 * de gestion ne détient. Personne ne pose une absence à la place de quelqu'un,
 * et personne ne la retire non plus : un congé qu'un tiers pourrait annuler
 * serait exactement l'indice de subordination que le produit s'interdit.
 *
 * L'écran raisonne en dates françaises, la base en instants UTC. La conversion
 * a lieu ici, au moment précis où l'on sort de ce que la personne a saisi.
 */

class AbsenceInvalideError extends BusinessError {}

const jourSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");

const poserSchema = z
  .object({
    debutJour: jourSchema,
    finJour: jourSchema,
    /**
     * Une absence porte par défaut sur des journées entières : c'est la forme
     * de 95 % des cas — des vacances — et celle qui ne se saisit pas de travers.
     */
    journeeEntiere: z.boolean().default(true),
    debutMinute: z.number().int().min(0).max(24 * 60).optional(),
    finMinute: z.number().int().min(0).max(24 * 60).optional(),
    motif: z.string().trim().max(200).optional(),
  })
  .refine(
    (valeur) =>
      valeur.journeeEntiere ||
      (valeur.debutJour === valeur.finJour &&
        valeur.debutMinute !== undefined &&
        valeur.finMinute !== undefined),
    {
      message:
        "Une absence sur une partie de journée doit tenir dans une seule journée.",
    },
  );

/** « 2026-09-01 » → les trois nombres qu'attend la conversion de fuseau. */
function decouperJour(jour: string): { year: number; month: number; day: number } {
  const [year, month, day] = jour.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return { year, month, day };
}

/**
 * Un jour civil de plus.
 *
 * On raisonne en composantes de calendrier et non en millisecondes : ajouter
 * 24 heures à un instant se trompe deux fois par an, la nuit du changement
 * d'heure durant 23 ou 25 heures. `Date.UTC` sert seulement d'arithmétique de
 * calendrier — le résultat est réinterprété en heure française juste après.
 */
function jourSuivant(jour: { year: number; month: number; day: number }) {
  const suivant = new Date(Date.UTC(jour.year, jour.month - 1, jour.day + 1));
  return {
    year: suivant.getUTCFullYear(),
    month: suivant.getUTCMonth() + 1,
    day: suivant.getUTCDate(),
  };
}

export const poserAbsence = authedAction(poserSchema, async (entree, user) => {
  const debut = entree.journeeEntiere
    ? parisDayMinuteToUtc(decouperJour(entree.debutJour), 0)
    : parisDayMinuteToUtc(decouperJour(entree.debutJour), entree.debutMinute!);

  /*
   * Une absence « du 1ᵉʳ au 8 » couvre le 8 en entier : la borne haute est donc
   * le début du 9. C'est la convention `[debut, fin)` du moteur, et c'est aussi
   * ce que la personne veut dire — personne n'entend « jusqu'au 8 à minuit ».
   */
  const fin = entree.journeeEntiere
    ? parisDayMinuteToUtc(jourSuivant(decouperJour(entree.finJour)), 0)
    : parisDayMinuteToUtc(decouperJour(entree.finJour), entree.finMinute!);

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
    throw new AbsenceInvalideError(
      "Votre compte n'est pas rattaché à un profil d'intervenant.",
    );
  }

  const maintenant = new Date();

  const existantes = await db.availabilityException.findMany({
    where: { cleanerProfileId: profil.id, type: "UNAVAILABLE" },
    select: { startAt: true, endAt: true },
  });

  const vivantes: Absence[] = absencesVivantes(
    existantes.map((ligne) => ({ debut: ligne.startAt, fin: ligne.endAt })),
    maintenant,
  );

  /*
   * Les mêmes règles qu'à l'écran, par le même module : l'écran empêche de se
   * tromper, cette vérification empêche de contourner.
   */
  const erreur = verifierAbsence({ debut, fin }, vivantes, maintenant);
  if (erreur) {
    throw new AbsenceInvalideError(MESSAGES_ABSENCE[erreur]);
  }

  const creee = await db.availabilityException.create({
    data: {
      organizationId,
      cleanerProfileId: profil.id,
      type: "UNAVAILABLE",
      startAt: debut,
      endAt: fin,
      reason: entree.motif?.length ? entree.motif : null,
    },
    select: { id: true },
  });

  /* Combien de jours de capacité sortent du planning, et à quelle saison. */
  void tracer(
    { nom: "absence_posee", jours: joursCouverts({ debut, fin }) },
    { organizationId, userId: user.id },
  );

  revalidatePath("/intervenant/absences");
  revalidatePath("/intervenant");
  return { absenceId: creee.id };
});

export const retirerAbsence = authedAction(
  z.object({ absenceId: z.string().min(1) }),
  async ({ absenceId }, user) => {
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
      throw new AbsenceInvalideError(
        "Votre compte n'est pas rattaché à un profil d'intervenant.",
      );
    }

    /*
     * Le filtre porte sur le profil autant que sur l'identifiant : le client
     * est déjà cloisonné à l'organisation, mais deux intervenants de la même
     * organisation ne doivent pas pouvoir se retirer mutuellement un congé.
     * `deleteMany` plutôt que `delete` pour que la condition soit dans la
     * requête et non dans une vérification préalable qu'on pourrait oublier.
     */
    const { count } = await db.availabilityException.deleteMany({
      where: {
        id: absenceId,
        cleanerProfileId: profil.id,
        type: "UNAVAILABLE",
      },
    });

    if (count === 0) {
      throw new AbsenceInvalideError("Cette absence n'existe plus.");
    }

    revalidatePath("/intervenant/absences");
    revalidatePath("/intervenant");
    return { retiree: true };
  },
);
