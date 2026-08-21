import "server-only";

import type { TenantClient } from "@/lib/db";
import { afterTaxCreditCents, canShowTaxCredit } from "@/lib/fiscal";
import { instantDePrelevement } from "@/lib/paiement/calendrier";
import { SITE } from "@/lib/site";

import { type Intervention } from "./messages";
import { lienEspace, notifier, notifierPlusieurs } from "./envoi";

/**
 * Les moments où le produit prend la parole.
 *
 * Un seul endroit charge ce qu'il faut pour écrire : le message a besoin d'un
 * prénom, d'une heure locale, d'une adresse et d'un montant, et les aller
 * chercher au fil des appelants aurait multiplié les requêtes et les oublis.
 *
 * Chaque fonction est appelée **après** l'écriture qu'elle annonce, hors
 * transaction, et sans être attendue.
 */

/** Le jour seul : une date de prélèvement n'a pas d'heure qui vaille. */
const JOUR = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

const JOUR_HEURE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const SELECTION = {
  id: true,
  scheduledStart: true,
  durationMinutes: true,
  grossAmountCents: true,
  professionalAmountCents: true,
  address: { select: { street: true, cityName: true } },
  clientProfile: { select: { user: { select: { email: true, name: true } } } },
} as const;

type Reservation = {
  scheduledStart: Date;
  durationMinutes: number;
  grossAmountCents: number;
  professionalAmountCents: number;
  address: { street: string; cityName: string };
  clientProfile: { user: { email: string; name: string | null } };
};

/** Prénom tel qu'on l'écrit dans un email, ou une formule neutre. */
function prenomDe(nom: string | null): string {
  const premier = nom?.trim().split(/\s+/)[0];
  return premier && premier.length > 1 ? premier : "";
}

function interventionDe(booking: Reservation): Intervention {
  return {
    quand: JOUR_HEURE.format(booking.scheduledStart),
    durationMinutes: booking.durationMinutes,
    adresse: `${booking.address.street}, ${booking.address.cityName}`,
    grossAmountCents: booking.grossAmountCents,
  };
}

/**
 * Une annonce ne rejette jamais.
 *
 * Le dépôt promet qu'« une notification qui échoue ne défait pas ce qu'elle
 * annonce », et les appelants écrivent `void annoncerLaDiffusion(...)`. Mais
 * **`void` n'attrape rien** : il signale au typage qu'on abandonne la promesse,
 * pas à l'exécution qu'on en gère l'échec. Une annonce qui lève produisait donc
 * un rejet non géré — que Node traite par défaut en terminant le processus,
 * c'est-à-dire en faisant échouer une requête sans rapport, ou en tuant
 * l'instance sans serveur qui la servait.
 *
 * Le filet est posé ici, une fois, plutôt qu'à chaque appel : un nouvel
 * appelant ne peut pas l'oublier. Il journalise, parce qu'une notification
 * perdue en silence est une notification qu'on ne saura jamais avoir perdue.
 */
function sansRejet<TArgs extends unknown[]>(
  nom: string,
  annonce: (...args: TArgs) => Promise<void>,
): (...args: TArgs) => Promise<void> {
  return async (...args: TArgs) => {
    try {
      await annonce(...args);
    } catch (erreur) {
      console.error(`Notification « ${nom} » non envoyée`, erreur);
    }
  };
}

async function lire(db: TenantClient, bookingId: string) {
  return db.booking.findUnique({
    where: { id: bookingId },
    select: SELECTION,
  });
}

/** Le client vient de déposer sa demande ; le lot vient d'être sollicité. */
async function annoncerLaDiffusionBrut(
  db: TenantClient,
  bookingId: string,
  cleanerProfileIds: readonly string[],
): Promise<void> {
  const booking = await lire(db, bookingId);
  if (!booking) return;

  const intervention = interventionDe(booking);
  const prenom = prenomDe(booking.clientProfile.user.name);

  await notifier(booking.clientProfile.user.email, {
    type: "demande-recue",
    prenom,
    intervention,
  });

  const intervenants = await db.cleanerProfile.findMany({
    where: { id: { in: [...cleanerProfileIds] } },
    select: { displayName: true, user: { select: { email: true } } },
  });

  await notifierPlusieurs(
    intervenants.map((intervenant) => ({
      destinataire: intervenant.user.email,
      evenement: {
        type: "mission-proposee" as const,
        prenom: intervenant.displayName,
        intervention,
        remunerationCents: booking.professionalAmountCents,
        lienEspace: lienEspace("/intervenant"),
      },
    })),
  );
}

/**
 * Quelqu'un a accepté : on confirme au client, et on le dit aux autres.
 *
 * Les deux messages partent ensemble parce qu'ils décrivent le même
 * évènement. Ne prévenir que le client laisserait quatre personnes croire
 * qu'une mission les attend encore.
 */
async function annoncerLAcceptationBrut(
  db: TenantClient,
  bookingId: string,
  gagnantId: string,
  perdantsIds: readonly string[],
): Promise<void> {
  const booking = await lire(db, bookingId);
  if (!booking) return;

  const intervention = interventionDe(booking);

  const gagnant = await db.cleanerProfile.findUnique({
    where: { id: gagnantId },
    select: { displayName: true },
  });

  await notifier(booking.clientProfile.user.email, {
    type: "intervenant-trouve",
    prenom: prenomDe(booking.clientProfile.user.name),
    intervenant: gagnant?.displayName ?? "Votre intervenant",
    intervention,
  });

  if (perdantsIds.length === 0) return;

  const perdants = await db.cleanerProfile.findMany({
    where: { id: { in: [...perdantsIds] } },
    select: { displayName: true, user: { select: { email: true } } },
  });

  await notifierPlusieurs(
    perdants.map((perdant) => ({
      destinataire: perdant.user.email,
      evenement: {
        type: "mission-prise" as const,
        prenom: perdant.displayName,
        intervention,
      },
    })),
  );
}

/** Le premier lot n'a rien donné : on élargit, et on le dit. */
async function annoncerLElargissementBrut(
  db: TenantClient,
  bookingId: string,
  nouveauxIds: readonly string[],
): Promise<void> {
  const booking = await lire(db, bookingId);
  if (!booking) return;

  const intervention = interventionDe(booking);

  await notifier(booking.clientProfile.user.email, {
    type: "recherche-elargie",
    prenom: prenomDe(booking.clientProfile.user.name),
    intervention,
  });

  if (nouveauxIds.length === 0) return;

  const intervenants = await db.cleanerProfile.findMany({
    where: { id: { in: [...nouveauxIds] } },
    select: { displayName: true, user: { select: { email: true } } },
  });

  await notifierPlusieurs(
    intervenants.map((intervenant) => ({
      destinataire: intervenant.user.email,
      evenement: {
        type: "mission-proposee" as const,
        prenom: intervenant.displayName,
        intervention,
        remunerationCents: booking.professionalAmountCents,
        lienEspace: lienEspace("/intervenant"),
      },
    })),
  );
}

/** Des horaires alternatifs attendent la décision du client. */
async function annoncerLesAlternativesBrut(
  db: TenantClient,
  bookingId: string,
  nombre: number,
): Promise<void> {
  const booking = await lire(db, bookingId);
  if (!booking) return;

  await notifier(booking.clientProfile.user.email, {
    type: "alternatives-disponibles",
    prenom: prenomDe(booking.clientProfile.user.name),
    nombre,
    lienEspace: lienEspace("/mon-espace"),
  });
}

/** Une semaine sans intervenant : on cesse de chercher, et on le dit. */
async function annoncerLArretDeLaRechercheBrut(
  db: TenantClient,
  bookingId: string,
  alternatives: number,
): Promise<void> {
  const booking = await lire(db, bookingId);
  if (!booking) return;

  await notifier(booking.clientProfile.user.email, {
    type: "recherche-interrompue",
    prenom: prenomDe(booking.clientProfile.user.name),
    telephone: SITE.phone,
    alternatives,
    lienEspace: lienEspace("/mon-espace"),
  });
}

/** La veille, aux deux : c'est demain. */
async function rappelerLaVeilleBrut(
  db: TenantClient,
  bookingId: string,
): Promise<void> {
  const booking = await lire(db, bookingId);
  if (!booking) return;

  const intervention = interventionDe(booking);

  await notifier(booking.clientProfile.user.email, {
    type: "rappel-veille",
    pour: "client",
    prenom: prenomDe(booking.clientProfile.user.name),
    intervention,
  });

  const acceptee = await db.assignment.findFirst({
    where: { bookingId, status: "ACCEPTED" },
    select: {
      cleaner: {
        select: { displayName: true, user: { select: { email: true } } },
      },
    },
  });

  if (!acceptee) return;

  await notifier(acceptee.cleaner.user.email, {
    type: "rappel-veille",
    pour: "intervenant",
    prenom: acceptee.cleaner.displayName,
    intervention,
  });
}

/*
 * Les annonces exposées sont les mêmes, sous filet. Aucune ne rejette, quelle
 * que soit la raison : donnée disparue entre l'écriture et l'envoi, service de
 * messagerie en panne, gabarit fautif.
 */
export const annoncerLaDiffusion = sansRejet(
  "annoncerLaDiffusion",
  annoncerLaDiffusionBrut,
);
export const annoncerLAcceptation = sansRejet(
  "annoncerLAcceptation",
  annoncerLAcceptationBrut,
);
export const annoncerLElargissement = sansRejet(
  "annoncerLElargissement",
  annoncerLElargissementBrut,
);
export const annoncerLesAlternatives = sansRejet(
  "annoncerLesAlternatives",
  annoncerLesAlternativesBrut,
);
export const annoncerLArretDeLaRecherche = sansRejet(
  "annoncerLArretDeLaRecherche",
  annoncerLArretDeLaRechercheBrut,
);
export const rappelerLaVeille = sansRejet(
  "rappelerLaVeille",
  rappelerLaVeilleBrut,
);

/**
 * Au client, dès que l'intervention est close — et **avant le prélèvement**.
 *
 * C'était le trou le plus visible de la chaîne : le ménage se terminait et le
 * client n'entendait plus rien jusqu'au débit. Le rapport photo, la notation et
 * les factures existaient tous, sans que rien ne les annonce.
 *
 * L'ordre est décidé : le débit part à H+24, le message part à la clôture, donc
 * il écrit « nous prélèverons ». `instantDePrelevement` calcule la date plutôt
 * que la page ne l'écrive — allonger le délai dans le calendrier changerait
 * alors le mail tout seul, au lieu de le laisser mentir.
 *
 * Le crédit d'impôt n'est calculé que si `canShowTaxCredit()` l'autorise. Le
 * montant existe toujours en base — le dépôt calcule et stocke en toutes
 * circonstances — mais il n'entre pas dans le message tant que la déclaration
 * SAP n'est pas obtenue.
 */
async function annoncerLaFinDInterventionBrut(
  db: TenantClient,
  bookingId: string,
): Promise<void> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      ...SELECTION,
      scheduledEnd: true,
      actualMinutes: true,
      completedAt: true,
      clientProfileId: true,
      _count: { select: { photos: true } },
    },
  });
  if (!booking) return;

  /*
   * Le prochain passage n'est annoncé que s'il est réellement pris : une
   * réservation confirmée, dans le futur. Annoncer « prochain passage prévu »
   * sur la foi d'un abonnement dont l'occurrence n'est pas encore engendrée
   * ferait attendre quelqu'un un jour où personne ne vient.
   */
  const suivante = await db.booking.findFirst({
    where: {
      clientProfileId: booking.clientProfileId,
      status: { in: ["ASSIGNED", "CONFIRMED"] },
      scheduledStart: { gt: booking.scheduledStart },
    },
    orderBy: { scheduledStart: "asc" },
    select: { scheduledStart: true },
  });

  const finReelle = booking.completedAt ?? booking.scheduledEnd;

  await notifier(booking.clientProfile.user.email, {
    type: "intervention-terminee",
    prenom: prenomDe(booking.clientProfile.user.name),
    intervention: interventionDe(booking),
    dureeReelleMinutes: booking.actualMinutes ?? booking.durationMinutes,
    rapportDisponible: booking._count.photos > 0,
    prelevementLe: JOUR.format(instantDePrelevement(finReelle)),
    creditImpotCents: canShowTaxCredit()
      ? afterTaxCreditCents(booking.grossAmountCents)
      : null,
    prochaineIntervention:
      suivante === null ? null : JOUR_HEURE.format(suivante.scheduledStart),
    lienEspace: lienEspace("/mon-espace"),
    lienNotation: lienEspace(`/mon-espace/noter?booking=${bookingId}`),
  });
}

export const annoncerLaFinDIntervention = sansRejet(
  "fin d'intervention",
  annoncerLaFinDInterventionBrut,
);
