"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { publicAction } from "@/lib/action-result";
import { authedAction } from "@/lib/actions";
import { tracer } from "@/lib/analytics/journal";
import { getCurrentUser } from "@/lib/auth/session";
import { sendMagicLink } from "@/lib/auth/magic-link";
import {
  demanderDeLAide,
  deposerUnePiece,
  enregistrerSiret,
  ouvrirLaCreationDAutoEntreprise,
} from "@/lib/candidature/dossier";
import { PIECES, type Piece } from "@/lib/candidature/parcours";
import { MESSAGES_SIRENE, type RefusSirene } from "@/lib/candidature/sirene";
import { prisma } from "@/lib/db";
import { marketplaceOrganizationId } from "@/lib/organizations";
import { isValidFrenchPhone, normalizePhone } from "@/lib/phone";
import { exigerQuota } from "@/lib/securite/limitation";
import {
  FichierRefuseError,
  MESSAGES_REFUS,
  type RefusFichier,
} from "@/lib/stockage";
import { isCoveredInsee } from "@/lib/territory";

/**
 * Le funnel d'inscription intervenant.
 *
 * **Sauvegarde incrémentale à chaque écran.** Quelqu'un qui remplit ce
 * formulaire le fait souvent entre deux missions, sur un téléphone, dans une
 * salle d'attente : perdre sa saisie parce qu'il a fermé l'onglet est le moyen
 * le plus sûr de ne jamais le revoir. Le dossier existe dès l'éligibilité
 * passée, et il se reprend depuis n'importe quel appareil par lien magique.
 */

const eligibiliteSchema = z.object({
  communeInsee: z.string().min(1),
  travelMode: z.enum(["VEHICULE", "DEUX_ROUES", "TRANSPORTS", "A_PIED"]),
  hoursPerWeek: z.enum(["MOINS_10", "DE_10_A_20", "DE_20_A_35", "PLUS_35"]),
  experience: z.enum(["AUCUNE", "OCCASIONNELLE", "PLUSIEURS_ANNEES", "PRO"]),
  statut: z.enum(["SIRET_ACTIF", "EN_COURS", "AUCUN"]),

  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  /*
   * Normaliser **puis** valider, comme le formulaire de rappel :
   * `isValidFrenchPhone` attend un numéro déjà normalisé, et le dépôt promet
   * d'accepter les numéros tels que les gens les écrivent.
   */
  phone: z
    .string()
    .trim()
    .transform(normalizePhone)
    .refine(
      isValidFrenchPhone,
      "Ce numéro ne semble pas valide. Exemple : 06 12 34 56 78.",
    ),
  email: z.email(),

  website: z.string().max(0).optional(),
  renderedAt: z.coerce.number().optional(),
});

/**
 * Ouvre un dossier.
 *
 * L'écran d'éligibilité ne rejette **jamais** sur le statut : quelqu'un sans
 * SIRET est un candidat à quatre semaines, pas un candidat écarté. Seule la
 * couverture géographique arrête, et elle propose la liste d'attente.
 */
export const ouvrirUnDossier = publicAction(
  eligibiliteSchema,
  async (input) => {
    await exigerQuota("candidature");

    const automatise =
      (input.website !== undefined && input.website !== "") ||
      (input.renderedAt !== undefined && Date.now() - input.renderedAt < 3000);
    if (automatise) return { dossierId: null, envoye: true as const };

    if (!isCoveredInsee(input.communeInsee)) {
      /*
       * Hors zone, on ne fait pas semblant : la candidature n'ouvre pas, la
       * demande rejoint la liste d'attente, et c'est elle qui décidera un jour
       * d'ouvrir la commune. Faire venir quelqu'un pour rien coûte davantage
       * qu'un refus honnête.
       */
      await prisma.waitlist.create({
        data: {
          kind: "CLEANER",
          email: input.email.toLowerCase(),
          phone: input.phone,
          communeName: input.communeInsee,
          sourcePath: "/rejoindre",
        },
      });
      return { dossierId: null, horsZone: true as const };
    }

    const dossier = await prisma.proApplication.create({
      data: {
        status: "COMMENCE",
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email.toLowerCase(),
        declaredInsee: input.communeInsee,
        travelMode: input.travelMode,
        hoursPerWeek: input.hoursPerWeek,
        experience: input.experience,
        branchLegal:
          input.statut === "SIRET_ACTIF" ? "SIRET_EXISTANT" : "CREATION_AE",
        source: "/rejoindre",
      },
      select: { id: true },
    });

    await prisma.proApplicationEvent.create({
      data: { applicationId: dossier.id, event: "dossier_ouvert" },
    });

    /*
     * Le lien magique part tout de suite : c'est lui qui permet de reprendre
     * depuis un autre appareil, et c'est la seule chose qui rattrape un
     * abandon. Son échec ne fait pas échouer l'ouverture du dossier.
     */
    let lienEnvoye = false;
    try {
      await sendMagicLink({
        email: input.email.toLowerCase(),
        callbackUrl: "/rejoindre/dossier",
      });
      lienEnvoye = true;
    } catch (erreur) {
      console.error("Lien de reprise de candidature non envoyé", erreur);
    }

    void tracer(
      { nom: "candidature_deposee", page_origine: "/rejoindre" },
      { organizationId: await marketplaceOrganizationId() },
    );

    return { dossierId: dossier.id, lienEnvoye };
  },
);

async function dossierDe(userId: string) {
  const dossier = await prisma.proApplication.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!dossier) throw new Error("Aucun dossier de candidature.");
  return dossier;
}

export const declarerMonSiret = authedAction(
  z.object({ siret: z.string().trim().min(9).max(20) }),
  async ({ siret }, user) => {
    const dossier = await dossierDe(user.id);
    const resultat = await enregistrerSiret(dossier.id, siret);

    revalidatePath("/rejoindre/dossier");

    if (!resultat.ok) {
      return {
        verifie: false,
        poursuivable: resultat.poursuivable,
        message:
          MESSAGES_SIRENE[resultat.refus as RefusSirene] ??
          "Ce SIRET n'a pas pu être vérifié.",
      };
    }

    return {
      verifie: true,
      poursuivable: true,
      raisonSociale: resultat.raisonSociale,
      message: null,
    };
  },
);

export const jaiEnvoyeMaDemarche = authedAction(
  z.object({}),
  async (_input, user) => {
    const dossier = await dossierDe(user.id);
    await ouvrirLaCreationDAutoEntreprise(dossier.id);
    revalidatePath("/rejoindre/dossier");
    return { enAttente: true };
  },
);

/**
 * « Je suis bloqué ».
 *
 * Présent sur chaque écran des branches longues, et c'est le point de sauvetage
 * le plus rentable du funnel : entre le moment où quelqu'un ouvre le Guichet
 * unique et celui où il abandonne, il y a une question sans réponse.
 */
export const jeSuisBloque = authedAction(
  z.object({ etape: z.string().trim().max(120) }),
  async ({ etape }, user) => {
    const dossier = await dossierDe(user.id);
    await demanderDeLAide(dossier.id, await marketplaceOrganizationId(), etape);
    return { rappelDemande: true };
  },
);

/**
 * Rattache un dossier ouvert avant la connexion au compte qui vient de se créer.
 *
 * L'éligibilité se passe sans compte — c'est ce qui la rend franchissable — et
 * le lien magique crée le compte ensuite. Le rapprochement se fait sur l'email,
 * qui est la seule chose commune aux deux moments.
 */
export async function rattacherLeDossier(): Promise<void> {
  const user = await getCurrentUser();
  if (!user?.email) return;

  await prisma.proApplication.updateMany({
    where: { email: user.email.toLowerCase(), userId: null },
    data: { userId: user.id },
  });
}

/**
 * Dépôt d'une pièce.
 *
 * Le fichier arrive en `FormData` : c'est le seul moyen de faire traverser des
 * octets à une server action sans les encoder en base64, ce qui gonflerait la
 * charge d'un tiers.
 */
export async function deposerMaPiece(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Connectez-vous pour déposer." };

  const kind = formData.get("kind");
  const fichier = formData.get("fichier");

  if (typeof kind !== "string" || !PIECES.includes(kind as Piece)) {
    return { ok: false, error: "Pièce inconnue." };
  }
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, error: "Aucun fichier reçu." };
  }

  try {
    const dossier = await dossierDe(user.id);
    await deposerUnePiece(
      dossier.id,
      kind as Piece,
      new Uint8Array(await fichier.arrayBuffer()),
    );
    revalidatePath("/rejoindre/dossier");
    return { ok: true };
  } catch (error) {
    /*
     * Deux familles d'échec, deux messages. Un fichier refusé se corrige par
     * la personne — on lui dit quoi. Un stockage absent ne se corrige pas par
     * elle : on ne lui fait pas croire que son fichier était fautif.
     */
    if (error instanceof FichierRefuseError) {
      return {
        ok: false,
        error: MESSAGES_REFUS[error.refus as RefusFichier] ?? error.message,
      };
    }
    console.error("Dépôt de pièce impossible", error);
    return {
      ok: false,
      error:
        "Le dépôt de pièces n'est pas encore ouvert. Appelez-nous, on prend " +
        "vos documents autrement.",
    };
  }
}
