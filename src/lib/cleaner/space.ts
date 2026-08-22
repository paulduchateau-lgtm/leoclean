import "server-only";

import {
  activationState,
  type ActivationState,
} from "@/lib/cleaner/activation";
import {
  type EtatCompte,
  type PieceVue,
  etatDesPieces,
  etatDuCompte,
  peutSoumettreLeDossier,
} from "@/lib/cleaner/etat-compte";
import {
  checkSapNumber,
  checkSiret,
  identifiantRefusalMessage,
} from "@/lib/cleaner/identifiants";
import type { TenantClient } from "@/lib/db";
import { BusinessError } from "@/lib/booking/errors";
import { generateReferralCode } from "@/lib/referral";
import {
  REFERRAL_PROGRAMS,
  assertReferralEligible,
} from "@/lib/referral/rules";

/**
 * Lecture et écriture de l'espace intervenant.
 *
 * La décision vit dans les modules purs — `identifiants.ts` pour les
 * contrôles, `activation.ts` pour ce qui manque, `referral/rules.ts` pour la
 * cooptation. Ce module-ci ne fait que la base.
 */

export class DossierRefuseError extends BusinessError {
  override readonly name = "DossierRefuseError";
}

export class ProfilIntrouvableError extends BusinessError {
  override readonly name = "ProfilIntrouvableError";

  constructor() {
    super("Aucun dossier d'intervenant n'est rattaché à ce compte.");
  }
}

async function profilDe(db: TenantClient, user: { id: string }) {
  const profil = await db.cleanerProfile.findFirst({
    where: { userId: user.id },
    select: {
      id: true,
      organizationId: true,
      displayName: true,
      photoUrl: true,
      status: true,
      siret: true,
      sapDeclarationNumber: true,
      insuranceExpiresAt: true,
      suspensionOrigin: true,
      suspendedAt: true,
      suspensionReason: true,
      dossierSubmittedAt: true,
      documents: {
        select: {
          type: true,
          status: true,
          expiresAt: true,
          rejectionReason: true,
        },
      },
    },
  });
  if (!profil) throw new ProfilIntrouvableError();
  return profil;
}

/**
 * Enregistre les identifiants professionnels saisis au dossier.
 *
 * Les deux contrôles qui comptent sont faits avant l'écriture : la clé du
 * SIRET, et la cohérence du numéro SAP avec ce SIRET. Le second est le plus
 * utile — un numéro de déclaration emprunté ouvrirait un crédit d'impôt indu
 * au client, qui le rembourserait.
 *
 * Rien n'active le dossier ici : l'activation reste une décision humaine, sur
 * pièces vérifiées. Ce qu'on écrit, ce sont des déclarations.
 */
export async function enregistrerIdentifiants(
  db: TenantClient,
  user: { id: string },
  input: {
    siret: string;
    sapDeclarationNumber?: string | null;
    insuranceExpiresAt?: Date | null;
  },
): Promise<{ siret: string; sapDeclarationNumber: string | null }> {
  const profil = await profilDe(db, user);

  const siret = checkSiret(input.siret);
  if (!siret.valid) {
    throw new DossierRefuseError(identifiantRefusalMessage(siret.refusal!));
  }

  let sap: string | null = null;
  if (input.sapDeclarationNumber && input.sapDeclarationNumber.trim() !== "") {
    const check = checkSapNumber(input.sapDeclarationNumber, siret.normalized);
    if (!check.valid) {
      throw new DossierRefuseError(identifiantRefusalMessage(check.refusal!));
    }
    sap = check.normalized;
  }

  await db.cleanerProfile.update({
    where: { id: profil.id },
    data: {
      siret: siret.normalized,
      sapDeclarationNumber: sap,
      insuranceExpiresAt: input.insuranceExpiresAt ?? undefined,
    },
  });

  return { siret: siret.normalized, sapDeclarationNumber: sap };
}

/**
 * Rattache un filleul à son parrain, à l'inscription.
 *
 * L'éligibilité est tranchée par `referral/rules.ts`, qui existait avant cette
 * page et dont les règles sont verrouillées par ses propres tests : pas
 * d'auto-parrainage, pas de second parrainage, un code d'intervenant ne
 * parraine qu'un intervenant.
 */
export async function rattacherParrain(
  db: TenantClient,
  user: { id: string },
  code: string,
): Promise<{ rattache: boolean }> {
  const profil = await profilDe(db, user);

  const referralCode = await db.referralCode.findFirst({
    where: { code: code.toUpperCase() },
    select: { id: true, ownerUserId: true, isActive: true, kind: true },
  });
  if (!referralCode) {
    throw new DossierRefuseError("Ce code de parrainage n'existe pas.");
  }

  const dejaParraine = await db.referral.findFirst({
    where: { refereeUserId: user.id },
    select: { id: true },
  });

  assertReferralEligible({
    referrerUserId: referralCode.ownerUserId,
    refereeUserId: user.id,
    codeIsActive: referralCode.isActive,
    refereeAlreadyReferred: dejaParraine !== null,
    codeKind: referralCode.kind,
    refereeKind: "CLEANER",
  });

  /*
   * Aucune colonne ne porte le parrain : il est le propriétaire du code.
   * C'est ce qui rend structurellement impossible de remonter d'un filleul à
   * son parrain puis au parrain de celui-ci — le second niveau n'est pas
   * interdit par une règle, il est inexprimable.
   */
  await db.referral.create({
    data: {
      organizationId: profil.organizationId,
      referralCodeId: referralCode.id,
      refereeUserId: user.id,
      expiresAt: new Date(
        Date.now() + REFERRAL_PROGRAMS.CLEANER.expiryDays * 86_400_000,
      ),
    },
  });

  return { rattache: true };
}

export interface ParrainageView {
  /** Le code à partager. Créé au premier affichage, jamais avant. */
  code: string;
  /** Filleuls rattachés, tous statuts confondus. */
  filleuls: number;
  /** Filleuls dont le compteur est ouvert. */
  filleulsQualifies: number;
  /** Commissions déjà acquises, en centimes. */
  cumulCents: number;
}

/**
 * Code de parrainage et chiffre d'affaires de filleuls.
 *
 * Le code est créé à la demande plutôt qu'à l'inscription : la plupart des
 * intervenants ne parraineront personne, et une table pleine de codes jamais
 * partagés est une table qu'on finit par purger.
 */
export async function lireParrainage(
  db: TenantClient,
  user: { id: string },
): Promise<ParrainageView> {
  const profil = await profilDe(db, user);

  let code = await db.referralCode.findFirst({
    where: { ownerUserId: user.id, kind: "CLEANER" },
    select: { code: true },
  });

  if (!code) {
    code = await db.referralCode.create({
      data: {
        organizationId: profil.organizationId,
        ownerUserId: user.id,
        kind: "CLEANER",
        code: generateReferralCode({ prefix: profil.displayName }),
      },
      select: { code: true },
    });
  }

  // Le parrain se lit par son code, faute de colonne qui le désigne.
  const parDeCode = { referralCode: { ownerUserId: user.id } };

  const [filleuls, filleulsQualifies, recompenses] = await Promise.all([
    db.referral.count({ where: parDeCode }),
    db.referral.count({ where: { ...parDeCode, status: "QUALIFIED" } }),
    db.referralReward.aggregate({
      where: { referral: parDeCode, status: { not: "CANCELLED" } },
      _sum: { amountCents: true },
    }),
  ]);

  return {
    code: code.code,
    filleuls,
    filleulsQualifies,
    cumulCents: recompenses._sum.amountCents ?? 0,
  };
}

export interface DossierView {
  displayName: string;
  /** Portrait choisi par l'intervenant, ou `null`. */
  photoUrl: string | null;
  status: string;
  siret: string | null;
  sapDeclarationNumber: string | null;
  insuranceExpiresAt: string | null;
  activation: ActivationState;
  /** L'état affiché en haut de chaque écran de l'espace. */
  etat: EtatCompte;
  /** Les quatre pièces, cochées ou non. */
  pieces: PieceVue[];
  /** Le dossier est-il en état d'être soumis à validation ? */
  peutSoumettre: boolean;
  dossierSoumisLe: string | null;
  suspensionMotif: string | null;
}

/** État du dossier, tel que l'intervenant doit le lire. */
export async function lireDossier(
  db: TenantClient,
  user: { id: string },
  now: Date,
): Promise<DossierView> {
  const profil = await profilDe(db, user);

  const activation = activationState({
    siret: profil.siret,
    sapDeclarationNumber: profil.sapDeclarationNumber,
    insuranceExpiresAt: profil.insuranceExpiresAt,
    documents: profil.documents,
    now,
  });

  /*
   * L'état et les pièces sont dérivés par le module pur, jamais recomposés
   * ici : le bandeau, la page dossier et le back-office lisent la même
   * fonction, et ne peuvent donc pas se contredire.
   */
  const pieces = etatDesPieces(profil.documents, now);

  return {
    displayName: profil.displayName,
    photoUrl: profil.photoUrl,
    status: profil.status,
    siret: profil.siret,
    sapDeclarationNumber: profil.sapDeclarationNumber,
    insuranceExpiresAt: profil.insuranceExpiresAt?.toISOString() ?? null,
    activation,
    etat: etatDuCompte({
      status: profil.status,
      suspensionOrigine: profil.suspensionOrigin,
      dossierSoumisLe: profil.dossierSubmittedAt,
      activation,
    }),
    pieces,
    peutSoumettre:
      profil.dossierSubmittedAt === null && peutSoumettreLeDossier(pieces),
    dossierSoumisLe: profil.dossierSubmittedAt?.toISOString() ?? null,
    suspensionMotif: profil.suspensionReason,
  };
}
