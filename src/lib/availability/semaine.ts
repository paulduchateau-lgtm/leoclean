/**
 * Semaine type d'un intervenant.
 *
 * C'est la source de vérité du moteur de créneaux : tout ce qui est proposé à
 * un client en découle, moins les absences, l'agenda externe et les missions
 * déjà prises. Une erreur ici ne produit pas un affichage bancal, elle produit
 * des heures vendues que personne ne peut honorer, ou l'inverse — un
 * intervenant disponible que la plateforme n'appelle jamais.
 *
 * Module **pur** : il valide et normalise, sans base ni horloge. Les règles
 * qu'il applique sont celles qu'un humain énoncerait, et chacune existe parce
 * que son absence coûte quelque chose de précis.
 */

/** Jour ISO 8601 : 1 = lundi, 7 = dimanche. */
export type Jour = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const JOURS: readonly { valeur: Jour; nom: string; court: string }[] = [
  { valeur: 1, nom: "Lundi", court: "Lun." },
  { valeur: 2, nom: "Mardi", court: "Mar." },
  { valeur: 3, nom: "Mercredi", court: "Mer." },
  { valeur: 4, nom: "Jeudi", court: "Jeu." },
  { valeur: 5, nom: "Vendredi", court: "Ven." },
  { valeur: 6, nom: "Samedi", court: "Sam." },
  { valeur: 7, nom: "Dimanche", court: "Dim." },
];

/** Une plage déclarée, en minutes depuis minuit, heure locale française. */
export interface Plage {
  jour: Jour;
  debutMinute: number;
  finMinute: number;
}

/**
 * Pas de déclaration.
 *
 * Les créneaux sont proposés par demi-heure ; déclarer 9 h 07 n'aurait aucun
 * effet visible et laisserait croire à une précision qui n'existe pas.
 */
export const PAS_MINUTES = 30;

/**
 * Durée minimale d'une plage.
 *
 * En deçà de la durée minimale facturable — deux heures — une plage ne peut
 * accueillir aucune mission. L'accepter reviendrait à laisser quelqu'un
 * déclarer des heures qui ne lui apporteront jamais rien.
 */
export const PLAGE_MINIMALE_MINUTES = 120;

export type ErreurPlage =
  "pas-respecte" | "ordre" | "trop-courte" | "hors-journee" | "chevauchement";

export interface Anomalie {
  jour: Jour;
  erreur: ErreurPlage;
}

/** Message destiné à la personne, pas au journal d'erreurs. */
export const MESSAGES: Record<ErreurPlage, string> = {
  "pas-respecte": "Les horaires se déclarent par tranches de trente minutes.",
  ordre: "L'heure de fin doit venir après l'heure de début.",
  "trop-courte":
    "Une plage de moins de deux heures ne peut accueillir aucune mission : c'est la durée minimale d'un ménage.",
  "hors-journee": "Les horaires doivent tenir dans la journée.",
  chevauchement: "Deux plages du même jour se chevauchent.",
};

/**
 * Vérifie une semaine déclarée.
 *
 * Rend la liste des anomalies plutôt qu'un booléen : l'écran doit pouvoir dire
 * quelle plage refuse et pourquoi, sans quoi la personne corrige au hasard.
 */
export function verifierSemaine(plages: readonly Plage[]): Anomalie[] {
  const anomalies: Anomalie[] = [];

  for (const plage of plages) {
    if (
      plage.debutMinute % PAS_MINUTES !== 0 ||
      plage.finMinute % PAS_MINUTES !== 0
    ) {
      anomalies.push({ jour: plage.jour, erreur: "pas-respecte" });
    }
    if (
      plage.debutMinute < 0 ||
      plage.finMinute > 24 * 60 ||
      plage.debutMinute >= 24 * 60
    ) {
      anomalies.push({ jour: plage.jour, erreur: "hors-journee" });
      continue;
    }
    if (plage.finMinute <= plage.debutMinute) {
      anomalies.push({ jour: plage.jour, erreur: "ordre" });
      continue;
    }
    if (plage.finMinute - plage.debutMinute < PLAGE_MINIMALE_MINUTES) {
      anomalies.push({ jour: plage.jour, erreur: "trop-courte" });
    }
  }

  for (const { valeur: jour } of JOURS) {
    const duJour = plages
      .filter((plage) => plage.jour === jour)
      .sort((a, b) => a.debutMinute - b.debutMinute);

    for (let index = 1; index < duJour.length; index += 1) {
      if (duJour[index]!.debutMinute < duJour[index - 1]!.finMinute) {
        anomalies.push({ jour, erreur: "chevauchement" });
        break;
      }
    }
  }

  // Une même anomalie signalée deux fois n'aide personne.
  const vues = new Set<string>();
  return anomalies.filter((anomalie) => {
    const cle = `${anomalie.jour}-${anomalie.erreur}`;
    if (vues.has(cle)) return false;
    vues.add(cle);
    return true;
  });
}

/** « 9 h », « 9 h 30 » — telle qu'on la dit. */
export function heureLisible(minutes: number): string {
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste === 0
    ? `${heures} h`
    : `${heures} h ${String(reste).padStart(2, "0")}`;
}

/** Total hebdomadaire déclaré, en minutes. */
export function totalHebdomadaireMinutes(plages: readonly Plage[]): number {
  return plages.reduce(
    (total, plage) => total + Math.max(0, plage.finMinute - plage.debutMinute),
    0,
  );
}
