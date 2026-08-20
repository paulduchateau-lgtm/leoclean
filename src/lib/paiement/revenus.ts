import "server-only";

import type { TenantClient } from "@/lib/db";
import { parisDayKey } from "@/lib/time";

import { prochainReversement } from "./calendrier";

/**
 * Ce qu'un intervenant a gagné, et quand il le touche.
 *
 * **Aucun montant n'est calculé ici.** Chaque euro affiché vient de
 * `Booking.professionalAmountCents`, c'est-à-dire de la rémunération proposée
 * et acceptée avant la mission. Recalculer un pourcentage à l'affichage ferait
 * dire à l'écran autre chose que ce qui a été promis, et c'est exactement la
 * plainte qu'on entend sur les plateformes nationales.
 *
 * Trois états, et pas un de plus : **terminé et payé**, **terminé, en attente
 * du virement**, **à venir**. Une mission à venir n'est pas un revenu — elle
 * est affichée à part, comme une prévision, jamais additionnée au reste.
 */

export interface LigneRevenu {
  bookingId: string;
  quand: string;
  commune: string;
  dureeMinutes: number;
  montantCents: number;
  /** Jour de virement prévu ou effectif. */
  reverseLe: string | null;
  paye: boolean;
}

export interface Revenus {
  /** Ce qui est terminé et déjà viré. */
  payeCents: number;
  /** Ce qui est terminé et attend le prochain virement. */
  enAttenteCents: number;
  /** Ce qui est accepté mais pas encore fait. Une prévision, pas un revenu. */
  aVenirCents: number;
  /** Le prochain jour de virement, s'il y a quelque chose à virer. */
  prochainVirement: string | null;
  /**
   * Ce jour est déjà passé.
   *
   * Le cas n'est pas théorique : le reversement hebdomadaire n'est pas branché,
   * si bien qu'une mission terminée le mois dernier porte une date d'échéance
   * dépassée. L'écrire sous l'étiquette « prochain virement » présenterait un
   * retard comme une promesse — le drapeau existe pour que l'écran dise
   * l'inverse.
   */
  virementEnRetard: boolean;
  lignes: LigneRevenu[];
  /** Ce que chaque mois civil a rapporté, du plus récent au plus ancien. */
  parMois: { mois: string; montantCents: number }[];
}

export async function chargerLesRevenus(
  db: TenantClient,
  cleanerProfileId: string,
  maintenant: Date = new Date(),
  moisEnArriere = 6,
): Promise<Revenus> {
  const depuis = new Date(maintenant);
  depuis.setUTCMonth(depuis.getUTCMonth() - moisEnArriere);

  const [affectations, virements] = await Promise.all([
    db.assignment.findMany({
      where: {
        cleanerProfileId,
        status: { in: ["ACCEPTED", "COMPLETED"] },
        startAt: { gte: depuis },
      },
      orderBy: { startAt: "desc" },
      select: {
        bookingId: true,
        startAt: true,
        booking: {
          select: {
            status: true,
            durationMinutes: true,
            professionalAmountCents: true,
            address: { select: { cityName: true } },
          },
        },
      },
    }),
    db.payout.findMany({
      where: { cleanerProfileId, status: "PAID" },
      select: { periodStart: true, periodEnd: true, paidAt: true },
    }),
  ]);

  /*
   * Une mission est payée si un reversement effectué couvre son instant. On ne
   * rattache pas ligne à ligne : `Payout` porte une période, pas une liste de
   * missions, et inventer un rattachement plus fin que ce que la base tient
   * ferait afficher « payé » sur une mission que le virement n'incluait pas.
   */
  const estPayee = (instant: Date) =>
    virements.some(
      (virement) =>
        instant >= virement.periodStart && instant < virement.periodEnd,
    );

  let payeCents = 0;
  let enAttenteCents = 0;
  let aVenirCents = 0;
  let prochainVirement: Date | null = null;
  const parMois = new Map<string, number>();

  const lignes: LigneRevenu[] = affectations.map((affectation) => {
    const montant = affectation.booking.professionalAmountCents;
    const terminee = affectation.booking.status === "COMPLETED";
    const paye = terminee && estPayee(affectation.startAt);

    let reverseLe: Date | null = null;
    if (terminee && !paye) {
      reverseLe = prochainReversement(affectation.startAt);
      if (!prochainVirement || reverseLe < prochainVirement) {
        prochainVirement = reverseLe;
      }
    }

    if (paye) payeCents += montant;
    else if (terminee) enAttenteCents += montant;
    else aVenirCents += montant;

    if (terminee) {
      const mois = parisDayKey(affectation.startAt).slice(0, 7);
      parMois.set(mois, (parMois.get(mois) ?? 0) + montant);
    }

    return {
      bookingId: affectation.bookingId,
      quand: affectation.startAt.toISOString(),
      commune: affectation.booking.address.cityName,
      dureeMinutes: affectation.booking.durationMinutes,
      montantCents: montant,
      reverseLe: paye ? null : (reverseLe?.toISOString() ?? null),
      paye,
    };
  });

  return {
    payeCents,
    enAttenteCents,
    aVenirCents,
    prochainVirement:
      prochainVirement === null
        ? null
        : (prochainVirement as Date).toISOString(),
    virementEnRetard:
      prochainVirement !== null &&
      (prochainVirement as Date).getTime() < maintenant.getTime(),
    lignes,
    parMois: [...parMois.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([mois, montantCents]) => ({ mois, montantCents })),
  };
}
