import "server-only";

import type { TenantClient } from "@/lib/db";

import type { Facture } from "./document";

/**
 * Lecture des factures, pour les écrans.
 *
 * **Tout vient de l'instantané**, jamais des sources vivantes : une facture est
 * immuable, et son identité d'émetteur, son adresse et son lieu d'exécution ont
 * été figés à l'émission. La relire depuis `site.ts` ou `Address` la ferait
 * changer au premier déménagement.
 */

export interface FactureVue {
  id: string;
  numero: string;
  type: string;
  emiseLe: string;
  totalCents: number;
  eligibleCreditImpotCents: number;
  emetteur: string;
  /** Vrai si le document figé est lisible ; faux pour les factures du seed. */
  imprimable: boolean;
}

function vueDe(ligne: {
  id: string;
  number: string;
  type: string;
  issuedAt: Date;
  totalCents: number;
  taxCreditEligibleCents: number;
  snapshot: unknown;
}): FactureVue {
  const document = ligne.snapshot as Facture | null;
  return {
    id: ligne.id,
    numero: ligne.number,
    type: ligne.type,
    emiseLe: ligne.issuedAt.toISOString(),
    totalCents: ligne.totalCents,
    eligibleCreditImpotCents: ligne.taxCreditEligibleCents,
    emetteur: document?.emetteur?.nom ?? "—",
    imprimable: Boolean(document?.numero),
  };
}

const SELECTION = {
  id: true,
  number: true,
  type: true,
  issuedAt: true,
  totalCents: true,
  taxCreditEligibleCents: true,
  snapshot: true,
} as const;

/** Les factures d'un client, la plus récente en tête. */
export async function facturesDuClient(
  db: TenantClient,
  clientProfileId: string,
): Promise<FactureVue[]> {
  const factures = await db.invoice.findMany({
    where: { booking: { clientProfileId } },
    orderBy: [{ issuedAt: "desc" }, { number: "desc" }],
    take: 200,
    select: SELECTION,
  });
  return factures.map(vueDe);
}

/**
 * Les factures qu'un intervenant a émises.
 *
 * Elles sont les siennes, même si Léo Clean les a établies pour son compte :
 * c'est son chiffre d'affaires, et c'est ce qu'il déclare.
 */
export async function facturesDeLIntervenant(
  db: TenantClient,
  cleanerProfileId: string,
): Promise<FactureVue[]> {
  const factures = await db.invoice.findMany({
    where: { issuedByCleanerProfileId: cleanerProfileId },
    orderBy: [{ issuedAt: "desc" }, { number: "desc" }],
    take: 200,
    select: SELECTION,
  });
  return factures.map(vueDe);
}

/**
 * Une facture, si elle appartient bien à qui la demande.
 *
 * L'appartenance se vérifie dans la requête et non après : une facture qui
 * n'est pas la sienne est **introuvable**, avec le même résultat que si elle
 * n'existait pas — confirmer un identifiant à un curieux lui apprend qu'il a
 * visé juste.
 */
export async function lireLaFacture(
  db: TenantClient,
  facture: { id: string; clientProfileId?: string; cleanerProfileId?: string },
): Promise<Facture | null> {
  const ligne = await db.invoice.findFirst({
    where: {
      id: facture.id,
      ...(facture.clientProfileId
        ? { booking: { clientProfileId: facture.clientProfileId } }
        : {}),
      ...(facture.cleanerProfileId
        ? { issuedByCleanerProfileId: facture.cleanerProfileId }
        : {}),
    },
    select: { snapshot: true },
  });

  const document = ligne?.snapshot as Facture | null;
  return document?.numero ? document : null;
}
