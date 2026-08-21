"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { getCurrentUser, requireOrganization } from "@/lib/auth/session";
import {
  PortraitRefuseError,
  enregistrerLePortraitIntervenant,
} from "@/lib/compte/portrait";
import { enregistrerIdentifiants, rattacherParrain } from "@/lib/cleaner/space";
import { marketplaceOrganizationId } from "@/lib/organizations";

/**
 * Mutations du dossier d'intervenant.
 *
 * `assignment:respond:own` est la capacité exigée : c'est celle que porte un
 * intervenant, et aucun rôle de gestion ne la détient. Personne ne remplit
 * donc le dossier de quelqu'un d'autre depuis cette porte.
 */
async function tenant() {
  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(
    organizationId,
    "assignment:respond:own",
  );
  return db;
}

export const enregistrerMesIdentifiants = authedAction(
  z.object({
    siret: z.string().trim().min(1, "Indiquez votre SIRET."),
    sapDeclarationNumber: z.string().trim().max(20).optional(),
    insuranceExpiresAt: z.string().optional(),
  }),
  async (input, user) => {
    const result = await enregistrerIdentifiants(await tenant(), user, {
      siret: input.siret,
      sapDeclarationNumber: input.sapDeclarationNumber ?? null,
      insuranceExpiresAt:
        input.insuranceExpiresAt && input.insuranceExpiresAt !== ""
          ? new Date(input.insuranceExpiresAt)
          : null,
    });

    revalidatePath("/intervenant/dossier");
    return result;
  },
);

export const saisirCodeParrain = authedAction(
  z.object({ code: z.string().trim().min(4, "Ce code semble trop court.") }),
  async (input, user) => {
    const result = await rattacherParrain(await tenant(), user, input.code);
    revalidatePath("/intervenant/dossier");
    return result;
  },
);

/**
 * Enregistre le portrait de l'intervenant.
 *
 * Symétrique de celui du client, avec la vérification d'accès de cet espace :
 * `assignment:respond:own` est la capacité que porte un intervenant, et aucun
 * rôle de gestion ne la détient — personne ne pose donc le visage de quelqu'un
 * d'autre depuis cette porte.
 *
 * Les octets transitent en `FormData` plutôt qu'en base64 dans un JSON : une
 * image grossit d'un tiers en base64, et la limite de taille d'une server
 * action se mesure sur ce qui arrive.
 */
export async function enregistrerMonPortraitIntervenant(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const fichier = formData.get("portrait");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: "Choisissez une image." };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Session expirée." };

  try {
    const url = await enregistrerLePortraitIntervenant(
      await tenant(),
      user.id,
      new Uint8Array(await fichier.arrayBuffer()),
    );
    revalidatePath("/intervenant/dossier");
    // Le portrait s'affiche aussi dans les fils, côté client.
    revalidatePath("/intervenant/messages");
    return { ok: true, url };
  } catch (erreur) {
    if (erreur instanceof PortraitRefuseError) {
      return { ok: false, message: erreur.message };
    }
    throw erreur;
  }
}

/** Retire le portrait. Le fichier reste dans le coffre, la colonne se vide. */
export async function retirerMonPortraitIntervenant(): Promise<{ ok: true }> {
  const user = await getCurrentUser();
  if (user) {
    await (
      await tenant()
    ).cleanerProfile.updateMany({
      where: { userId: user.id },
      data: { photoUrl: null },
    });
    revalidatePath("/intervenant/dossier");
  }
  return { ok: true };
}
