import "server-only";

import { prisma } from "@/lib/db";

/**
 * Ce qui attend quelqu'un, toutes organisations confondues.
 *
 * Un back-office n'est utile que s'il montre le travail à faire, pas des
 * indicateurs. D'où quatre listes, chacune correspondant à une situation où
 * l'absence d'intervention humaine se paie :
 *
 * - **Réservations sans intervenant** : un client attend quelqu'un que le
 *   moteur n'a pas su trouver. C'est l'état dans lequel un refus laisse une
 *   réservation quand plus personne n'est disponible, et rien ne le rattrape
 *   automatiquement.
 * - **Propositions en souffrance** : le délai de réponse est passé, la mission
 *   n'a été ni acceptée ni refusée. Sans reprise, elle se périme en silence.
 * - **Demandes de rappel non traitées** : le formulaire promet un rappel dans
 *   la journée.
 * - **Intervenants à vérifier** : SIRET, assurance et pièce d'identité
 *   conditionnent la première mission.
 *
 * La lecture traverse les organisations, ce que seul un administrateur
 * plateforme peut faire. Elle passe donc par le client non cloisonné, et
 * l'appelant doit avoir franchi `asPlatformAdmin()` — la vérification est
 * faite à l'entrée de la page, où elle se voit.
 */

export interface ReservationOrpheline {
  bookingId: string;
  organisation: string;
  debut: Date;
  commune: string;
  montantCents: number;
  clientEmail: string;
}

export interface PropositionPerimee {
  assignmentId: string;
  organisation: string;
  intervenant: string;
  debut: Date;
  repondreAvant: Date | null;
}

export interface DemandeEnAttente {
  leadId: string;
  organisation: string;
  nom: string;
  telephone: string;
  commune: string | null;
  recueLe: Date;
}

export interface IntervenantAVerifier {
  cleanerProfileId: string;
  organisation: string;
  prenom: string;
  inscritLe: Date;
}

export interface TableauDeBord {
  reservationsOrphelines: ReservationOrpheline[];
  propositionsPerimees: PropositionPerimee[];
  demandesEnAttente: DemandeEnAttente[];
  intervenantsAVerifier: IntervenantAVerifier[];
}

export async function chargerTableauDeBord(
  maintenant: Date = new Date(),
): Promise<TableauDeBord> {
  const [orphelines, perimees, demandes, intervenants] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: "PENDING_ASSIGNMENT",
        scheduledStart: { gte: maintenant },
        /*
         * `PENDING_ASSIGNMENT` ne suffit pas à faire une réservation orpheline.
         * Depuis la diffusion par lots, c'est l'état **normal** d'une demande
         * proposée à cinq intervenants qui n'ont pas encore répondu : seule une
         * acceptation écrit `CONFIRMED`. La liste en comptait donc vingt-quatre
         * là où deux ou trois exigeaient vraiment quelqu'un — et une file de
         * travail qui ne diminue pas quand on travaille cesse d'être lue.
         *
         * Est orpheline la réservation dont **plus aucune proposition ne
         * court** : tout le monde a refusé, ou tout a expiré.
         */
        assignments: {
          none: { status: { in: ["PROPOSED", "ACCEPTED"] } },
        },
      },
      orderBy: { scheduledStart: "asc" },
      take: 50,
      select: {
        id: true,
        scheduledStart: true,
        grossAmountCents: true,
        organization: { select: { name: true } },
        address: { select: { cityName: true } },
        clientProfile: { select: { user: { select: { email: true } } } },
      },
    }),

    prisma.assignment.findMany({
      where: {
        status: "PROPOSED",
        respondBy: { lt: maintenant },
        startAt: { gte: maintenant },
      },
      orderBy: { respondBy: "asc" },
      take: 50,
      select: {
        id: true,
        startAt: true,
        respondBy: true,
        organization: { select: { name: true } },
        cleaner: { select: { displayName: true } },
      },
    }),

    prisma.lead.findMany({
      where: { status: "NEW" },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        name: true,
        phone: true,
        communeInsee: true,
        createdAt: true,
        organizationId: true,
      },
    }),

    prisma.cleanerProfile.findMany({
      where: { status: "PENDING_VERIFICATION" },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        displayName: true,
        createdAt: true,
        organization: { select: { name: true } },
      },
    }),
  ]);

  /*
   * Le nom de l'organisation d'une demande de rappel est résolu à part.
   * L'inclure dans la sélection paraissait plus direct, mais Prisma n'en
   * infère pas le type sur ce modèle : la seule façon de le faire compiler
   * était une assertion, c'est-à-dire renoncer à la vérification là où elle
   * sert. Une requête de plus sur une table de trois lignes coûte moins cher
   * qu'un type affirmé sans preuve.
   */
  const organisations = new Map(
    (
      await prisma.organization.findMany({ select: { id: true, name: true } })
    ).map((organisation) => [organisation.id, organisation.name]),
  );

  return {
    reservationsOrphelines: orphelines.map((booking) => ({
      bookingId: booking.id,
      organisation: booking.organization.name,
      debut: booking.scheduledStart,
      commune: booking.address.cityName,
      montantCents: booking.grossAmountCents,
      clientEmail: booking.clientProfile.user.email,
    })),
    propositionsPerimees: perimees.map((assignment) => ({
      assignmentId: assignment.id,
      organisation: assignment.organization.name,
      intervenant: assignment.cleaner.displayName,
      debut: assignment.startAt,
      repondreAvant: assignment.respondBy,
    })),
    demandesEnAttente: demandes.map((lead) => ({
      leadId: lead.id,
      organisation: organisations.get(lead.organizationId) ?? "—",
      nom: lead.name,
      telephone: lead.phone,
      commune: lead.communeInsee,
      recueLe: lead.createdAt,
    })),
    intervenantsAVerifier: intervenants.map((cleaner) => ({
      cleanerProfileId: cleaner.id,
      organisation: cleaner.organization.name,
      prenom: cleaner.displayName,
      inscritLe: cleaner.createdAt,
    })),
  };
}
