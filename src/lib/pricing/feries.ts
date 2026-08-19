/**
 * Jours fériés français.
 *
 * Module **pur**, et surtout **calculé** : une table de dates en dur se périme
 * en silence — elle donne des réponses fausses le jour où l'on dépasse la
 * dernière année saisie, sans qu'aucun test n'échoue et sans que personne ne
 * s'en aperçoive avant une facture surprenante.
 *
 * Ne couvre que les onze fériés de la France métropolitaine. Le territoire de
 * Léo Clean est la Gironde ; les jours propres à l'Alsace-Moselle et aux
 * outre-mer n'y ont pas cours, et les ajouter sans en avoir besoin ferait
 * majorer des interventions qui ne le doivent pas.
 */

import { utcToParisWallClock } from "@/lib/time";

/**
 * Dimanche de Pâques, par l'algorithme de Butcher (calendrier grégorien).
 *
 * Trois fériés en dépendent — lundi de Pâques, Ascension, lundi de Pentecôte —
 * et aucun ne tombe à date fixe. C'est précisément ce qu'une table en dur ne
 * peut pas deviner.
 */
export function paques(annee: number): { mois: number; jour: number } {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return { mois, jour };
}

/** Ajoute des jours à une date de calendrier, sans passer par les instants. */
function plusDeJours(
  date: { annee: number; mois: number; jour: number },
  jours: number,
): { annee: number; mois: number; jour: number } {
  const point = new Date(Date.UTC(date.annee, date.mois - 1, date.jour + jours));
  return {
    annee: point.getUTCFullYear(),
    mois: point.getUTCMonth() + 1,
    jour: point.getUTCDate(),
  };
}

export interface Ferie {
  mois: number;
  jour: number;
  nom: string;
}

/**
 * Les onze fériés d'une année donnée, en dates de calendrier français.
 *
 * On raisonne en composantes de calendrier et non en instants : un férié est
 * une journée, pas un point du temps, et le convertir en instant obligerait à
 * choisir un fuseau avant d'en avoir besoin.
 */
export function feriesDeLAnnee(annee: number): Ferie[] {
  const dimanchePaques = { annee, ...paques(annee) };

  const lundiPaques = plusDeJours(dimanchePaques, 1);
  const ascension = plusDeJours(dimanchePaques, 39);
  const lundiPentecote = plusDeJours(dimanchePaques, 50);

  return [
    { mois: 1, jour: 1, nom: "Jour de l'an" },
    { mois: lundiPaques.mois, jour: lundiPaques.jour, nom: "Lundi de Pâques" },
    { mois: 5, jour: 1, nom: "Fête du Travail" },
    { mois: 5, jour: 8, nom: "Victoire 1945" },
    { mois: ascension.mois, jour: ascension.jour, nom: "Ascension" },
    {
      mois: lundiPentecote.mois,
      jour: lundiPentecote.jour,
      nom: "Lundi de Pentecôte",
    },
    { mois: 7, jour: 14, nom: "Fête nationale" },
    { mois: 8, jour: 15, nom: "Assomption" },
    { mois: 11, jour: 1, nom: "Toussaint" },
    { mois: 11, jour: 11, nom: "Armistice 1918" },
    { mois: 12, jour: 25, nom: "Noël" },
  ];
}

/**
 * Cet instant tombe-t-il un jour férié, en heure française ?
 *
 * La conversion passe par `time.ts` : une intervention le 1ᵉʳ mai à 8 h est
 * enregistrée le 30 avril à 22 h UTC, et raisonner sur l'instant brut la
 * ferait manquer.
 */
export function estFerie(instant: Date): Ferie | null {
  const mur = utcToParisWallClock(instant);
  return (
    feriesDeLAnnee(mur.year).find(
      (ferie) => ferie.mois === mur.month && ferie.jour === mur.day,
    ) ?? null
  );
}

/** Jour de la semaine français : 1 = lundi … 7 = dimanche. */
function jourDeSemaineParis(instant: Date): number {
  const mur = utcToParisWallClock(instant);
  const point = new Date(Date.UTC(mur.year, mur.month - 1, mur.day));
  const jour = point.getUTCDay();
  return jour === 0 ? 7 : jour;
}

export function estSamedi(instant: Date): boolean {
  return jourDeSemaineParis(instant) === 6;
}

export function estDimanche(instant: Date): boolean {
  return jourDeSemaineParis(instant) === 7;
}
