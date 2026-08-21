import "server-only";

import { prisma } from "@/lib/db";
import {
  interventionGelee,
  joursEnRecouvrement,
} from "@/lib/paiement/recouvrement";

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

/**
 * Un client dont les interventions à venir sont gelées.
 *
 * C'est la seule des cinq listes où l'inaction se paie **des deux côtés** : le
 * client ne voit venir personne, et l'intervenant a une mission qu'il ne peut
 * pas honorer. D'où l'ancienneté en clair — c'est elle qui décide de l'ordre
 * d'appel — et le nombre d'interventions gelées, qui dit l'urgence bien mieux
 * que le montant dû.
 */
export interface ClientEnRecouvrement {
  clientProfileId: string;
  organisation: string;
  clientEmail: string;
  telephone: string | null;
  depuis: Date;
  jours: number;
  /** Interventions à venir que le gel retient. */
  interventionsGelees: number;
  montantDuCents: number;
}

export interface TableauDeBord {
  reservationsOrphelines: ReservationOrpheline[];
  propositionsPerimees: PropositionPerimee[];
  demandesEnAttente: DemandeEnAttente[];
  intervenantsAVerifier: IntervenantAVerifier[];
  clientsEnRecouvrement: ClientEnRecouvrement[];
}

export async function chargerTableauDeBord(
  maintenant: Date = new Date(),
): Promise<TableauDeBord> {
  const [orphelines, perimees, demandes, intervenants, recouvrements] =
    await Promise.all([
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

      /*
       * Du plus ancien au plus récent, comme la revue de dossier et pour la même
       * raison : traiter le plus récent d'abord laisse indéfiniment au fond de la
       * pile celui qui attend depuis trois semaines, et c'est celui-là qu'on
       * perd. `recouvrementDepuis` ne bouge pas tant que la situation dure —
       * cet ordre est donc celui de la dette, pas celui du dernier incident.
       */
      prisma.clientProfile.findMany({
        where: { recouvrementDepuis: { not: null } },
        orderBy: { recouvrementDepuis: "asc" },
        take: 50,
        select: {
          id: true,
          phone: true,
          recouvrementDepuis: true,
          organization: { select: { name: true } },
          user: { select: { email: true } },
          /*
           * Un paiement est rattaché à une réservation, jamais au client : les
           * deux grandeurs se lisent donc sur la même relation. Le `OR` la
           * restreint à ce qui sert — l'à-venir et l'impayé — plutôt que de
           * ramener tout l'historique d'un abonné.
           */
          bookings: {
            where: {
              OR: [
                {
                  scheduledStart: { gt: maintenant },
                  status: { in: ["ASSIGNED", "CONFIRMED"] },
                },
                {
                  payments: {
                    some: { status: "FAILED", firstFailedAt: { not: null } },
                  },
                },
              ],
            },
            select: {
              status: true,
              scheduledStart: true,
              payments: {
                where: { status: "FAILED", firstFailedAt: { not: null } },
                select: { amountCents: true },
              },
            },
          },
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
    clientsEnRecouvrement: recouvrements.map((client) => {
      const etat = { recouvrementDepuis: client.recouvrementDepuis };

      return {
        clientProfileId: client.id,
        organisation: client.organization.name,
        clientEmail: client.user.email,
        telephone: client.phone,
        // Le filtre de la requête garantit la non-nullité ; le typage l'ignore.
        depuis: client.recouvrementDepuis!,
        jours: joursEnRecouvrement(etat, maintenant)!,
        /*
         * Compté par la règle pure plutôt que par le filtre SQL : c'est elle
         * qui fait foi ailleurs — écran intervenant compris — et deux
         * comptages différents du même gel finiraient par se contredire.
         */
        interventionsGelees: client.bookings.filter((booking) =>
          interventionGelee(
            etat,
            { status: booking.status, debut: booking.scheduledStart },
            maintenant,
          ),
        ).length,
        montantDuCents: client.bookings.reduce(
          (total: number, booking) =>
            total +
            booking.payments.reduce(
              (somme: number, paiement) => somme + paiement.amountCents,
              0,
            ),
          0,
        ),
      };
    }),
  };
}
