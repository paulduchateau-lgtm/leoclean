/**
 * Le recouvrement, et le gel qui s'en déduit.
 *
 * Module **pur** : aucune base, aucune horloge implicite. C'est ce qui permet
 * de le lire depuis un composant client — l'écran de l'intervenant en a besoin
 * pour dire « ne partez pas » — sans traîner Prisma dans le paquet, et c'est la
 * leçon que `frontiere-client.test.ts` garde déjà pour trois autres modules.
 *
 * **Le gel n'est pas un statut de réservation, c'est une conséquence.** Poser
 * `SUSPENDED` sur chaque intervention à venir obligerait à parcourir les
 * réservations deux fois — au gel et au dégel — et un seul oubli au dégel
 * laisserait gelé quelqu'un qui vient de payer. C'est la panne la plus coûteuse
 * imaginable ici : elle punit précisément le client qui a régularisé. Une seule
 * date sur le client, et tout le reste se dérive.
 *
 * **Ce qui est gelé n'est pas annulé.** L'affectation tient, le créneau reste
 * réservé, l'intervenant garde sa mission. C'est la règle du dépôt depuis les
 * relances : un logiciel qui annule seul un rendez-vous pour une carte expirée
 * transforme un incident bancaire en client perdu.
 */

/** Statuts pour lesquels la question du gel ne se pose plus. */
const STATUTS_TERMINES = [
  "COMPLETED",
  "CANCELLED_BY_CLIENT",
  "CANCELLED_BY_CLEANER",
  "NO_SHOW",
  "DISPUTED",
] as const;

export interface ClientRecouvrable {
  recouvrementDepuis: Date | null;
}

export interface InterventionGelable {
  status: string;
  debut: Date;
}

/** Ce client est-il en recouvrement ? */
export function estEnRecouvrement(client: ClientRecouvrable): boolean {
  return client.recouvrementDepuis !== null;
}

/**
 * Cette intervention est-elle gelée ?
 *
 * Trois conditions, et la troisième est celle qu'on oublie : **une intervention
 * déjà commencée ne se gèle pas.** Quelqu'un qui est chez le client, ou qui
 * vient d'y arriver, doit finir son ménage et être payé pour — retirer la
 * mission sous ses pieds ferait porter à l'intervenant un litige qui n'est pas
 * le sien. Le gel regarde ce qui n'a pas encore commencé.
 */
export function interventionGelee(
  client: ClientRecouvrable,
  intervention: InterventionGelable,
  maintenant: Date,
): boolean {
  if (!estEnRecouvrement(client)) return false;
  if (STATUTS_TERMINES.includes(intervention.status as never)) return false;
  if (intervention.status === "IN_PROGRESS") return false;
  return intervention.debut.getTime() > maintenant.getTime();
}

/**
 * Depuis combien de jours ce client est-il en recouvrement ?
 *
 * Sert à ordonner la file du back-office : le plus ancien d'abord, comme la
 * revue de dossier. Traiter le plus récent laisse indéfiniment au fond de la
 * pile celui qui traîne depuis trois semaines, et c'est celui-là qu'on perd.
 */
export function joursEnRecouvrement(
  client: ClientRecouvrable,
  maintenant: Date,
): number | null {
  if (client.recouvrementDepuis === null) return null;
  const ecoules = maintenant.getTime() - client.recouvrementDepuis.getTime();
  return Math.max(0, Math.floor(ecoules / 86_400_000));
}

/**
 * Ce que l'intervenant lit sur une mission gelée.
 *
 * Écrit ici et pas dans l'écran, pour la raison qui vaut partout dans ce
 * dépôt : un libellé recopié à deux endroits finit par diverger, et celui-ci
 * décide d'un déplacement. Le ton ne met en cause personne — l'intervenant n'a
 * rien fait, et le client le plus souvent non plus : c'est une carte expirée.
 */
export const VOCABULAIRE_GEL = {
  badge: "Intervention gelée",
  titre: "Ne vous déplacez pas sans confirmation",
  explication:
    "Le paiement de ce client n'est pas régularisé. La mission n'est pas annulée et votre rémunération sur les interventions déjà réalisées vous reste due — mais tant que la situation n'est pas réglée, ne vous déplacez pas.",
  geste: "Nous vous prévenons dès que c'est rétabli.",
} as const;
