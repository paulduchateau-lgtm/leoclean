import "server-only";

import { prisma } from "@/lib/db";

import {
  type ElementDeTravail,
  type FaitsExploitation,
  PIECE_ALERTE_JOURS,
  POINTAGE_TOLERANCE_MINUTES,
  composerLaFile,
  compter,
  enRetard,
} from "./file-actions";

/**
 * Le chargement des faits d'exploitation.
 *
 * `file-actions.ts` décide de la priorité et du motif ; ce module va chercher
 * les faits. La séparation permet de tester dix règles de priorité en quelques
 * millisecondes sans monter de base — et c'est ce qui rend les seuils
 * discutables, puisqu'ils sont écrits à un seul endroit.
 *
 * Lecture non cloisonnée, comme le reste du back-office : elle traverse les
 * organisations, ce que seul un administrateur plateforme peut faire, et
 * `asPlatformAdmin()` est vérifié à l'entrée de la page.
 */

export interface VueRadar {
  file: ElementDeTravail[];
  retards: ElementDeTravail[];
  compte: Record<"P0" | "P1" | "P2" | "P3", number>;
  journee: {
    total: number;
    terminees: number;
    enCours: number;
    aVenir: number;
    sansIntervenant: number;
    caCents: number;
  };
}

/**
 * La journée en cours, en une ligne.
 *
 * Ce n'est pas une métrique de vanité : chacun de ces nombres répond à « qu'est
 * -ce qui va casser aujourd'hui ». Le chiffre d'affaires y figure parce qu'il
 * dit l'ampleur de ce qui est en jeu, pas parce qu'il flatte.
 */
async function chargerLaJournee(maintenant: Date) {
  const debut = new Date(maintenant);
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(debut.getTime() + 86_400_000);

  const missions = await prisma.booking.findMany({
    where: { scheduledStart: { gte: debut, lt: fin } },
    select: { status: true, grossAmountCents: true },
  });

  return {
    total: missions.length,
    terminees: missions.filter((m) => m.status === "COMPLETED").length,
    enCours: missions.filter((m) => m.status === "IN_PROGRESS").length,
    aVenir: missions.filter((m) =>
      ["CONFIRMED", "ASSIGNED"].includes(m.status),
    ).length,
    sansIntervenant: missions.filter((m) => m.status === "PENDING_ASSIGNMENT")
      .length,
    caCents: missions
      .filter((m) => !m.status.startsWith("CANCELLED"))
      .reduce((somme, m) => somme + m.grossAmountCents, 0),
  };
}

async function chargerLesFaits(maintenant: Date): Promise<FaitsExploitation> {
  const limitePointage = new Date(
    maintenant.getTime() - POINTAGE_TOLERANCE_MINUTES * 60_000,
  );
  const limitePiece = new Date(
    maintenant.getTime() + PIECE_ALERTE_JOURS * 86_400_000,
  );

  const [
    orphelines,
    confirmees,
    propositions,
    rappels,
    dossiers,
    pieces,
    paiements,
    avis,
    ajustements,
    candidatures,
  ] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: "PENDING_ASSIGNMENT",
        scheduledStart: { gt: new Date(maintenant.getTime() - 86_400_000) },
      },
      select: {
        id: true,
        scheduledStart: true,
        address: { select: { cityName: true } },
      },
      take: 50,
    }),

    /*
     * Les missions dont l'heure est passée sans pointage d'arrivée. On charge
     * les confirmées de la journée puis on écarte celles qui ont pointé : une
     * jointure « absence de ligne » sur Prisma coûterait davantage à lire
     * qu'elle ne ferait gagner sur une table de cette taille.
     */
    prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        scheduledStart: {
          lt: limitePointage,
          gt: new Date(maintenant.getTime() - 12 * 3_600_000),
        },
      },
      select: {
        id: true,
        scheduledStart: true,
        checks: { select: { kind: true } },
        assignments: {
          where: { status: "ACCEPTED" },
          select: { cleaner: { select: { displayName: true } } },
        },
      },
      take: 50,
    }),

    prisma.assignment.findMany({
      where: { status: "PROPOSED", respondBy: { lt: maintenant } },
      select: {
        id: true,
        respondBy: true,
        cleaner: { select: { displayName: true } },
      },
      take: 50,
    }),

    prisma.lead.findMany({
      where: { status: "NEW" },
      select: { id: true, createdAt: true, name: true },
      take: 50,
    }),

    prisma.proApplication.findMany({
      where: { status: "PIECES_DEPOSEES" },
      select: { id: true, lastActivityAt: true, firstName: true },
      take: 50,
    }),

    prisma.cleanerDocument.findMany({
      where: { expiresAt: { lt: limitePiece, not: null } },
      select: {
        id: true,
        expiresAt: true,
        type: true,
        cleaner: { select: { displayName: true } },
      },
      take: 50,
    }),

    prisma.payment.findMany({
      where: { status: "FAILED" },
      select: { id: true, updatedAt: true },
      take: 50,
    }),

    prisma.review.findMany({
      where: { rating: { lte: 3 } },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, rating: true },
      take: 20,
    }),

    prisma.missionAnomaly.findMany({
      where: { adjustmentStatus: "PENDING" },
      select: { id: true, createdAt: true, proposedExtraMinutes: true },
      take: 50,
    }),

    prisma.proApplication.findMany({
      where: {
        status: { in: ["COMMENCE", "ATTENTE_SIRET", "PIECES_INCOMPLETES"] },
        lastActivityAt: { lt: new Date(maintenant.getTime() - 14 * 86_400_000) },
      },
      select: { id: true, lastActivityAt: true, firstName: true },
      take: 50,
    }),
  ]);

  return {
    missionsOrphelines: orphelines.map((mission) => ({
      id: mission.id,
      debut: mission.scheduledStart,
      commune: mission.address.cityName,
    })),

    pointagesManquants: confirmees
      .filter((mission) => !mission.checks.some((c) => c.kind === "ARRIVEE"))
      .map((mission) => ({
        id: mission.id,
        debut: mission.scheduledStart,
        intervenant:
          mission.assignments[0]?.cleaner.displayName ?? "Personne affectée",
      })),

    propositionsPerimees: propositions.map((proposition) => ({
      id: proposition.id,
      depuis: proposition.respondBy ?? maintenant,
      intervenant: proposition.cleaner.displayName,
    })),

    rappelsNonTraites: rappels.map((rappel) => ({
      id: rappel.id,
      recuLe: rappel.createdAt,
      nom: rappel.name,
    })),

    dossiersAExaminer: dossiers.map((dossier) => ({
      id: dossier.id,
      depuis: dossier.lastActivityAt,
      nom: dossier.firstName ?? "Candidat",
    })),

    piecesExpirant: pieces.map((piece) => ({
      id: piece.id,
      expireLe: piece.expiresAt!,
      intervenant: piece.cleaner.displayName,
      piece: piece.type,
    })),

    paiementsEchoues: paiements.map((paiement) => ({
      id: paiement.id,
      depuis: paiement.updatedAt,
      /*
       * Le compteur de tentatives n'existe pas encore en base : on prend une
       * seule tentative plutôt que d'inventer un chiffre. Mieux vaut une
       * priorité prudente qu'une escalade fondée sur rien.
       */
      tentatives: 1,
    })),

    notesBasses: avis.map((avis) => ({
      id: avis.id,
      recuLe: avis.createdAt,
      etoiles: avis.rating,
    })),

    ajustementsAArbitrer: ajustements.map((anomalie) => ({
      id: anomalie.id,
      depuis: anomalie.createdAt,
      minutes: anomalie.proposedExtraMinutes ?? 0,
    })),

    candidaturesSansNouvelle: candidatures.map((candidature) => ({
      id: candidature.id,
      depuis: candidature.lastActivityAt,
      nom: candidature.firstName ?? "Candidat",
    })),
  };
}

export async function chargerLeRadar(
  maintenant: Date = new Date(),
): Promise<VueRadar> {
  const [faits, journee] = await Promise.all([
    chargerLesFaits(maintenant),
    chargerLaJournee(maintenant),
  ]);

  const file = composerLaFile(faits, maintenant);

  return {
    file,
    retards: enRetard(file, maintenant),
    compte: compter(file),
    journee,
  };
}
