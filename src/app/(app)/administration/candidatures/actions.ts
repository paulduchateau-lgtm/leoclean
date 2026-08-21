"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { asPlatformAdmin } from "@/lib/auth/session";
import {
  CRITERES_ENTRETIEN,
  MOTIFS_REFUS_PIECE,
  PIECES,
} from "@/lib/candidature/parcours";
import {
  activer,
  consignerLEntretien,
  planifierLEntretien,
  refuser,
  refuserUnePiece,
  validerUnePiece,
} from "@/lib/candidature/revue";
import { marketplaceOrganizationId } from "@/lib/organizations";

/**
 * Décisions de revue.
 *
 * Toutes passent par `asPlatformAdmin()`, **le seul chemin franchissant la
 * frontière d'une organisation**, et chacune est journalisée avec son auteur :
 * un refus se conteste, et six mois plus tard personne ne se souvient de ce qui
 * a été regardé.
 */

const MOTIFS = Object.keys(MOTIFS_REFUS_PIECE) as [string, ...string[]];

export const validerLaPiece = authedAction(
  z.object({
    applicationId: z.string().min(1),
    kind: z.enum(PIECES),
    expireLe: z.string().optional(),
  }),
  async ({ applicationId, kind, expireLe }) => {
    const { user } = await asPlatformAdmin();
    await validerUnePiece(
      applicationId,
      kind,
      user.id,
      expireLe ? new Date(expireLe) : null,
    );
    revalidatePath("/administration/candidatures");
    return { valide: true };
  },
);

export const refuserLaPiece = authedAction(
  z.object({
    applicationId: z.string().min(1),
    kind: z.enum(PIECES),
    motif: z.enum(MOTIFS),
    precision: z.string().trim().max(500).optional(),
  }),
  async ({ applicationId, kind, motif, precision }) => {
    const { user } = await asPlatformAdmin();
    await refuserUnePiece(
      applicationId,
      kind,
      motif as keyof typeof MOTIFS_REFUS_PIECE,
      user.id,
      precision ?? null,
    );
    revalidatePath("/administration/candidatures");
    return { refuse: true };
  },
);

export const planifierLentretien = authedAction(
  z.object({
    applicationId: z.string().min(1),
    quand: z.string().min(1),
  }),
  async ({ applicationId, quand }) => {
    const { user } = await asPlatformAdmin();
    await planifierLEntretien(applicationId, new Date(quand), user.id);
    revalidatePath("/administration/candidatures");
    return { planifie: true };
  },
);

export const consignerLentretien = authedAction(
  z.object({
    applicationId: z.string().min(1),
    notes: z.record(z.enum(CRITERES_ENTRETIEN), z.number().int().min(1).max(5)),
    compteRendu: z.string().trim().min(1).max(5000),
  }),
  async ({ applicationId, notes, compteRendu }) => {
    const { user } = await asPlatformAdmin();
    await consignerLEntretien(applicationId, notes, compteRendu, user.id);
    revalidatePath("/administration/candidatures");
    return { consigne: true };
  },
);

export const activerLeDossier = authedAction(
  z.object({ applicationId: z.string().min(1) }),
  async ({ applicationId }) => {
    const { user } = await asPlatformAdmin();
    const organizationId = await marketplaceOrganizationId();
    const resultat = await activer(applicationId, organizationId, user.id);
    revalidatePath("/administration/candidatures");
    revalidatePath("/administration");
    return resultat;
  },
);

export const refuserLeDossier = authedAction(
  z.object({
    applicationId: z.string().min(1),
    /*
     * Dix caractères au minimum : un refus sans motif se conteste sans qu'on
     * puisse rien répondre, et il se rejoue à l'identique la semaine suivante.
     */
    motif: z.string().trim().min(10).max(2000),
  }),
  async ({ applicationId, motif }) => {
    const { user } = await asPlatformAdmin();
    await refuser(applicationId, motif, user.id);
    revalidatePath("/administration/candidatures");
    return { refuse: true };
  },
);
