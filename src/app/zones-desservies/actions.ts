"use server";

import { z } from "zod";

import { publicAction } from "@/lib/action-result";
import { tracer } from "@/lib/analytics/journal";
import { prisma } from "@/lib/db";
import { marketplaceOrganizationId } from "@/lib/organizations";
import { isValidFrenchPhone, normalizePhone } from "@/lib/phone";
import { exigerQuota } from "@/lib/securite/limitation";

/**
 * Captation de la demande hors zone.
 *
 * Le tunnel rend une réservation hors zone structurellement impossible — la
 * commune se choisit dans le référentiel — et c'est un bon choix : il n'existe
 * aucun moyen de réserver un ménage qu'on ne saurait pas honorer.
 *
 * La conséquence est que **le produit n'a aucun signal d'expansion**. Personne
 * ne sait combien de gens ont voulu réserver depuis Pessac, ni combien
 * d'intervenants se sont proposés depuis Talence. Ouvrir une commune se décide
 * aujourd'hui à l'intuition ; cette table est ce qui permettra de le décider sur
 * des faits.
 *
 * Aucune coordonnée n'est enregistrée. Une commune suffit à décider d'ouvrir un
 * secteur ; un point désigne un domicile, et le conserver reviendrait à
 * constituer un fichier d'adresses de gens qui ne sont pas clients.
 */

const inscriptionSchema = z
  .object({
    kind: z.enum(["CLIENT", "CLEANER"]),

    email: z
      .string()
      .trim()
      .max(200)
      .refine(
        (value) => value === "" || z.email().safeParse(value).success,
        "Cette adresse email ne semble pas valide.",
      )
      .transform((value) => (value === "" ? null : value.toLowerCase())),

    phone: z
      .string()
      .trim()
      .max(30)
      .refine(
        (value) => value === "" || isValidFrenchPhone(value),
        "Ce numéro ne semble pas valide.",
      )
      .transform((value) => (value === "" ? null : normalizePhone(value))),

    communeName: z.string().trim().min(2).max(80),
    postalCode: z
      .string()
      .trim()
      .max(5)
      .refine(
        (value) => value === "" || /^\d{5}$/.test(value),
        "Un code postal comporte cinq chiffres.",
      )
      .transform((value) => (value === "" ? null : value)),

    sourcePath: z.string().max(200).optional(),

    /** Champ piège, invisible et sans autocomplétion. */
    website: z.string().max(0).optional(),
    /** Horodatage d'affichage : un envoi en moins de trois secondes n'est pas humain. */
    renderedAt: z.coerce.number().optional(),
  })
  .refine((valeur) => valeur.email !== null || valeur.phone !== null, {
    message:
      "Laissez au moins un email ou un téléphone pour qu'on vous prévienne.",
    path: ["email"],
  });

export const rejoindreLaListe = publicAction(
  inscriptionSchema,
  async (input) => {
    /*
     * Le champ piège et le délai n'arrêtent qu'un robot naïf. Le quota est
     * celui du rappel : les deux formulaires captent la même intention, et un
     * script qui martèle l'un ne doit pas trouver l'autre ouvert.
     */
    await exigerQuota("rappel");

    const looksAutomated =
      (input.website !== undefined && input.website !== "") ||
      (input.renderedAt !== undefined && Date.now() - input.renderedAt < 3000);

    if (looksAutomated) {
      // Même réponse qu'à une demande légitime : signaler le rejet apprendrait
      // au robot quoi contourner.
      return { received: true as const };
    }

    /*
     * Le client non cloisonné est employé sciemment : une demande hors zone
     * précède toute organisation, puisque aucune ne couvre ce lieu. C'est la
     * même raison qui met `RateLimit` hors du périmètre.
     */
    await prisma.waitlist.create({
      data: {
        kind: input.kind,
        email: input.email,
        phone: input.phone,
        communeName: input.communeName,
        postalCode: input.postalCode,
        sourcePath: input.sourcePath ?? null,
      },
    });

    void tracer(
      {
        nom: input.kind === "CLIENT" ? "rappel_demande" : "candidature_deposee",
        page_origine: input.sourcePath ?? "liste-attente",
      },
      { organizationId: await marketplaceOrganizationId() },
    );

    return { received: true as const };
  },
);
