import "server-only";

import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";

import {
  type EtatCandidature,
  type Piece,
  type SignalAttention,
  type Statut,
  ceQuiManque,
  peutEtreActivee,
  progression,
} from "./parcours";
import { nomsConcordent, verifierSiret } from "./sirene";

/**
 * Le dossier de candidature, côté écriture.
 *
 * `parcours.ts` décide, ce module persiste. Chaque changement est journalisé
 * dans `ProApplicationEvent` : sans cela, on ne sait pas pourquoi un dossier est
 * là où il est, ni depuis quand — et c'est précisément ce qu'on veut savoir
 * quand un candidat rappelle trois semaines plus tard.
 */

export interface DossierVue {
  id: string;
  statut: Statut;
  brancheStatut: string | null;
  brancheSap: string | null;
  prenom: string | null;
  progression: number;
  manques: string[];
  activable: boolean;
  signaux: SignalAttention[];
  siret: string | null;
  raisonSociale: string | null;
  pieces: { kind: Piece; status: string; motif: string | null }[];
}

async function journaliser(
  applicationId: string,
  event: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  await prisma.proApplicationEvent.create({
    data: { applicationId, event, payload: (payload ?? undefined) as never },
  });
}

function etatDe(dossier: {
  status: string;
  branchLegal: string | null;
  branchSap: string | null;
  presentation: string | null;
  experience: string | null;
  photoPath: string | null;
  siretVerifiedAt: Date | null;
  sapVerifiedAt: Date | null;
  interviewAt: Date | null;
  chartersSignedAt: Date | null;
  documents: { kind: string; status: string }[];
}): EtatCandidature {
  return {
    statut: dossier.status as Statut,
    brancheStatut: dossier.branchLegal as EtatCandidature["brancheStatut"],
    brancheSap: dossier.branchSap as EtatCandidature["brancheSap"],
    profilComplet: Boolean(dossier.presentation && dossier.experience),
    photoDeposee: Boolean(dossier.photoPath),
    siretVerifie: dossier.siretVerifiedAt !== null,
    sapVerifie: dossier.sapVerifiedAt !== null,
    piecesValidees: dossier.documents
      .filter((d) => d.status === "VALIDEE")
      .map((d) => d.kind as Piece),
    entretienPasse: dossier.interviewAt !== null,
    chartesSignees: dossier.chartersSignedAt !== null,
  };
}

/** Le dossier de la personne connectée, ou rien. */
export async function lireDossier(userId: string): Promise<DossierVue | null> {
  const dossier = await prisma.proApplication.findUnique({
    where: { userId },
    include: { documents: true },
  });
  if (!dossier) return null;

  const etat = etatDe(dossier);

  return {
    id: dossier.id,
    statut: dossier.status as Statut,
    brancheStatut: dossier.branchLegal,
    brancheSap: dossier.branchSap,
    prenom: dossier.firstName,
    progression: progression(etat),
    manques: ceQuiManque(etat),
    activable: peutEtreActivee(etat),
    signaux: dossier.flags as SignalAttention[],
    siret: dossier.siret,
    raisonSociale: dossier.legalName,
    pieces: dossier.documents.map((document) => ({
      kind: document.kind as Piece,
      status: document.status,
      motif: document.rejectReason,
    })),
  };
}

/**
 * Détection de doublons.
 *
 * Téléphone, SIRET : les deux entrées par lesquelles quelqu'un ouvre un second
 * dossier. **Aucune ne bloque ici** — les signaux sont posés et un humain
 * tranche. Refuser automatiquement écarterait le cas parfaitement régulier de
 * deux personnes d'un même foyer qui postulent avec le téléphone de la maison.
 */
export async function detecterDoublons(
  applicationId: string,
  input: { phone?: string | null; siret?: string | null },
): Promise<SignalAttention[]> {
  const signaux: SignalAttention[] = [];

  if (input.phone) {
    const autre = await prisma.proApplication.findFirst({
      where: { phone: input.phone, id: { not: applicationId } },
      select: { id: true },
    });
    if (autre) signaux.push("DOUBLON_TELEPHONE");
  }

  if (input.siret) {
    const autre = await prisma.proApplication.findFirst({
      where: { siret: input.siret, id: { not: applicationId } },
      select: { id: true },
    });
    if (autre) signaux.push("DOUBLON_SIRET");

    const dejaIntervenant = await prisma.cleanerProfile.findFirst({
      where: { siret: input.siret },
      select: { id: true },
    });
    if (dejaIntervenant) signaux.push("DOUBLON_SIRET");
  }

  return [...new Set(signaux)];
}

/**
 * Vérifie et enregistre un SIRET.
 *
 * **Aucune re-saisie** : la raison sociale, le code APE et la date de création
 * viennent de l'API. Les redemander serait faire recopier ce qu'on sait déjà.
 *
 * Une panne de l'INSEE ne ferme pas le funnel : le dossier avance, la
 * vérification passe en revue humaine, et c'est dit au candidat.
 */
export async function enregistrerSiret(
  applicationId: string,
  siret: string,
  maintenant: Date = new Date(),
): Promise<
  | { ok: true; raisonSociale: string | null; signaux: SignalAttention[] }
  | { ok: false; refus: string; poursuivable: boolean }
> {
  const dossier = await prisma.proApplication.findUnique({
    where: { id: applicationId },
    select: { firstName: true, lastName: true, flags: true },
  });
  if (!dossier) return { ok: false, refus: "INTROUVABLE", poursuivable: false };

  const resultat = await verifierSiret(siret, {
    jeton: serverEnv.INSEE_API_KEY,
    maintenant,
  });

  if (!resultat.ok) {
    /*
     * Une indisponibilité laisse continuer : le SIRET est enregistré non
     * vérifié et la revue humaine tranchera. Un SIRET introuvable ou cessé
     * arrête, lui — la distinction est faite dans `sirene.ts`, ici on en tire
     * seulement la conséquence.
     */
    const poursuivable = resultat.refus === "SERVICE_INDISPONIBLE";
    if (poursuivable) {
      await prisma.proApplication.update({
        where: { id: applicationId },
        data: { siret: siret.replace(/\s/g, ""), lastActivityAt: maintenant },
      });
      await journaliser(applicationId, "siret_a_verifier_a_la_main", { siret });
    }
    return { ok: false, refus: resultat.refus, poursuivable };
  }

  const signaux = [...resultat.etablissement.signaux];

  const nomDeclare = [dossier.firstName, dossier.lastName]
    .filter(Boolean)
    .join(" ");
  if (
    resultat.etablissement.raisonSociale &&
    nomDeclare &&
    !nomsConcordent(nomDeclare, resultat.etablissement.raisonSociale)
  ) {
    signaux.push("NOM_INCOHERENT");
  }

  const doublons = await detecterDoublons(applicationId, {
    siret: resultat.etablissement.siret,
  });

  await prisma.proApplication.update({
    where: { id: applicationId },
    data: {
      siret: resultat.etablissement.siret,
      siretVerifiedAt: maintenant,
      legalName: resultat.etablissement.raisonSociale,
      apeCode: resultat.etablissement.codeApe,
      branchLegal: "SIRET_EXISTANT",
      flags: [...new Set([...dossier.flags, ...signaux, ...doublons])],
      lastActivityAt: maintenant,
      nudgesSent: 0,
      /*
       * L'avis de situation est engendré depuis l'API plutôt que demandé :
       * faire télécharger au candidat ce qu'on vient de lire est un abandon
       * gratuit dans le funnel.
       */
      documents: {
        upsert: {
          where: { applicationId_kind: { applicationId, kind: "AVIS_SIRENE" } },
          create: { kind: "AVIS_SIRENE", status: "VALIDEE", verifiedAt: maintenant },
          update: { status: "VALIDEE", verifiedAt: maintenant, rejectReason: null },
        },
      },
    },
  });

  await journaliser(applicationId, "siret_verifie", {
    siret: resultat.etablissement.siret,
    signaux,
  });

  return {
    ok: true,
    raisonSociale: resultat.etablissement.raisonSociale,
    signaux: [...signaux, ...doublons],
  };
}

/**
 * Bascule le dossier dans la branche « création d'auto-entreprise ».
 *
 * **Le statut ne recule pas.** La progression affichée non plus : quelqu'un qui
 * découvre qu'il doit créer une auto-entreprise voit s'ouvrir un sous-parcours,
 * pas un retour en arrière. C'est le moment précis où il a besoin d'être
 * rassuré.
 */
export async function ouvrirLaCreationDAutoEntreprise(
  applicationId: string,
  maintenant: Date = new Date(),
): Promise<void> {
  await prisma.proApplication.update({
    where: { id: applicationId },
    data: {
      branchLegal: "CREATION_AE",
      status: "ATTENTE_SIRET",
      siretSubmittedAt: maintenant,
      lastActivityAt: maintenant,
      nudgesSent: 0,
    },
  });
  await journaliser(applicationId, "demarche_ae_envoyee");
}

/**
 * Le candidat demande de l'aide.
 *
 * Ce bouton est le point de sauvetage le plus rentable du funnel : il figure
 * sur chaque écran des branches longues. Ce qu'il crée est une demande de
 * rappel — la même table que les autres, distinguée par son `sourcePath`.
 */
export async function demanderDeLAide(
  applicationId: string,
  organizationId: string,
  etape: string,
): Promise<void> {
  const dossier = await prisma.proApplication.findUnique({
    where: { id: applicationId },
    select: { firstName: true, lastName: true, phone: true, email: true },
  });
  if (!dossier?.phone) return;

  await prisma.lead.create({
    data: {
      organizationId,
      name: [dossier.firstName, dossier.lastName].filter(Boolean).join(" "),
      phone: dossier.phone,
      email: dossier.email,
      message: `Candidature bloquée à l'étape « ${etape} ».`,
      sourcePath: "/rejoindre",
    },
  });

  await journaliser(applicationId, "aide_demandee", { etape });
}
