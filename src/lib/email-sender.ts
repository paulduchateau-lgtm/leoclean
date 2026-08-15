import { z } from "zod";

/**
 * Expéditeur des emails transactionnels.
 *
 * Deux formes sont acceptées, parce que les deux sont légitimes : l'adresse
 * seule — `menage@leoclean.fr` — ou l'adresse précédée d'un nom affiché —
 * `Léo Clean <menage@leoclean.fr>`. La seconde est celle qu'on veut en
 * production : un email dont l'expéditeur s'affiche « Léo Clean » plutôt qu'une
 * adresse nue est ouvert davantage, et c'est ce que la boîte de réception
 * montre en premier.
 *
 * Ce module existe séparément pour une raison précise : `env.ts` valide au
 * chargement, et son schéma refusait jusqu'ici la forme avec nom affiché — y
 * compris la valeur par défaut que `email.ts` employait lui-même. Le défaut ne
 * se voyait qu'au démarrage, sur un environnement correctement configuré.
 */

/** Adresse contenue dans un expéditeur, ou `null` s'il est mal formé. */
export function addressOfSender(value: string): string | null {
  const trimmed = value.trim();
  const withName = /^[^<>]*<\s*([^<>\s]+)\s*>$/.exec(trimmed);
  const candidate = withName ? withName[1]! : trimmed;
  return z.email().safeParse(candidate).success ? candidate : null;
}

export function isEmailSender(value: string): boolean {
  return addressOfSender(value) !== null;
}

/** Expéditeur par défaut, employé tant qu'`EMAIL_FROM` n'est pas renseignée. */
export const DEFAULT_EMAIL_SENDER = "Léo Clean <menage@leoclean.fr>";
