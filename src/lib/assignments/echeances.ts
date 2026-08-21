import "server-only";

import {
  type EtatDiffusion,
  echeanceDuLot,
  prochaineEtape,
} from "@/lib/assignments/diffusion";
import { classerCandidats } from "@/lib/assignments/reattribution";
import { forOrganization, prisma } from "@/lib/db";
import {
  annoncerLArretDeLaRecherche,
  annoncerLElargissement,
  annoncerLesAlternatives,
  rappelerLaVeille,
} from "@/lib/notifications/evenements";
import { purger } from "@/lib/securite/limitation";

/**
 * Ce qui arrive à une demande quand personne ne fait rien.
 *
 * Sans ce module, les quatre minuteries de `diffusion.ts` ne sont que des
 * fonctions pures que personne n'appelle : un lot expire en silence, une
 * demande reste diffusée à cinq personnes qui n'ont pas répondu, et le client
 * attend une semaine sans nouvelle. C'est l'écart le plus coûteux du produit,
 * parce qu'il ne se voit dans aucun écran — tout paraît normal jusqu'au jour du
 * ménage.
 *
 * **La décision n'est pas prise ici.** `prochaineEtape` la rend, à partir d'un
 * état et d'un instant ; ce module lit la base, exécute ce qui a été décidé, et
 * écrit. La règle reste testable à la milliseconde sans base, et l'exécution
 * reste vérifiable sans rejouer une semaine.
 *
 * **Il traverse les organisations**, comme le tableau de bord d'administration
 * et pour la même raison : une échéance ne connaît pas de frontière de client.
 * Il passe donc par le client non cloisonné, et n'est atteignable que par le
 * chemin explicite qui l'appelle — jamais depuis une action d'utilisateur.
 *
 * **Chaque demande est traitée séparément.** Une erreur sur l'une ne doit pas
 * empêcher les autres d'avancer : un ordonnanceur qui s'arrête au premier
 * incident laisse s'accumuler exactement le silence qu'il est censé rompre.
 */

export interface RapportEcheances {
  /** Demandes élargies à tout le secteur. */
  lotsElargis: number;
  /** Demandes dont les horaires alternatifs attendent la décision du client. */
  alternativesSoumises: number;
  /** Demandes pour lesquelles on cesse de chercher, une semaine passée. */
  recherchesAbandonnees: number;
  /** Propositions de mission périmées faute de réponse. */
  propositionsPerimees: number;
  /** Contre-propositions périmées faute de réponse du client. */
  contrePropositionsPerimees: number;
  /** Compteurs de limitation de débit purgés. */
  compteursPurges: number;
  /** Rappels de la veille envoyés au client et à l'intervenant. */
  rappelsEnvoyes: number;
  /** Demandes dont le traitement a échoué, à reprendre au tour suivant. */
  echecs: number;
}

export async function traiterLesEcheances(
  maintenant: Date = new Date(),
): Promise<RapportEcheances> {
  const rapport: RapportEcheances = {
    lotsElargis: 0,
    alternativesSoumises: 0,
    recherchesAbandonnees: 0,
    propositionsPerimees: 0,
    contrePropositionsPerimees: 0,
    compteursPurges: 0,
    rappelsEnvoyes: 0,
    echecs: 0,
  };

  /*
   * L'ordre compte. On périme d'abord les réponses non données, puis on décide
   * du sort des demandes : une proposition encore ouverte au moment où l'on
   * élargit resterait acceptable après coup, et deux personnes se
   * retrouveraient à répondre à des lots différents de la même mission.
   */
  rapport.propositionsPerimees = await perimerLesPropositions(maintenant);
  rapport.contrePropositionsPerimees =
    await perimerLesContrePropositions(maintenant);

  const demandes = await prisma.booking.findMany({
    where: {
      status: "PENDING_ASSIGNMENT",
      diffusionDeadlineAt: { not: null, lte: maintenant },
    },
    select: {
      id: true,
      organizationId: true,
      createdAt: true,
      diffusionLot: true,
      diffusionLotSentAt: true,
    },
    // Les plus anciennes d'abord : celles dont le client attend depuis le plus
    // longtemps.
    orderBy: { diffusionDeadlineAt: "asc" },
    take: 200,
  });

  for (const demande of demandes) {
    try {
      const etape = prochaineEtape(await etatDe(demande), maintenant);

      switch (etape.type) {
        case "diffuser": {
          const nouveaux = await elargirAuSecteur(demande, maintenant);
          rapport.lotsElargis += 1;
          await annoncerLElargissement(
            forOrganization(demande.organizationId),
            demande.id,
            nouveaux,
          );
          break;
        }
        case "soumettre-alternatives": {
          const db = forOrganization(demande.organizationId);
          await rendreLaMainAuClient(demande);
          rapport.alternativesSoumises += 1;
          await annoncerLesAlternatives(
            db,
            demande.id,
            await db.slotProposal.count({
              where: { bookingId: demande.id, status: "PENDING" },
            }),
          );
          break;
        }
        case "cesser-la-recherche": {
          const db = forOrganization(demande.organizationId);
          await cesserDeChercher(demande);
          rapport.recherchesAbandonnees += 1;
          await annoncerLArretDeLaRecherche(
            db,
            demande.id,
            await db.slotProposal.count({
              where: { bookingId: demande.id, status: "PENDING" },
            }),
          );
          break;
        }
        case "attendre":
          // L'échéance a été repoussée entre la lecture et le traitement.
          break;
      }
    } catch (error) {
      rapport.echecs += 1;
      console.error(
        `Échéance non traitée pour la réservation ${demande.id}`,
        error,
      );
    }
  }

  rapport.rappelsEnvoyes = await rappelerLesInterventionsDeDemain(maintenant);
  rapport.compteursPurges = await purger(maintenant);
  return rapport;
}

type Demande = {
  id: string;
  organizationId: string;
  createdAt: Date;
  diffusionLot: number;
  diffusionLotSentAt: Date | null;
};

async function etatDe(demande: Demande): Promise<EtatDiffusion> {
  const contrePropositionsVivantes = await prisma.slotProposal.count({
    where: { bookingId: demande.id, status: "PENDING" },
  });

  return {
    demandeeA: demande.createdAt,
    lotEnCours: demande.diffusionLot === 2 ? 2 : 1,
    // Une demande d'avant la diffusion par lots n'a pas d'instant d'émission :
    // sa création en tient lieu, ce qui la rend échue tout de suite plutôt que
    // jamais.
    lotEmisA: demande.diffusionLotSentAt ?? demande.createdAt,
    contrePropositionsVivantes,
  };
}

/**
 * Élargit la mission à tous les intervenants du secteur qui n'ont pas déjà été
 * sollicités.
 *
 * Le classement est celui du moteur, pas une liste de proximité : c'est la même
 * fonction que la création emploie, pour que les deux lots soient composés
 * selon les mêmes règles.
 */
async function elargirAuSecteur(
  demande: Demande,
  maintenant: Date,
): Promise<string[]> {
  const db = forOrganization(demande.organizationId);

  const dejaSollicites = await db.assignment.findMany({
    where: { bookingId: demande.id },
    select: { cleanerProfileId: true },
  });

  const { booking, candidats } = await classerCandidats(db, {
    bookingId: demande.id,
    exclureCleanerProfileIds: dejaSollicites.map((a) => a.cleanerProfileId),
    now: maintenant,
  });

  const echeance = echeanceDuLot(2, maintenant, demande.createdAt);

  await db.$transaction(async (tx) => {
    if (candidats.length > 0) {
      await tx.assignment.createMany({
        data: candidats.map((candidat) => ({
          organizationId: demande.organizationId,
          bookingId: demande.id,
          cleanerProfileId: candidat.cleanerProfileId,
          status: "PROPOSED" as const,
          lot: 2,
          startAt: booking.scheduledStart,
          endAt: booking.scheduledEnd,
          blockStartAt: new Date(
            booking.scheduledStart.getTime() -
              candidat.travelMinutesBefore * 60_000,
          ),
          blockEndAt: new Date(
            booking.scheduledEnd.getTime() +
              candidat.travelMinutesAfter * 60_000,
          ),
          travelMinutesBefore: candidat.travelMinutesBefore,
          travelMinutesAfter: candidat.travelMinutesAfter,
          score: candidat.score,
          scoreBreakdown: candidat.breakdown,
          proposedAt: maintenant,
          respondBy: new Date(
            Math.min(echeance.getTime(), booking.scheduledStart.getTime()),
          ),
        })),
      });
    }

    await tx.booking.update({
      where: { id: demande.id },
      data: {
        diffusionLot: 2,
        diffusionLotSentAt: maintenant,
        /*
         * L'échéance est posée même sans candidat. Le second lot vide n'est pas
         * une impasse : un intervenant peut déclarer des heures, ou retirer une
         * absence, d'ici la fin de la semaine. C'est la fin de recherche qui
         * clôt, pas l'absence de candidat à cet instant.
         */
        diffusionDeadlineAt: echeance,
      },
    });

    await tx.bookingStatusEvent.create({
      data: {
        organizationId: demande.organizationId,
        bookingId: demande.id,
        toStatus: "PENDING_ASSIGNMENT",
        reason:
          candidats.length > 0
            ? `Élargissement au secteur : ${candidats.length} intervenant${candidats.length > 1 ? "s" : ""} sollicité${candidats.length > 1 ? "s" : ""} (lot 2)`
            : "Élargissement au secteur : aucun intervenant supplémentaire disponible",
      },
    });
  });

  return candidats.map((candidat) => candidat.cleanerProfileId);
}

/**
 * Rend la main au client, qui tranchera entre un horaire alternatif et la
 * poursuite de la recherche.
 *
 * On retire l'échéance plutôt que de la repousser : rien n'est dû tant qu'il
 * n'a pas répondu, et une échéance laissée en place ferait repasser
 * l'ordonnanceur sur cette demande à chaque tour pour ne rien faire.
 */
async function rendreLaMainAuClient(demande: Demande): Promise<void> {
  const db = forOrganization(demande.organizationId);

  await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: demande.id },
      data: { diffusionDeadlineAt: null },
    });
    await tx.bookingStatusEvent.create({
      data: {
        organizationId: demande.organizationId,
        bookingId: demande.id,
        toStatus: "PENDING_ASSIGNMENT",
        reason:
          "Horaires alternatifs proposés : en attente de la décision du client",
      },
    });
  });
}

/**
 * Cesse de chercher, une semaine après la demande.
 *
 * **Cesser de chercher n'est pas clore.** La réservation reste en
 * `PENDING_ASSIGNMENT` — le back-office continue de la lister sous
 * « réservations sans intervenant », et c'est bien ce qu'on veut : quelqu'un
 * doit appeler ce client. Et les contre-propositions déjà reçues restent
 * acceptables jusqu'à leur propre échéance, quinze jours après leur émission.
 */
async function cesserDeChercher(demande: Demande): Promise<void> {
  const db = forOrganization(demande.organizationId);

  await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: demande.id },
      data: { diffusionDeadlineAt: null },
    });
    await tx.assignment.updateMany({
      where: { bookingId: demande.id, status: "PROPOSED" },
      data: { status: "EXPIRED" },
    });
    await tx.bookingStatusEvent.create({
      data: {
        organizationId: demande.organizationId,
        bookingId: demande.id,
        toStatus: "PENDING_ASSIGNMENT",
        reason:
          "Recherche interrompue après une semaine sans intervenant. Les horaires alternatifs restent acceptables.",
      },
    });
  });
}

/**
 * Périme les propositions de mission auxquelles personne n'a répondu.
 *
 * `AssignmentStatus.EXPIRED` n'était écrit par personne : une proposition se
 * périmait en silence, et n'apparaissait que dans la liste du back-office.
 */
async function perimerLesPropositions(maintenant: Date): Promise<number> {
  const { count } = await prisma.assignment.updateMany({
    where: {
      status: "PROPOSED",
      respondBy: { not: null, lte: maintenant },
    },
    data: { status: "EXPIRED", respondedAt: maintenant },
  });
  return count;
}

/** Périme les contre-propositions que le client n'a pas tranchées. */
async function perimerLesContrePropositions(maintenant: Date): Promise<number> {
  const { count } = await prisma.slotProposal.updateMany({
    where: {
      status: "PENDING",
      respondBy: { not: null, lte: maintenant },
    },
    data: { status: "EXPIRED", respondedAt: maintenant },
  });
  return count;
}

/**
 * Rappelle les interventions qui commencent dans les vingt-quatre heures.
 *
 * **Le marqueur est un évènement de statut, pas une colonne.** L'ordonnanceur
 * passe toutes les heures : sans trace, le même rappel partirait vingt-quatre
 * fois. `BookingStatusEvent` sert déjà de journal à la réservation, et y écrire
 * « rappel envoyé » évite une colonne dont personne n'aurait besoin ailleurs.
 *
 * La fenêtre est ouverte à gauche : une intervention déjà commencée n'a plus
 * besoin d'être rappelée.
 */
const RAPPEL_MARQUEUR = "Rappel de la veille envoyé";

async function rappelerLesInterventionsDeDemain(
  maintenant: Date,
): Promise<number> {
  const dansVingtQuatreHeures = new Date(maintenant.getTime() + 24 * 3_600_000);

  const interventions = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      scheduledStart: { gt: maintenant, lte: dansVingtQuatreHeures },
      statusEvents: { none: { reason: RAPPEL_MARQUEUR } },
    },
    select: { id: true, organizationId: true },
    take: 200,
  });

  let envoyes = 0;
  for (const intervention of interventions) {
    try {
      const db = forOrganization(intervention.organizationId);
      await rappelerLaVeille(db, intervention.id);
      await db.bookingStatusEvent.create({
        data: {
          organizationId: intervention.organizationId,
          bookingId: intervention.id,
          toStatus: "CONFIRMED",
          reason: RAPPEL_MARQUEUR,
        },
      });
      envoyes += 1;
    } catch (error) {
      console.error(`Rappel non envoyé pour ${intervention.id}`, error);
    }
  }

  return envoyes;
}
