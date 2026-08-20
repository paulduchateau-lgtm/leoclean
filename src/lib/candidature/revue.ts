import "server-only";

import { prisma } from "@/lib/db";

import {
  type CritereEntretien,
  type MotifRefusPiece,
  type Piece,
  type SignalAttention,
  type Statut,
  MOTIFS_REFUS_PIECE,
  bloquant,
  peutEtreActivee,
  progression,
} from "./parcours";

/**
 * La revue d'un dossier, côté plateforme.
 *
 * **Rien ne se valide tout seul.** Une pièce se valide par quelqu'un qui l'a
 * regardée : s'auto-valider au dépôt viderait de son sens la promesse de
 * « professionnels vérifiés » faite aux clients, qui est la contrepartie du
 * prix.
 *
 * Toute décision est journalisée avec son auteur. Ce n'est pas de la
 * traçabilité pour la traçabilité : un refus se conteste, et six mois plus tard
 * personne ne se souvient de ce qui a été regardé.
 */

export interface DossierEnRevue {
  id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  commune: string | null;
  statut: Statut;
  progression: number;
  activable: boolean;
  /** Un signal bloquant suspend l'examen : on ne le contourne pas d'un clic. */
  signauxBloquants: SignalAttention[];
  signaux: SignalAttention[];
  siret: string | null;
  raisonSociale: string | null;
  apeCode: string | null;
  presentation: string | null;
  experience: string | null;
  entretienLe: string | null;
  notesEntretien: string | null;
  chartesSigneesLe: string | null;
  depuis: string;
  pieces: {
    kind: Piece;
    status: string;
    motif: string | null;
    deposee: boolean;
    expireLe: string | null;
  }[];
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
}) {
  return {
    statut: dossier.status as Statut,
    brancheStatut: dossier.branchLegal as
      "SIRET_EXISTANT" | "CREATION_AE" | null,
    brancheSap: dossier.branchSap as "SAP_EXISTANT" | "SAP_A_DECLARER" | null,
    profilComplet: Boolean(dossier.presentation && dossier.experience),
    photoDeposee: Boolean(dossier.photoPath),
    siretVerifie: dossier.siretVerifiedAt !== null,
    sapVerifie: dossier.sapVerifiedAt !== null,
    piecesValidees: dossier.documents
      .filter((document) => document.status === "VALIDEE")
      .map((document) => document.kind as Piece),
    entretienPasse: dossier.interviewAt !== null,
    chartesSignees: dossier.chartersSignedAt !== null,
  };
}

/**
 * Les dossiers à examiner, du plus ancien au plus récent.
 *
 * L'ordre n'est pas cosmétique : traiter le plus récent d'abord laisse
 * indéfiniment au fond de la pile celui qui attend depuis trois semaines, et
 * c'est celui-là qu'on perd.
 */
export async function dossiersEnRevue(limite = 50): Promise<DossierEnRevue[]> {
  const dossiers = await prisma.proApplication.findMany({
    where: { status: { notIn: ["ACTIF", "REFUSE", "ABANDONNE"] } },
    orderBy: { lastActivityAt: "asc" },
    take: limite,
    include: { documents: true },
  });

  return dossiers.map((dossier) => {
    const signaux = dossier.flags as SignalAttention[];
    return {
      id: dossier.id,
      nom:
        [dossier.firstName, dossier.lastName].filter(Boolean).join(" ") || "—",
      email: dossier.email,
      telephone: dossier.phone,
      commune: dossier.declaredCity,
      statut: dossier.status as Statut,
      progression: progression(etatDe(dossier)),
      activable: peutEtreActivee(etatDe(dossier)),
      signauxBloquants: signaux.filter(bloquant),
      signaux,
      siret: dossier.siret,
      raisonSociale: dossier.legalName,
      apeCode: dossier.apeCode,
      presentation: dossier.presentation,
      experience: dossier.experience,
      entretienLe: dossier.interviewAt?.toISOString() ?? null,
      notesEntretien: dossier.interviewNotes,
      chartesSigneesLe: dossier.chartersSignedAt?.toISOString() ?? null,
      depuis: dossier.lastActivityAt.toISOString(),
      pieces: dossier.documents.map((document) => ({
        kind: document.kind as Piece,
        status: document.status,
        motif: document.rejectReason,
        deposee: document.storagePath !== null,
        expireLe: document.expiresOn?.toISOString() ?? null,
      })),
    };
  });
}

async function journaliser(
  applicationId: string,
  event: string,
  auteurId: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  await prisma.proApplicationEvent.create({
    data: {
      applicationId,
      event,
      payload: { ...(payload ?? {}), parId: auteurId } as never,
    },
  });
}

export async function validerUnePiece(
  applicationId: string,
  kind: Piece,
  auteurId: string,
  expireLe: Date | null = null,
  maintenant: Date = new Date(),
): Promise<void> {
  await prisma.proApplicationDocument.update({
    where: { applicationId_kind: { applicationId, kind } },
    data: {
      status: "VALIDEE",
      verifiedAt: maintenant,
      verifiedById: auteurId,
      rejectReason: null,
      expiresOn: expireLe,
    },
  });
  await journaliser(applicationId, "piece_validee", auteurId, { kind });
}

/**
 * Refus d'une pièce.
 *
 * Le motif est choisi dans une liste écrite en langage courant, jamais rédigé
 * à la volée : un motif vague fait redéposer la même pièce, et c'est le
 * candidat qui paie l'aller-retour.
 */
export async function refuserUnePiece(
  applicationId: string,
  kind: Piece,
  motif: MotifRefusPiece,
  auteurId: string,
  precision: string | null = null,
  maintenant: Date = new Date(),
): Promise<void> {
  const texte = precision?.trim() || MOTIFS_REFUS_PIECE[motif];
  if (!texte) {
    throw new Error("Un refus « Autre » doit porter sa propre explication.");
  }

  await prisma.$transaction([
    prisma.proApplicationDocument.update({
      where: { applicationId_kind: { applicationId, kind } },
      data: {
        status: "REFUSEE",
        rejectReason: texte,
        verifiedAt: maintenant,
        verifiedById: auteurId,
      },
    }),
    prisma.proApplication.update({
      where: { id: applicationId },
      data: {
        status: "PIECES_REFUSEES",
        lastActivityAt: maintenant,
        nudgesSent: 0,
      },
    }),
  ]);
  await journaliser(applicationId, "piece_refusee", auteurId, { kind, motif });
}

export async function planifierLEntretien(
  applicationId: string,
  quand: Date,
  auteurId: string,
): Promise<void> {
  await prisma.proApplication.update({
    where: { id: applicationId },
    data: { status: "ENTRETIEN_PLANIFIE", interviewAt: quand },
  });
  await journaliser(applicationId, "entretien_planifie", auteurId, {
    quand: quand.toISOString(),
  });
}

/**
 * Compte rendu d'entretien.
 *
 * La grille homogénéise, **elle ne classe pas** : elle sert de trace en cas de
 * contestation et évite qu'une décision repose sur une impression que personne
 * ne saurait redire six mois plus tard. Aucune moyenne n'est calculée, et c'est
 * délibéré — une moyenne ferait compenser « français opérationnel » par
 * « motivation », ce qui ne veut rien dire.
 */
export async function consignerLEntretien(
  applicationId: string,
  notes: Partial<Record<CritereEntretien, number>>,
  compteRendu: string,
  auteurId: string,
  maintenant: Date = new Date(),
): Promise<void> {
  await prisma.proApplication.update({
    where: { id: applicationId },
    data: {
      status: "ENTRETIEN_PASSE",
      interviewAt: maintenant,
      interviewScores: notes as never,
      interviewNotes: compteRendu,
      lastActivityAt: maintenant,
    },
  });
  await journaliser(applicationId, "entretien_passe", auteurId);
}

export class ActivationRefuseeError extends Error {}

/**
 * Activation : le dossier devient un intervenant.
 *
 * Deux verrous, et ils ne se contournent pas depuis l'écran. `peutEtreActivee`
 * dit ce qui manque ; un signal bloquant — IBAN au nom d'un tiers, IBAN déjà
 * vu — suspend l'examen quoi qu'en dise le reste du dossier, parce que ce sont
 * les deux vecteurs par lesquels quelqu'un se fait payer le travail d'un autre.
 */
export async function activer(
  applicationId: string,
  organizationId: string,
  auteurId: string,
  maintenant: Date = new Date(),
): Promise<{ cleanerProfileId: string }> {
  const dossier = await prisma.proApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: { documents: true },
  });

  const signauxBloquants = (dossier.flags as SignalAttention[]).filter(
    bloquant,
  );
  if (signauxBloquants.length > 0) {
    throw new ActivationRefuseeError(
      `Examen suspendu : ${signauxBloquants.join(", ")}.`,
    );
  }
  if (!peutEtreActivee(etatDe(dossier))) {
    throw new ActivationRefuseeError("Le dossier n'est pas complet.");
  }
  if (!dossier.userId) {
    throw new ActivationRefuseeError(
      "Ce dossier n'est rattaché à aucun compte : le candidat doit se connecter une fois.",
    );
  }

  const profil = await prisma.$transaction(async (tx) => {
    const cree = await tx.cleanerProfile.create({
      data: {
        organizationId,
        userId: dossier.userId!,
        displayName: dossier.firstName ?? "Intervenant",
        siret: dossier.siret,
        /*
         * Le numéro SAP reste nul s'il manque : la déclaration met des semaines
         * à être instruite, et l'attendre reviendrait à ne recruter personne au
         * lancement. Tant qu'il manque, la part de cet intervenant n'ouvre
         * aucun crédit d'impôt — c'est `activationState` qui le dit, en
         * avertissement plutôt qu'en blocage.
         */
        sapDeclarationNumber: dossier.sapNumber,
        bio: dossier.presentation,
        /*
         * `ACTIVE` et non `PENDING_VERIFICATION` : c'est précisément la
         * vérification qui vient de s'achever. L'adresse de départ de tournée
         * reste à renseigner — sans elle le moteur retombe sur le centre de la
         * commune, ce qui rend les créneaux un peu plus prudents sans jamais
         * les rendre faux.
         */
        status: "ACTIVE",
        activatedAt: maintenant,
      },
      select: { id: true },
    });

    await tx.membership.create({
      data: {
        organizationId,
        userId: dossier.userId!,
        role: "CLEANER",
        status: "ACTIVE",
      },
    });

    await tx.proApplication.update({
      where: { id: applicationId },
      data: {
        status: "ACTIF",
        decidedAt: maintenant,
        decidedById: auteurId,
      },
    });

    return cree;
  });

  await journaliser(applicationId, "active", auteurId, {
    cleanerProfileId: profil.id,
  });

  return { cleanerProfileId: profil.id };
}

/**
 * Refus d'un dossier.
 *
 * Le motif est **obligatoire** et il est écrit pour être lu par la personne :
 * un refus sans motif se conteste sans qu'on puisse rien répondre, et il se
 * rejoue à l'identique la semaine suivante.
 */
export async function refuser(
  applicationId: string,
  motif: string,
  auteurId: string,
  maintenant: Date = new Date(),
): Promise<void> {
  const texte = motif.trim();
  if (texte.length < 10) {
    throw new Error("Un refus doit porter un motif rédigé.");
  }

  await prisma.proApplication.update({
    where: { id: applicationId },
    data: {
      status: "REFUSE",
      decidedAt: maintenant,
      decidedById: auteurId,
      decisionReason: texte,
    },
  });
  await journaliser(applicationId, "refuse", auteurId, { motif: texte });
}
