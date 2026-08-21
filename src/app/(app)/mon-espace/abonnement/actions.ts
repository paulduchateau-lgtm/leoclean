"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authedAction } from "@/lib/actions";
import { mettreEnPause, reprendre, resilier } from "@/lib/abonnement/gestion";
import { MOTIFS_RESILIATION } from "@/lib/abonnement/recurrence";
import { requireOrganization } from "@/lib/auth/session";
import { BusinessError } from "@/lib/booking/errors";
import { marketplaceOrganizationId } from "@/lib/organizations";
import { parisDayMinuteToUtc } from "@/lib/time";

/**
 * Ce qu'un client fait de son abonnement.
 *
 * L'appartenance ne passe pas par `requireOrganization` côté rôle — un client
 * de la marketplace n'a pas de `Membership` — mais le profil est résolu depuis
 * la session, jamais depuis l'entrée : un abonnement qui n'est pas le sien est
 * introuvable, avec le même message que s'il n'existait pas.
 */

class ProfilIntrouvableError extends BusinessError {}

async function clientDeLaSession(userId: string) {
  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(organizationId, "booking:read:own");
  const profil = await db.clientProfile.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!profil) {
    throw new ProfilIntrouvableError(
      "Aucun espace client rattaché à ce compte.",
    );
  }
  return { db, profil };
}

function civil(jour: string): { year: number; month: number; day: number } {
  const [year, month, day] = jour.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return { year, month, day };
}

/**
 * Le jour civil suivant.
 *
 * On avance sur le calendrier plutôt que d'ajouter 24 heures : les deux nuits
 * de changement d'heure en durent 23 et 25, si bien qu'une addition en
 * millisecondes ferait tomber la borne haute au mauvais endroit deux fois par
 * an. `Date.UTC` sert ici de calendrier grégorien, pas de fuseau.
 */
function lendemain(jour: string): { year: number; month: number; day: number } {
  const { year, month, day } = civil(jour);
  const suivant = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    year: suivant.getUTCFullYear(),
    month: suivant.getUTCMonth() + 1,
    day: suivant.getUTCDate(),
  };
}

export const mettreMonAbonnementEnPause = authedAction(
  z.object({
    subscriptionId: z.string().min(1),
    debutJour: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    finJour: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  async (input, user) => {
    const { db, profil } = await clientDeLaSession(user.id);

    /*
     * « Du 1ᵉʳ au 8 » couvre le 8 en entier : la borne haute est le début du 9.
     * C'est la convention `[debut, fin)` du moteur, et c'est ce que la personne
     * veut dire — la même règle que pour les absences des intervenants.
     */
    const resultat = await mettreEnPause(db, input.subscriptionId, profil.id, {
      debut: parisDayMinuteToUtc(civil(input.debutJour), 0),
      fin: parisDayMinuteToUtc(lendemain(input.finJour), 0),
    });

    revalidatePath("/mon-espace/abonnement");
    revalidatePath("/mon-espace");
    return resultat;
  },
);

export const reprendreMonAbonnement = authedAction(
  z.object({ subscriptionId: z.string().min(1) }),
  async ({ subscriptionId }, user) => {
    const { db, profil } = await clientDeLaSession(user.id);
    await reprendre(db, subscriptionId, profil.id);
    revalidatePath("/mon-espace/abonnement");
    return { repris: true };
  },
);

export const resilierMonAbonnement = authedAction(
  z.object({
    subscriptionId: z.string().min(1),
    motif: z.enum(MOTIFS_RESILIATION),
  }),
  async ({ subscriptionId, motif }, user) => {
    const { db, profil } = await clientDeLaSession(user.id);
    const resultat = await resilier(db, subscriptionId, profil.id, motif);
    revalidatePath("/mon-espace/abonnement");
    revalidatePath("/mon-espace");
    return resultat;
  },
);
