/**
 * Taxonomie des événements de parcours.
 *
 * C'est le seul chantier du plan dont le coût monte chaque semaine où il n'est
 * pas fait : ce qui n'est pas mesuré aujourd'hui ne sera pas rattrapable
 * demain. Le module Frictions, les objectifs de conversion du tunnel et les
 * scores de churn liront tous cette table — mais aucun ne peut lire un passé
 * qu'on n'a pas enregistré.
 *
 * Module **pur** : il nomme et il type, il n'écrit rien. L'écriture vit dans
 * `journal.ts`, marqué `server-only`.
 *
 * Trois règles de nommage, empruntées au corpus de spécifications :
 * objet puis verbe au passé, propriétés en `snake_case`, et **aucune donnée
 * personnelle** — ni nom, ni email, ni téléphone, ni adresse. Un événement dit
 * ce qui s'est passé, jamais à qui.
 */

/**
 * Les écrans du tunnel, dans l'ordre.
 *
 * Recopiés plutôt qu'importés : `booking-funnel.tsx` est un composant client de
 * plusieurs milliers de lignes, et l'importer depuis un module que le serveur
 * charge tirerait tout le tunnel dans le graphe. Un test vérifie que les deux
 * listes coïncident — c'est la duplication assumée, pas la duplication subie.
 */
export const ETAPES_TUNNEL = [
  "commune",
  /*
   * L'identifiant est resté « logement » alors que l'écran demande désormais
   * une durée : le renommer casserait les parcours enregistrés en stockage
   * local et les URL déjà partagées, pour un gain nul. Le test de cohérence
   * avec `booking-funnel.tsx` a d'ailleurs attrapé l'écart.
   */
  "logement",
  "rythme",
  "creneau",
  "coordonnees",
  "adresse",
] as const;

export type EtapeTunnel = (typeof ETAPES_TUNNEL)[number];

/**
 * Un événement, et rien d'autre que ce qu'il lui faut.
 *
 * Le type est une union discriminée : ajouter un événement sans décrire ses
 * propriétés ne compile pas, et personne ne peut glisser un champ libre dans
 * `properties` sans passer par ici.
 */
export type Evenement =
  /* — Tunnel de réservation — */
  | { nom: "tunnel_etape_vue"; etape: EtapeTunnel }
  | {
      nom: "tunnel_etape_completee";
      etape: EtapeTunnel;
      /** Temps passé sur l'écran, en millisecondes. */
      duree_ms: number;
    }
  | {
      nom: "tunnel_abandonne";
      etape: EtapeTunnel;
      duree_ms: number;
    }
  | { nom: "tunnel_repris"; etape: EtapeTunnel }
  | {
      nom: "devis_calcule";
      commune_insee: string;
      duree_minutes: number;
      frequence: string;
      montant_cents: number;
    }
  | {
      nom: "creneaux_cherches";
      commune_insee: string;
      /** Zéro est le cas intéressant : c'est une friction et un signal de capacité. */
      resultats: number;
    }
  | {
      nom: "reservation_confirmee";
      commune_insee: string;
      frequence: string;
      montant_cents: number;
      /** Un créneau de repli retenu dit que le préféré est parti pendant la saisie. */
      repli_utilise: boolean;
    }
  | { nom: "reservation_echouee"; etape: EtapeTunnel; motif: string }

  /* — Formulaires ouverts — */
  | { nom: "rappel_demande"; page_origine: string }
  | { nom: "candidature_deposee"; page_origine: string }

  /* — Espace intervenant — */
  | { nom: "mission_acceptee"; delai_reponse_ms: number }
  | { nom: "mission_refusee"; delai_reponse_ms: number; motif: string | null }
  | { nom: "absence_posee"; jours: number }
  | { nom: "semaine_declaree"; plages: number; total_minutes: number };

export type NomEvenement = Evenement["nom"];

/** Les noms connus, pour valider ce qui arrive du navigateur. */
export const NOMS_EVENEMENTS = [
  "tunnel_etape_vue",
  "tunnel_etape_completee",
  "tunnel_abandonne",
  "tunnel_repris",
  "devis_calcule",
  "creneaux_cherches",
  "reservation_confirmee",
  "reservation_echouee",
  "rappel_demande",
  "candidature_deposee",
  "mission_acceptee",
  "mission_refusee",
  "absence_posee",
  "semaine_declaree",
] as const satisfies readonly NomEvenement[];

/**
 * Champs qu'aucun événement n'a le droit de porter.
 *
 * La liste est appliquée par un test sur la définition, et de nouveau à
 * l'écriture : une propriété nommée `email` ou `telephone` fait échouer
 * l'enregistrement plutôt que de laisser une donnée personnelle entrer dans une
 * table de mesure, où elle échapperait à la purge des comptes.
 */
export const CHAMPS_INTERDITS = [
  "email",
  "telephone",
  "phone",
  "nom",
  "prenom",
  "adresse",
  "address",
  "ip",
  "lat",
  "lng",
  "user_agent",
] as const;

/** Sépare le nom du reste, qui devient les propriétés de la ligne. */
export function decomposer(evenement: Evenement): {
  nom: NomEvenement;
  proprietes: Record<string, unknown>;
} {
  const { nom, ...proprietes } = evenement;
  return { nom, proprietes };
}

/**
 * Un identifiant de parcours porte-t-il la forme attendue ?
 *
 * Il est engendré par le navigateur et n'est donc pas digne de confiance : on
 * exige une chaîne courte et opaque, ce qui écarte aussi bien une valeur
 * bricolée qu'un identifiant volumineux glissé pour marquer quelqu'un.
 */
export function parcoursValide(valeur: string): boolean {
  return /^[a-z0-9]{16,40}$/.test(valeur);
}
