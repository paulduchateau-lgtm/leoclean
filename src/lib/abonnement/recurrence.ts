import { parisDayMinuteToUtc, utcToParisWallClock } from "@/lib/time";

/**
 * Le calendrier d'un abonnement.
 *
 * Module **pur** : il projette une règle de récurrence sur des dates réelles,
 * sans base ni horloge implicite.
 *
 * Le tunnel vend un rythme depuis toujours — « toutes les deux semaines, le
 * mardi matin » — et `createBooking` n'écrivait aucun `Subscription`. Chaque
 * passage était donc une réservation isolée, et « le même intervenant chaque
 * semaine » tenait à ce que le client reprenne rendez-vous de lui-même.
 *
 * **Une occurrence se calcule en jours civils, jamais en millisecondes.**
 * Ajouter sept fois 24 heures à un mardi 9 h donne un mardi 8 h ou 10 h de
 * part et d'autre du changement d'heure : le rendez-vous glisserait deux fois
 * par an sans que personne ne l'ait décidé.
 */

export type Rythme = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

/** Nombre de semaines entre deux passages, pour les rythmes qui en ont. */
const SEMAINES: Record<Exclude<Rythme, "MONTHLY">, number> = {
  WEEKLY: 1,
  BIWEEKLY: 2,
};

/**
 * Horizon de génération, en jours.
 *
 * Vingt et un jours. Assez pour que le client voie venir et que le moteur
 * place les tournées ; pas assez pour immobiliser des mois de planning sur des
 * réservations que personne n'a confirmées. C'est aussi la limite au-delà de
 * laquelle une préautorisation bancaire n'aurait plus de sens.
 */
export const HORIZON_JOURS = 21;

export interface RegleRecurrence {
  rythme: Rythme;
  /** 1 = lundi … 7 = dimanche, ISO 8601. */
  jourSemaine: number;
  /** Heure de début, en minutes depuis minuit, heure française. */
  minuteDebut: number;
  /** Pour le mensuel : 1 à 4, ou -1 pour la dernière semaine du mois. */
  semaineDuMois?: number | null;
  /** Point de départ de la série. */
  ancrage: Date;
}

/** Composantes de calendrier d'un instant, en heure française. */
function jourCivil(instant: Date): { annee: number; mois: number; jour: number } {
  const mur = utcToParisWallClock(instant);
  return { annee: mur.year, mois: mur.month, jour: mur.day };
}

function versUtc(
  jour: { annee: number; mois: number; jour: number },
  minute: number,
): Date {
  return parisDayMinuteToUtc(
    { year: jour.annee, month: jour.mois, day: jour.jour },
    minute,
  );
}

function decaler(
  jour: { annee: number; mois: number; jour: number },
  jours: number,
): { annee: number; mois: number; jour: number } {
  const point = new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour + jours));
  return {
    annee: point.getUTCFullYear(),
    mois: point.getUTCMonth() + 1,
    jour: point.getUTCDate(),
  };
}

/** Jour ISO d'une date de calendrier : 1 = lundi … 7 = dimanche. */
function jourIso(jour: { annee: number; mois: number; jour: number }): number {
  const point = new Date(Date.UTC(jour.annee, jour.mois - 1, jour.jour));
  const iso = point.getUTCDay();
  return iso === 0 ? 7 : iso;
}

/**
 * Les prochaines occurrences d'un abonnement.
 *
 * Rend les instants UTC des débuts, dans l'ordre, jusqu'à l'horizon. Les
 * périodes de pause sont sautées : mettre en pause ne décale pas la série, elle
 * la troue — sans quoi trois semaines d'absence feraient basculer un client du
 * mardi au vendredi sans qu'il l'ait demandé.
 */
export function prochainesOccurrences(
  regle: RegleRecurrence,
  depuis: Date,
  horizonJours: number = HORIZON_JOURS,
  pause?: { debut: Date; fin: Date } | null,
): Date[] {
  const occurrences: Date[] = [];
  const limite = new Date(depuis.getTime() + horizonJours * 86_400_000);

  if (regle.rythme === "MONTHLY") {
    return occurrencesMensuelles(regle, depuis, limite, pause);
  }

  const pas = SEMAINES[regle.rythme];

  /*
   * On repart de l'ancrage et on avance de pas en pas plutôt que de calculer
   * une position depuis « maintenant » : c'est l'ancrage qui définit la parité
   * d'une série bimensuelle, et la recalculer ferait sauter une semaine sur
   * deux dès qu'on génère à un autre moment.
   */
  let courant = jourCivil(regle.ancrage);

  // Aligner l'ancrage sur le bon jour de semaine, sans jamais reculer.
  const ecart = (regle.jourSemaine - jourIso(courant) + 7) % 7;
  if (ecart > 0) courant = decaler(courant, ecart);

  let garde = 0;
  while (garde++ < 400) {
    const instant = versUtc(courant, regle.minuteDebut);
    if (instant.getTime() > limite.getTime()) break;

    if (instant.getTime() >= depuis.getTime() && !enPause(instant, pause)) {
      occurrences.push(instant);
    }
    courant = decaler(courant, pas * 7);
  }

  return occurrences;
}

function enPause(
  instant: Date,
  pause?: { debut: Date; fin: Date } | null,
): boolean {
  if (!pause) return false;
  return (
    instant.getTime() >= pause.debut.getTime() &&
    instant.getTime() < pause.fin.getTime()
  );
}

/**
 * Occurrences mensuelles : « le 2ᵉ mardi », ou « le dernier mardi ».
 *
 * On ne dit jamais « le 15 » : un ménage se cale sur un jour de semaine, pas
 * sur un quantième, et le 15 tombe un dimanche une fois sur sept.
 */
function occurrencesMensuelles(
  regle: RegleRecurrence,
  depuis: Date,
  limite: Date,
  pause?: { debut: Date; fin: Date } | null,
): Date[] {
  const occurrences: Date[] = [];
  const rang = regle.semaineDuMois ?? 1;
  const debut = jourCivil(depuis);

  for (let avance = 0; avance <= 2; avance += 1) {
    const mois = ((debut.mois - 1 + avance) % 12) + 1;
    const annee = debut.annee + Math.floor((debut.mois - 1 + avance) / 12);
    const jour = jourDuMois(annee, mois, regle.jourSemaine, rang);
    if (!jour) continue;

    const instant = versUtc({ annee, mois, jour }, regle.minuteDebut);
    if (instant.getTime() < depuis.getTime()) continue;
    if (instant.getTime() > limite.getTime()) break;
    if (enPause(instant, pause)) continue;

    occurrences.push(instant);
  }

  return occurrences;
}

/** Le n-ième jour de semaine d'un mois, ou le dernier si `rang` vaut -1. */
export function jourDuMois(
  annee: number,
  mois: number,
  jourSemaine: number,
  rang: number,
): number | null {
  const premier = jourIso({ annee, mois, jour: 1 });
  const premierCorrespondant = 1 + ((jourSemaine - premier + 7) % 7);
  const joursDuMois = new Date(Date.UTC(annee, mois, 0)).getUTCDate();

  if (rang === -1) {
    let dernier = premierCorrespondant;
    while (dernier + 7 <= joursDuMois) dernier += 7;
    return dernier;
  }

  const jour = premierCorrespondant + (rang - 1) * 7;
  return jour <= joursDuMois ? jour : null;
}

/**
 * Durée maximale d'une pause, en semaines.
 *
 * Huit semaines. La pause est le principal outil anti-résiliation, et elle doit
 * rester plus visible et plus simple que la résiliation. Au-delà de deux mois
 * en revanche, ce n'est plus une pause : l'intervenant a été réaffecté, et
 * laisser croire au client qu'il le retrouvera serait une promesse qu'on ne
 * tient pas.
 */
export const PAUSE_MAXIMALE_SEMAINES = 8;

export type RefusPause = "DUREE" | "PASSEE" | "ORDRE";

export const MESSAGES_PAUSE: Record<RefusPause, string> = {
  DUREE: `Une pause va jusqu'à ${PAUSE_MAXIMALE_SEMAINES} semaines. Au-delà, appelez-nous : mieux vaut résilier et reprendre plus tard.`,
  PASSEE: "Cette période est déjà passée.",
  ORDRE: "La date de fin doit venir après la date de début.",
};

export function verifierPause(
  pause: { debut: Date; fin: Date },
  maintenant: Date,
): RefusPause | null {
  if (pause.fin.getTime() <= pause.debut.getTime()) return "ORDRE";
  if (pause.fin.getTime() <= maintenant.getTime()) return "PASSEE";

  const semaines =
    (pause.fin.getTime() - pause.debut.getTime()) / (7 * 86_400_000);
  if (semaines > PAUSE_MAXIMALE_SEMAINES) return "DUREE";

  return null;
}

/**
 * Motifs de résiliation.
 *
 * Recueillis parce qu'ils décident de la réponse — et la réponse n'est pas la
 * même selon le motif. Aucun n'est obligatoire : un parcours de résiliation
 * qu'on ne peut pas terminer sans se justifier est un parcours qu'on abandonne
 * en appelant sa banque.
 */
export const MOTIFS_RESILIATION = [
  "PRIX",
  "QUALITE",
  "DEMENAGEMENT",
  "PLUS_BESOIN",
  "AUTRE",
] as const;

export type MotifResiliation = (typeof MOTIFS_RESILIATION)[number];

export const LIBELLES_RESILIATION: Record<MotifResiliation, string> = {
  PRIX: "C'est trop cher",
  QUALITE: "Je n'étais pas satisfait",
  DEMENAGEMENT: "Je déménage",
  PLUS_BESOIN: "Je n'en ai plus besoin",
  AUTRE: "Autre chose",
};

/**
 * Ce qu'on propose avant de laisser partir.
 *
 * Une seule proposition, celle qui répond au motif — et **rien du tout** quand
 * le motif ne se répond pas. Proposer une remise à quelqu'un qui déménage est
 * la meilleure façon de transformer un départ neutre en mauvais souvenir.
 */
export function propositionDeRetention(
  motif: MotifResiliation,
): "FREQUENCE_MOINDRE" | "AUTRE_INTERVENANT" | "PAUSE" | null {
  switch (motif) {
    case "PRIX":
      return "FREQUENCE_MOINDRE";
    case "QUALITE":
      return "AUTRE_INTERVENANT";
    case "PLUS_BESOIN":
      return "PAUSE";
    case "DEMENAGEMENT":
    case "AUTRE":
      return null;
  }
}
