"use server";

import { z } from "zod";

import { publicAction } from "@/lib/action-result";
import { forOrganization } from "@/lib/db";
import { marketplaceOrganizationId } from "@/lib/organizations";
import { normalizeReferralCode } from "@/lib/referral";
import { exigerQuota } from "@/lib/securite/limitation";
import { isCoveredInsee } from "@/lib/territory";

/**
 * Candidature d'intervenant.
 *
 * Six champs, parce que tout le reste se traite au téléphone : une candidature
 * qu'on abandonne à mi-parcours est une personne qu'on ne rappellera jamais, et
 * la vérification des pièces suppose de toute façon un échange.
 *
 * **La candidature est écrite dans `Lead`, pas dans une table dédiée**, et
 * c'est un arbitrage à revoir plutôt qu'une évidence. Le modèle porte déjà
 * `sourcePath`, qui distingue sans ambiguïté une candidature d'une demande de
 * rappel, et le reste tient dans `message` sous une forme qu'un humain lit au
 * moment de rappeler. Créer un modèle demanderait une migration que rien ne
 * justifie tant que le traitement est un coup de téléphone ; le jour où la
 * candidature devient un dossier avec des pièces et des états, elle aura sa
 * table.
 */

function normalizePhone(input: string): string {
  const digits = input.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+33")) return `0${digits.slice(3)}`;
  if (digits.startsWith("0033")) return `0${digits.slice(4)}`;
  return digits;
}

/** Situation déclarée par le candidat. Elle oriente le rappel, rien de plus. */
export const CANDIDATE_STATUSES = {
  INDEPENDANT: "Indépendant, déjà immatriculé",
  SOCIETE: "Je dirige une société de ménage",
  DEBUTANT: "Je me lance, je n'ai pas encore de statut",
} as const;

const candidatureSchema = z.object({
  firstName: z.string().trim().min(2, "Merci d'indiquer votre prénom.").max(60),
  lastName: z.string().trim().min(2, "Merci d'indiquer votre nom.").max(60),

  phone: z
    .string()
    .transform(normalizePhone)
    .refine(
      (value) => /^0[1-9]\d{8}$/.test(value),
      "Ce numéro ne semble pas valide. Exemple : 06 12 34 56 78.",
    ),

  communeInsee: z
    .string()
    .refine(
      (value) => isCoveredInsee(value),
      "Nous ne travaillons que dans les seize communes du secteur.",
    ),

  status: z.enum(
    Object.keys(CANDIDATE_STATUSES) as [keyof typeof CANDIDATE_STATUSES],
  ),

  availability: z.string().trim().max(500).optional(),

  /**
   * Code de parrainage, seulement quand il vient de l'URL.
   *
   * Normalisé par le module de cooptation plutôt que par une expression écrite
   * ici : c'est lui qui sait quels caractères se ressemblent et lesquels ne se
   * devinent pas. Un code invalide n'est pas une erreur bloquante — on ne
   * refuse pas une candidature parce qu'un lien de parrainage était mal
   * recopié, on la traite au téléphone.
   */
  referralCode: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((value) =>
      value === undefined || value === "" ? null : normalizeReferralCode(value),
    ),

  /** Champ piège, invisible et sans autocomplétion. */
  website: z.string().max(0).optional(),

  /** Horodatage d'affichage : un envoi en moins de trois secondes n'est pas humain. */
  renderedAt: z.coerce.number().optional(),
});

export const submitCandidature = publicAction(
  candidatureSchema,
  async (input) => {
    await exigerQuota("candidature");

    const looksAutomated =
      (input.website !== undefined && input.website !== "") ||
      (input.renderedAt !== undefined && Date.now() - input.renderedAt < 3000);

    if (looksAutomated) {
      // Même réponse qu'à une candidature légitime : signaler le rejet
      // apprendrait au robot quoi contourner.
      return { received: true as const };
    }

    const organizationId = await marketplaceOrganizationId();
    const db = forOrganization(organizationId);

    const details = [
      `Situation : ${CANDIDATE_STATUSES[input.status]}`,
      input.availability ? `Disponibilités : ${input.availability}` : null,
      input.referralCode ? `Code parrain : ${input.referralCode}` : null,
    ].filter((line): line is string => line !== null);

    await db.lead.create({
      data: {
        organizationId,
        name: `${input.firstName} ${input.lastName}`,
        phone: input.phone,
        email: null,
        communeInsee: input.communeInsee,
        message: details.join("\n"),
        sourcePath: "/travailler-avec-nous",
      },
    });

    return { received: true as const };
  },
);
