import "server-only";

import {
  type EtapeJournee,
  analyserInsertion,
  etapesDuJour,
  voieSansNumero,
} from "@/lib/assignments/planning";
import type {
  EtapeVue,
  MissionAcceptee,
  MissionProposee,
  MissionsIntervenant,
} from "@/lib/assignments/types";
import type { TenantClient } from "@/lib/db";
import { consignesLisibles, lireLesConsignes } from "@/lib/logement/consignes";
import { interventionGelee } from "@/lib/paiement/recouvrement";

/**
 * Chargement des missions d'un intervenant.
 *
 * Le client Prisma reçu est déjà cloisonné à l'organisation ; ce module y
 * ajoute la seule restriction qui compte ici : `cleanerProfileId`. Un
 * intervenant ne voit que ses propres affectations, ce que dit aussi sa seule
 * capacité de lecture, `assignment:read:own`.
 *
 * C'est ici que se fait le tri entre ce qui est visible avant et après
 * acceptation. Le faire à l'affichage laisserait l'adresse complète voyager
 * jusqu'au navigateur d'une personne qui n'a pas encore accepté la mission.
 */

/** Champs communs aux deux vues, tels que Prisma les rend. */
const SELECTION = {
  id: true,
  bookingId: true,
  startAt: true,
  endAt: true,
  blockStartAt: true,
  blockEndAt: true,
  travelMinutesBefore: true,
  travelMinutesAfter: true,
  respondBy: true,
  status: true,
  booking: {
    select: {
      durationMinutes: true,
      surfaceSqm: true,
      professionalAmountCents: true,
      clientNotes: true,
      address: {
        select: {
          street: true,
          postalCode: true,
          cityName: true,
          accessNotes: true,
          consignes: true,
        },
      },
      status: true,
      scheduledStart: true,
      clientProfile: {
        select: {
          recouvrementDepuis: true,
          user: { select: { name: true } },
        },
      },
    },
  },
} as const;

/**
 * Forme d'une ligne, décrite structurellement plutôt que castée.
 *
 * Prisma infère déjà le type exact de `findMany` : cette interface sert
 * seulement aux fonctions d'assemblage ci-dessous, et TypeScript vérifie que
 * le résultat de la requête lui est assignable. Une assertion aurait masqué un
 * champ retiré de la sélection.
 */
interface LigneAffectation {
  id: string;
  bookingId: string;
  startAt: Date;
  endAt: Date;
  blockStartAt: Date;
  blockEndAt: Date;
  travelMinutesBefore: number;
  travelMinutesAfter: number;
  respondBy: Date | null;
  status: string;
  booking: {
    durationMinutes: number;
    surfaceSqm: number | null;
    professionalAmountCents: number;
    clientNotes: string | null;
    address: {
      street: string;
      postalCode: string;
      cityName: string;
      accessNotes: string | null;
      consignes: unknown;
    };
    status: string;
    scheduledStart: Date;
    clientProfile: {
      recouvrementDepuis: Date | null;
      user: { name: string | null };
    };
  };
}

function versEtape(ligne: LigneAffectation): EtapeJournee {
  return {
    assignmentId: ligne.id,
    debut: ligne.startAt,
    fin: ligne.endAt,
    blocDebut: ligne.blockStartAt,
    blocFin: ligne.blockEndAt,
    trajetAvantMinutes: ligne.travelMinutesBefore,
    trajetApresMinutes: ligne.travelMinutesAfter,
    communeName: ligne.booking.address.cityName,
  };
}

function versEtapeVue(
  etape: EtapeJournee,
  estLaProposition: boolean,
): EtapeVue {
  return {
    assignmentId: etape.assignmentId,
    debut: etape.debut.toISOString(),
    fin: etape.fin.toISOString(),
    blocDebut: etape.blocDebut.toISOString(),
    blocFin: etape.blocFin.toISOString(),
    trajetAvantMinutes: etape.trajetAvantMinutes,
    trajetApresMinutes: etape.trajetApresMinutes,
    communeName: etape.communeName,
    estLaProposition,
  };
}

/** Prénom seul : on n'affiche jamais le nom complet d'un client. */
function prenomDe(nom: string | null): string | null {
  const parts = (nom ?? "").trim().split(/\s+/).filter(Boolean);
  return parts[0] ?? null;
}

export async function chargerMissions(
  db: TenantClient,
  cleanerProfileId: string,
  now: Date = new Date(),
): Promise<MissionsIntervenant> {
  /*
   * Une seule requête pour les deux listes : les propositions ont besoin des
   * missions acceptées du même jour pour situer leur insertion, et les
   * recharger séparément ferait deux allers-retours pour la même donnée.
   */
  const lignes = await db.assignment.findMany({
    where: {
      cleanerProfileId,
      status: { in: ["PROPOSED", "ACCEPTED"] },
      startAt: { gte: now },
    },
    orderBy: { startAt: "asc" },
    select: SELECTION,
  });

  const etapes = lignes.map(versEtape);

  const propositions: MissionProposee[] = [];
  const aVenir: MissionAcceptee[] = [];

  for (const ligne of lignes) {
    const commun = {
      assignmentId: ligne.id,
      bookingId: ligne.bookingId,
      debut: ligne.startAt.toISOString(),
      fin: ligne.endAt.toISOString(),
      dureeMinutes: ligne.booking.durationMinutes,
      communeName: ligne.booking.address.cityName,
      voie: voieSansNumero(ligne.booking.address.street),
      trajetAvantMinutes: ligne.travelMinutesBefore,
      trajetApresMinutes: ligne.travelMinutesAfter,
      remunerationCents: ligne.booking.professionalAmountCents,
      surfaceSqm: ligne.booking.surfaceSqm,
    };

    if (ligne.status === "PROPOSED") {
      const proposition = versEtape(ligne);
      const insertion = analyserInsertion(proposition, etapes);
      const journee = etapesDuJour(
        [...etapes.filter((e) => e.assignmentId !== ligne.id), proposition],
        proposition.debut,
      );

      propositions.push({
        ...commun,
        statut: "PROPOSED",
        repondreAvant: ligne.respondBy?.toISOString() ?? null,
        insertion: {
          estIsolee: insertion.estIsolee,
          estSerree: insertion.estSerree,
          chevauche: insertion.chevauche,
          battementAvantMinutes: insertion.battementAvantMinutes,
          battementApresMinutes: insertion.battementApresMinutes,
          tempsMortMinutes: insertion.tempsMortMinutes,
          journee: journee.map((etape) =>
            versEtapeVue(etape, etape.assignmentId === ligne.id),
          ),
        },
      });
      continue;
    }

    const adresse = ligne.booking.address;
    aVenir.push({
      ...commun,
      statut: "ACCEPTED",
      adresseComplete: `${adresse.street}, ${adresse.postalCode} ${adresse.cityName}`,
      accessNotes: adresse.accessNotes,
      clientNotes: ligne.booking.clientNotes,
      clientPrenom: prenomDe(ligne.booking.clientProfile.user.name),
      consignes: consignesLisibles(lireLesConsignes(adresse.consignes)),
      /*
       * Dérivé, jamais stocké. La règle vit dans `paiement/recouvrement.ts`,
       * qui est pur : le back-office compte les mêmes gels avec la même
       * fonction, si bien que les deux écrans ne peuvent pas se contredire.
       */
      gelee: interventionGelee(
        ligne.booking.clientProfile,
        { status: ligne.booking.status, debut: ligne.booking.scheduledStart },
        now,
      ),
    });
  }

  return { propositions, aVenir };
}
