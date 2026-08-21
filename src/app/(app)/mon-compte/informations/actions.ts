"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { espaceClient as ouvrirEspaceClient } from "@/lib/auth/espaces";
import {
  PortraitRefuseError,
  enregistrerLePortraitClient,
  retirerLePortraitClient,
} from "@/lib/compte/portrait";
import { requireOrganization } from "@/lib/auth/session";
import {
  enregistrerLesInformations,
  retirerUneAdresse,
} from "@/lib/compte/informations";
import { marketplaceOrganizationId } from "@/lib/organizations";

async function espaceClient() {
  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(organizationId, "booking:read:own");
  return db;
}

/* Le portrait passe par l'espace client, qui n'exige aucune appartenance. */
async function espaceClientDb() {
  const espace = await ouvrirEspaceClient();
  if (!espace.ouvert) throw new Error("Espace client indisponible.");
  return espace.db;
}

async function utilisateurCourant(): Promise<string> {
  const espace = await ouvrirEspaceClient();
  if (!espace.ouvert) throw new Error("Espace client indisponible.");
  return espace.user.id;
}

export const enregistrerMesInformations = authedAction(
  z.object({
    nom: z.string().trim().min(1).max(120),
    /*
     * Le numéro n'est ni normalisé ni validé ici : la règle vit dans
     * `compte/informations.ts`, qui normalise **avant** de valider. La dupliquer
     * en Zod produirait deux règles concurrentes, et c'est en les inversant
     * qu'on refuserait « 06 84 36 38 62 ».
     */
    telephone: z.string().trim().max(30).nullable(),
  }),
  async ({ nom, telephone }, user) => {
    await enregistrerLesInformations(await espaceClient(), user.id, {
      nom,
      telephone,
    });
    revalidatePath("/mon-compte/informations");
    revalidatePath("/mon-compte");
    return { enregistre: true };
  },
);

export const retirerMonAdresse = authedAction(
  z.object({ addressId: z.string().min(1) }),
  async ({ addressId }, user) => {
    await retirerUneAdresse(await espaceClient(), user.id, addressId);
    revalidatePath("/mon-compte/informations");
    return { retiree: true };
  },
);

/**
 * Enregistre le portrait du compte.
 *
 * Les octets transitent en `FormData` plutôt qu'en base64 dans un JSON : une
 * image de deux mégaoctets grossit d'un tiers en base64, et la limite de taille
 * d'une server action se mesure sur ce qui arrive, pas sur ce qu'on voulait
 * envoyer.
 */
export async function enregistrerMonPortrait(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const fichier = formData.get("portrait");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: "Choisissez une image." };
  }

  try {
    const url = await enregistrerLePortraitClient(
      await espaceClientDb(),
      await utilisateurCourant(),
      new Uint8Array(await fichier.arrayBuffer()),
    );
    revalidatePath("/mon-compte/informations");
    revalidatePath("/mon-espace/messages");
    return { ok: true, url };
  } catch (erreur) {
    if (erreur instanceof PortraitRefuseError) {
      return { ok: false, message: erreur.message };
    }
    throw erreur;
  }
}

/** Retire le portrait. Le fichier reste dans le coffre, la colonne se vide. */
export async function retirerMonPortrait(): Promise<{ ok: true }> {
  await retirerLePortraitClient(
    await espaceClientDb(),
    await utilisateurCourant(),
  );
  revalidatePath("/mon-compte/informations");
  return { ok: true };
}
