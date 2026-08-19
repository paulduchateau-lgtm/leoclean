"use server";

import { z } from "zod";

import { publicAction } from "@/lib/action-result";
import { forOrganization } from "@/lib/db";
import { marketplaceOrganizationId } from "@/lib/organizations";
import { exigerQuota } from "@/lib/securite/limitation";
import { isCoveredInsee } from "@/lib/territory";
import { tracer } from "@/lib/analytics/journal";

/**
 * Demande de rappel.
 *
 * Le tunnel de réservation n'est pas encore ouvert : ce formulaire est le point
 * de conversion du site, et il doit donc être irréprochable sur trois plans —
 * il accepte ce qu'un humain tape réellement, il ne perd jamais une demande, et
 * il ne devient pas un canal de spam.
 */

/**
 * Normalise un numéro français.
 *
 * Les gens écrivent « 06 84 36 38 62 », « 0684363862 », « +33 6 84 36 38 62 »
 * ou « 06.84.36.38.62 ». Refuser l'une de ces formes ferait perdre une demande
 * pour une raison que l'internaute ne comprendrait pas.
 */
function normalizePhone(input: string): string {
  const digits = input.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+33")) {
    return `0${digits.slice(3)}`;
  }
  if (digits.startsWith("0033")) {
    return `0${digits.slice(4)}`;
  }
  return digits;
}

const leadSchema = z.object({
  name: z.string().trim().min(2, "Merci d'indiquer votre nom.").max(120),

  phone: z
    .string()
    .transform(normalizePhone)
    .refine(
      (value) => /^0[1-9]\d{8}$/.test(value),
      "Ce numéro ne semble pas valide. Exemple : 06 12 34 56 78.",
    ),

  email: z
    .union([
      z.literal(""),
      z.email("Cette adresse email ne semble pas valide."),
    ])
    .transform((value) => (value === "" ? null : value.toLowerCase())),

  communeInsee: z
    .string()
    .refine(
      (value) => value === "" || isCoveredInsee(value),
      "Nous n'intervenons pas encore dans cette commune.",
    )
    .transform((value) => (value === "" ? null : value)),

  message: z.string().trim().max(1000).optional(),

  sourcePath: z.string().max(200).optional(),

  /**
   * Champ piège, invisible et sans autocomplétion. Un humain ne le voit pas ;
   * un robot qui remplit tout le formulaire le remplit aussi.
   */
  website: z.string().max(0).optional(),

  /**
   * Horodatage d'affichage du formulaire. Un envoi en moins de trois secondes
   * n'est pas humain : personne ne lit et remplit quatre champs aussi vite.
   */
  renderedAt: z.coerce.number().optional(),
});

export const submitLead = publicAction(leadSchema, async (input) => {
  /*
   * Le champ piège et le délai de trois secondes n'arrêtent qu'un robot naïf :
   * un script qui les respecte passe autant de fois qu'il veut. La limitation
   * par source ferme cette porte-là.
   */
  await exigerQuota("rappel");

  const looksAutomated =
    (input.website !== undefined && input.website !== "") ||
    (input.renderedAt !== undefined && Date.now() - input.renderedAt < 3000);

  if (looksAutomated) {
    // On répond comme à une demande légitime : signaler le rejet apprendrait au
    // robot quoi contourner. La demande n'est simplement pas enregistrée.
    return { received: true as const };
  }

  const organizationId = await marketplaceOrganizationId();
  const db = forOrganization(organizationId);

  await db.lead.create({
    data: {
      organizationId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      communeInsee: input.communeInsee,
      message: input.message ?? null,
      sourcePath: input.sourcePath ?? null,
    },
  });

  /*
   * Le formulaire de rappel est l'un des cinq canaux de conversion, et le seul
   * dont on ne saura jamais rien sans le mesurer : il n'aboutit à aucune
   * réservation en base. `sourcePath` dit quelle page l'a produit — c'est ce
   * qui répond à « quelles pages communes convertissent ».
   */
  void tracer(
    { nom: "rappel_demande", page_origine: input.sourcePath ?? "inconnue" },
    { organizationId },
  );

  return { received: true as const };
});
