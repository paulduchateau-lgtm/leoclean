import "server-only";

import type { TenantClient } from "@/lib/db";

import { generateReferralCode } from "./code";
import { REFERRAL_PROGRAMS, type ReferrerKind } from "./rules";

/**
 * Le parrainage, côté personne qui parraine.
 *
 * `rules.ts` décide, `code.ts` engendre, ce module lit et écrit. Il ne calcule
 * aucune récompense : les montants affichés viennent de ce qui est déjà en base
 * (`ReferralReward`), jamais d'un recalcul à l'affichage — deux calculs
 * indépendants finiraient par annoncer autre chose que ce qui se verse.
 */

export interface Filleul {
  prenom: string | null;
  statut: string;
  prestationsTerminees: number;
  qualifieLe: string | null;
  expireLe: string;
  gagneCents: number;
}

export interface VueParrainage {
  code: string;
  kind: ReferrerKind;
  filleuls: Filleul[];
  /** Ce qui est acquis mais pas encore versé. */
  enAttenteCents: number;
  /** Ce qui a déjà été versé ou crédité. */
  verseCents: number;
}

/**
 * Le code de quelqu'un, créé au premier affichage s'il n'en a pas.
 *
 * Créer le code à la demande plutôt qu'à l'inscription évite d'engendrer des
 * dizaines de milliers de codes que personne ne partagera jamais. La collision
 * est rattrapée en réessayant : l'unicité est tenue par la contrainte en base,
 * pas par le générateur.
 */
export async function codeDeParrainage(
  db: TenantClient,
  organizationId: string,
  ownerUserId: string,
  kind: ReferrerKind,
  prefix?: string,
): Promise<string> {
  const existant = await db.referralCode.findFirst({
    where: { ownerUserId, kind },
    select: { code: true },
  });
  if (existant) return existant.code;

  for (let essai = 0; essai < 5; essai += 1) {
    const code = generateReferralCode({ prefix });
    try {
      const cree = await db.referralCode.create({
        data: { organizationId, ownerUserId, kind, code },
        select: { code: true },
      });
      return cree.code;
    } catch (error) {
      /*
       * Deux contraintes distinctes se présentent de la même façon : le code
       * déjà pris, qu'on rattrape en réessayant, et le couple
       * (organisation, propriétaire, nature) déjà créé par une requête
       * concurrente — auquel cas le code de l'autre requête fait foi.
       */
      const deja = await db.referralCode.findFirst({
        where: { ownerUserId, kind },
        select: { code: true },
      });
      if (deja) return deja.code;
      if (essai === 4) throw error;
    }
  }

  /* Inatteignable : la boucle rend ou relance. */
  throw new Error("Impossible d'engendrer un code de parrainage.");
}

export async function lireLeParrainage(
  db: TenantClient,
  organizationId: string,
  ownerUserId: string,
  kind: ReferrerKind,
  prefix?: string,
): Promise<VueParrainage> {
  const code = await codeDeParrainage(
    db,
    organizationId,
    ownerUserId,
    kind,
    prefix,
  );

  const parrainages = await db.referral.findMany({
    where: { referralCode: { ownerUserId, kind } },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      completedBookings: true,
      qualifiedAt: true,
      expiresAt: true,
      referee: { select: { name: true } },
      rewards: { select: { amountCents: true, paidAt: true } },
    },
  });

  let enAttenteCents = 0;
  let verseCents = 0;

  const filleuls = parrainages.map((parrainage) => {
    let gagneCents = 0;
    for (const recompense of parrainage.rewards) {
      gagneCents += recompense.amountCents;
      if (recompense.paidAt) verseCents += recompense.amountCents;
      else enAttenteCents += recompense.amountCents;
    }

    return {
      /*
       * Le prénom seul. Un parrain n'a pas à connaître le nom complet de son
       * filleul du fait de l'avoir parrainé : il l'a déjà s'il le connaît, et
       * le lui apprendre serait une divulgation que le filleul n'a pas
       * consentie.
       */
      prenom: parrainage.referee.name?.split(" ")[0] ?? null,
      statut: parrainage.status,
      prestationsTerminees: parrainage.completedBookings,
      qualifieLe: parrainage.qualifiedAt?.toISOString() ?? null,
      expireLe: parrainage.expiresAt.toISOString(),
      gagneCents,
    };
  });

  return {
    code,
    kind,
    filleuls,
    enAttenteCents,
    verseCents,
  };
}

/** Le programme applicable, pour l'affichage des règles. */
export function programme(kind: ReferrerKind) {
  return REFERRAL_PROGRAMS[kind];
}
