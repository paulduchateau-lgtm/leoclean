/**
 * Quand préautoriser, quand prélever, quand reverser.
 *
 * Module **pur** : il décide d'instants, il n'appelle personne. C'est là que
 * vivent les seules décisions du paiement qui ne soient pas de la plomberie —
 * et ce sont celles qui coûtent de l'argent quand elles sont fausses.
 *
 * **Le modèle est celui du dépôt, arbitré le 19 août 2026** : empreinte à la
 * réservation, préautorisation à H-24, prélèvement à H+24. Il diffère du débit
 * à J+1 que proposait le corpus, et il impose une contrainte que le corpus
 * n'avait pas à traiter — une autorisation Stripe expire au bout de sept jours.
 */

/**
 * Heures avant l'intervention où l'on préautorise.
 *
 * Vingt-quatre. Pas davantage, et la raison est technique autant que
 * commerciale : **une autorisation bancaire expire au bout de sept jours**. La
 * poser à la réservation — parfois trois semaines à l'avance — la rendrait
 * caduque avant la mission, et le prélèvement échouerait sur toutes les
 * réservations prises à l'avance, c'est-à-dire sur les meilleures.
 */
export const PREAUTORISATION_HEURES_AVANT = 24;

/**
 * Heures après la fin où l'on prélève.
 *
 * Vingt-quatre. Le délai laisse au client le temps de signaler un problème
 * avant que l'argent parte, ce qui vaut mieux qu'un remboursement — et il tient
 * largement dans la fenêtre d'autorisation, qui court depuis H-24 : quarante-huit
 * heures au total, contre sept jours disponibles.
 */
export const PRELEVEMENT_HEURES_APRES = 24;

/**
 * Marge de sécurité avant l'expiration de l'autorisation, en jours.
 *
 * Sept jours d'autorisation, quarante-huit heures d'usage : la marge est
 * confortable et le reste doit le rester. Un test vérifie que le calendrier
 * n'approche jamais la limite — le jour où quelqu'un allongera l'un des deux
 * délais, il l'apprendra ici plutôt qu'en production.
 */
export const AUTORISATION_VALIDITE_JOURS = 7;

export function instantDePreautorisation(debutMission: Date): Date {
  return new Date(
    debutMission.getTime() - PREAUTORISATION_HEURES_AVANT * 3_600_000,
  );
}

export function instantDePrelevement(finMission: Date): Date {
  return new Date(finMission.getTime() + PRELEVEMENT_HEURES_APRES * 3_600_000);
}

/**
 * L'autorisation tiendra-t-elle jusqu'au prélèvement ?
 *
 * Vérifié à chaque préautorisation plutôt que supposé : une mission de six
 * heures et un délai de prélèvement allongé suffiraient à sortir de la fenêtre,
 * et l'échec surviendrait au moment du débit, quand la prestation est déjà
 * faite.
 */
export function autorisationTiendra(mission: {
  debut: Date;
  fin: Date;
}): boolean {
  const pose = instantDePreautorisation(mission.debut);
  const capture = instantDePrelevement(mission.fin);
  const joursDeVie = (capture.getTime() - pose.getTime()) / 86_400_000;
  return joursDeVie < AUTORISATION_VALIDITE_JOURS;
}

export type EtapePaiement =
  /** Rien à faire pour l'instant. */
  | "ATTENDRE"
  /** Poser l'autorisation sur le moyen enregistré. */
  | "PREAUTORISER"
  /** Capturer, la prestation étant faite. */
  | "PRELEVER"
  /** Libérer l'autorisation : la mission n'aura pas lieu. */
  | "LIBERER";

export interface EtatPaiement {
  statutReservation: string;
  /** Une autorisation est-elle posée et vivante ? */
  autorisee: boolean;
  capturee: boolean;
  debutMission: Date;
  finMission: Date;
  /** Clôture réelle, renseignée seulement quand la mission est terminée. */
  termineeA: Date | null;
}

/**
 * Que faire de cette réservation, maintenant ?
 *
 * Une seule fonction décide, et elle est pure : c'est ce qui permet de rejouer
 * un mois de calendrier en quelques millisecondes plutôt que d'attendre un
 * mois pour découvrir qu'on prélève des missions qui n'ont pas eu lieu.
 */
export function prochaineEtapePaiement(
  etat: EtatPaiement,
  maintenant: Date,
): EtapePaiement {
  if (etat.capturee) return "ATTENDRE";

  const annulee =
    etat.statutReservation === "CANCELLED_BY_CLIENT" ||
    etat.statutReservation === "CANCELLED_BY_CLEANER" ||
    etat.statutReservation === "NO_SHOW";

  /*
   * Une autorisation posée sur une mission annulée ne se laisse pas expirer :
   * elle immobilise le plafond de la carte du client pendant sept jours, et
   * c'est le genre de détail dont on se souvient quand on choisit un
   * prestataire.
   */
  if (annulee) return etat.autorisee ? "LIBERER" : "ATTENDRE";

  if (!etat.autorisee) {
    return maintenant.getTime() >= instantDePreautorisation(etat.debutMission).getTime()
      ? "PREAUTORISER"
      : "ATTENDRE";
  }

  /*
   * **Le prélèvement est conditionné à la clôture, jamais à l'horloge seule.**
   * Sans cette condition, une mission que personne n'a faite serait encaissée
   * vingt-quatre heures après l'heure prévue — et le client découvrirait le
   * débit avant de découvrir l'absence.
   */
  if (etat.statutReservation !== "COMPLETED" || !etat.termineeA) {
    return "ATTENDRE";
  }

  return maintenant.getTime() >= instantDePrelevement(etat.termineeA).getTime()
    ? "PRELEVER"
    : "ATTENDRE";
}

/**
 * Jour de reversement d'une mission terminée.
 *
 * Hebdomadaire, avec huit jours de décalage : les missions terminées avant le
 * mercredi partent le vendredi suivant. Le délai est annoncé à l'intervenant et
 * il se tient — c'est le premier motif de départ, devant le tarif horaire.
 */
export const REVERSEMENT_JOUR_ISO = 5;
export const REVERSEMENT_DECALAGE_JOURS = 8;

export function prochainReversement(termineeA: Date): Date {
  const cible = new Date(
    termineeA.getTime() + REVERSEMENT_DECALAGE_JOURS * 86_400_000,
  );
  const jourIso = cible.getUTCDay() === 0 ? 7 : cible.getUTCDay();
  const versLeVendredi = (REVERSEMENT_JOUR_ISO - jourIso + 7) % 7;
  return new Date(cible.getTime() + versLeVendredi * 86_400_000);
}

/**
 * Relances après un échec de prélèvement, en jours.
 *
 * J+1 par notification, J+3 par SMS, J+7 par appel — donc par un élément de
 * travail. Au troisième échec, la mission suivante est suspendue **avec préavis
 * explicite** : jamais d'annulation silencieuse, qui ferait découvrir la
 * rupture au client le matin où personne ne vient.
 */
export const RELANCES_ECHEC_JOURS = [1, 3, 7] as const;

export const ECHECS_AVANT_SUSPENSION = 3;

export function prochaineRelance(
  premierEchec: Date,
  tentatives: number,
): Date | null {
  const jours = RELANCES_ECHEC_JOURS[tentatives - 1];
  if (jours === undefined) return null;
  return new Date(premierEchec.getTime() + jours * 86_400_000);
}
