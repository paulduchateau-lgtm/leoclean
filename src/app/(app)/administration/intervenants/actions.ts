"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import {
  activerUnCompte,
  cloreUnCompte,
  leverLaSuspension,
  refuserUnePiece,
  suspendreUnCompte,
} from "@/lib/administration/comptes-intervenants";
import { cloreUneDemande } from "@/lib/cleaner/demande-rgpd";
import { asPlatformAdmin } from "@/lib/auth/session";

/**
 * Ce que la plateforme décide d'un compte intervenant.
 *
 * `asPlatformAdmin()` est vérifié à chaque action et pas seulement à l'entrée
 * de la page : une server action s'appelle sans passer par l'écran, et une
 * vérification posée sur le rendu ne protège que le rendu.
 */

function rafraichir() {
  revalidatePath("/administration/intervenants");
  revalidatePath("/administration");
}

export const activerLeCompte = authedAction(
  z.object({ cleanerProfileId: z.string().min(1) }),
  async ({ cleanerProfileId }, user) => {
    await asPlatformAdmin();
    await activerUnCompte(cleanerProfileId, user.id);
    rafraichir();
    return { active: true };
  },
);

export const refuserLaPiece = authedAction(
  z.object({
    cleanerProfileId: z.string().min(1),
    type: z.enum(["SIRET", "INSURANCE_RC_PRO", "IDENTITY", "BANK_DETAILS"]),
    motif: z.string().trim().min(10),
  }),
  async ({ cleanerProfileId, type, motif }) => {
    await asPlatformAdmin();
    await refuserUnePiece(cleanerProfileId, type, motif);
    rafraichir();
    return { refusee: true };
  },
);

export const suspendreLeCompte = authedAction(
  z.object({
    cleanerProfileId: z.string().min(1),
    motif: z.string().trim().min(10),
  }),
  async ({ cleanerProfileId, motif }) => {
    await asPlatformAdmin();
    await suspendreUnCompte(cleanerProfileId, motif);
    rafraichir();
    return { suspendu: true };
  },
);

export const leverLaSuspensionDuCompte = authedAction(
  z.object({ cleanerProfileId: z.string().min(1) }),
  async ({ cleanerProfileId }) => {
    await asPlatformAdmin();
    await leverLaSuspension(cleanerProfileId);
    rafraichir();
    return { levee: true };
  },
);

export const cloreLeCompte = authedAction(
  z.object({
    cleanerProfileId: z.string().min(1),
    motif: z.string().trim().min(10),
  }),
  async ({ cleanerProfileId, motif }) => {
    await asPlatformAdmin();
    await cloreUnCompte(cleanerProfileId, motif);
    rafraichir();
    return { close: true };
  },
);

export const cloreLaDemandeRgpd = authedAction(
  z.object({
    id: z.string().min(1),
    statut: z.enum(["TRAITEE", "REFUSEE"]),
    resolution: z.string().trim().min(10),
  }),
  async ({ id, statut, resolution }, user) => {
    await asPlatformAdmin();
    await cloreUneDemande(id, statut, resolution, user.id);
    rafraichir();
    return { close: true };
  },
);
