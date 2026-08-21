/**
 * La file d'actions : ce qui exige une décision humaine.
 *
 * Module **pur** — il transforme des faits en éléments de travail priorisés,
 * sans base ni horloge implicite.
 *
 * **Ce n'est pas un tableau de bord.** Une page qui affiche des courbes se
 * consulte une fois ; une page qui dit ce qui attend s'ouvre tous les matins.
 * Toute métrique qui ne débouche pas sur une action en est retirée — c'est la
 * règle qui gouverne le module entier.
 */

export type Priorite = "P0" | "P1" | "P2" | "P3";

/**
 * Délai de traitement, en heures.
 *
 * Ce ne sont pas des vœux : le dépassement est conservé, et c'est lui qui
 * mesure la qualité d'exploitation. Un SLA qu'on ne compte pas n'existe pas.
 */
export const SLA_HEURES: Record<Priorite, number> = {
  P0: 1,
  P1: 4,
  P2: 48,
  P3: 168,
};

export type TypeAction =
  | "MISSION_SANS_INTERVENANT"
  | "POINTAGE_MANQUANT"
  | "PROPOSITION_PERIMEE"
  | "RAPPEL_NON_TRAITE"
  | "DOSSIER_A_EXAMINER"
  | "PIECE_EXPIRANT"
  | "PAIEMENT_ECHOUE"
  | "NOTE_BASSE"
  | "AJUSTEMENT_A_ARBITRER"
  | "CANDIDATURE_SANS_NOUVELLE";

export interface ElementDeTravail {
  type: TypeAction;
  priorite: Priorite;
  entiteId: string;
  titre: string;
  /**
   * Pourquoi cet élément est là, en langage clair.
   *
   * **Jamais un score nu.** « 3 annulations en 60 jours, note passée de 4,8 à
   * 4,1 » se traite ; « score 72 » ne se traite pas. C'est la règle qui rend le
   * module utilisable au lieu d'impressionnant.
   */
  motif: string;
  echeance: Date;
}

/**
 * Ce qui arrive quand personne ne fait rien.
 *
 * Chaque règle nomme un fait daté, pas une impression. Le seuil est écrit ici,
 * une seule fois, plutôt que dispersé dans les requêtes — c'est ce qui permet
 * de le discuter.
 */
export interface FaitsExploitation {
  /** Réservations sans intervenant, avec leur heure de début. */
  missionsOrphelines: { id: string; debut: Date; commune: string }[];
  /** Missions confirmées dont l'arrivée n'a pas été pointée. */
  pointagesManquants: { id: string; debut: Date; intervenant: string }[];
  propositionsPerimees: { id: string; depuis: Date; intervenant: string }[];
  rappelsNonTraites: { id: string; recuLe: Date; nom: string }[];
  dossiersAExaminer: { id: string; depuis: Date; nom: string }[];
  piecesExpirant: {
    id: string;
    expireLe: Date;
    intervenant: string;
    piece: string;
  }[];
  paiementsEchoues: { id: string; depuis: Date; tentatives: number }[];
  notesBasses: { id: string; recuLe: Date; etoiles: number }[];
  ajustementsAArbitrer: { id: string; depuis: Date; minutes: number }[];
  candidaturesSansNouvelle: { id: string; depuis: Date; nom: string }[];
}

/** Heures après le début sans pointage avant que ce soit un problème. */
export const POINTAGE_TOLERANCE_MINUTES = 20;

/** Heures avant le début où une mission orpheline devient critique. */
export const ORPHELINE_CRITIQUE_HEURES = 48;
export const ORPHELINE_ELEVEE_HEURES = 96;

/** Jours avant expiration d'une pièce où l'on prévient. */
export const PIECE_ALERTE_JOURS = 15;

function echeanceDe(priorite: Priorite, depuis: Date): Date {
  return new Date(depuis.getTime() + SLA_HEURES[priorite] * 3_600_000);
}

function heuresAvant(instant: Date, maintenant: Date): number {
  return (instant.getTime() - maintenant.getTime()) / 3_600_000;
}

function joursDepuis(instant: Date, maintenant: Date): number {
  return (maintenant.getTime() - instant.getTime()) / 86_400_000;
}

/** Jours restants avant un instant. Négatif s'il est passé. */
function joursAvant(instant: Date, maintenant: Date): number {
  return (instant.getTime() - maintenant.getTime()) / 86_400_000;
}

/**
 * Compose la file, triée par urgence.
 *
 * Le tri est **par échéance et non par priorité** : un P1 dont le délai expire
 * dans dix minutes passe avant un P0 posé à l'instant. Trier par priorité ferait
 * dépasser des délais qu'on avait le temps de tenir.
 */
export function composerLaFile(
  faits: FaitsExploitation,
  maintenant: Date,
): ElementDeTravail[] {
  const elements: ElementDeTravail[] = [];

  for (const mission of faits.missionsOrphelines) {
    const heures = heuresAvant(mission.debut, maintenant);
    const priorite: Priorite =
      heures <= ORPHELINE_CRITIQUE_HEURES
        ? "P0"
        : heures <= ORPHELINE_ELEVEE_HEURES
          ? "P1"
          : "P2";
    elements.push({
      type: "MISSION_SANS_INTERVENANT",
      priorite,
      entiteId: mission.id,
      titre: `Mission à ${mission.commune} sans intervenant`,
      motif:
        heures <= 0
          ? "L'heure prévue est passée et personne n'a accepté."
          : `Dans ${Math.round(heures)} h, et personne n'a encore accepté.`,
      echeance: echeanceDe(priorite, maintenant),
    });
  }

  for (const mission of faits.pointagesManquants) {
    const retard = Math.round(-heuresAvant(mission.debut, maintenant) * 60);
    elements.push({
      type: "POINTAGE_MANQUANT",
      priorite: "P0",
      entiteId: mission.id,
      titre: `${mission.intervenant} n'a pas pointé son arrivée`,
      motif: `${retard} minutes après l'heure prévue. Le client attend peut-être devant sa porte.`,
      echeance: echeanceDe("P0", maintenant),
    });
  }

  for (const proposition of faits.propositionsPerimees) {
    elements.push({
      type: "PROPOSITION_PERIMEE",
      priorite: "P1",
      entiteId: proposition.id,
      titre: `Proposition expirée pour ${proposition.intervenant}`,
      motif: `Sans réponse depuis ${Math.round(joursDepuis(proposition.depuis, maintenant))} jours.`,
      echeance: echeanceDe("P1", proposition.depuis),
    });
  }

  for (const rappel of faits.rappelsNonTraites) {
    const jours = joursDepuis(rappel.recuLe, maintenant);
    elements.push({
      type: "RAPPEL_NON_TRAITE",
      priorite: jours >= 1 ? "P1" : "P2",
      entiteId: rappel.id,
      titre: `${rappel.nom} attend un rappel`,
      motif:
        jours >= 1
          ? `Demandé il y a ${Math.round(jours)} jours et personne n'a appelé.`
          : "Demandé aujourd'hui.",
      echeance: echeanceDe(jours >= 1 ? "P1" : "P2", rappel.recuLe),
    });
  }

  for (const dossier of faits.dossiersAExaminer) {
    elements.push({
      type: "DOSSIER_A_EXAMINER",
      priorite: "P1",
      entiteId: dossier.id,
      titre: `Dossier de ${dossier.nom} à examiner`,
      motif: `Pièces déposées il y a ${Math.round(joursDepuis(dossier.depuis, maintenant) * 24)} h. On a promis 24 h.`,
      echeance: echeanceDe("P1", dossier.depuis),
    });
  }

  for (const piece of faits.piecesExpirant) {
    const jours = Math.round(joursAvant(piece.expireLe, maintenant));
    elements.push({
      type: "PIECE_EXPIRANT",
      priorite: jours <= 0 ? "P1" : "P2",
      entiteId: piece.id,
      titre: `${piece.piece} de ${piece.intervenant}`,
      motif:
        jours <= 0
          ? "Expirée. Le compte passe en pause tant qu'elle n'est pas renouvelée."
          : `Expire dans ${jours} jours.`,
      echeance: echeanceDe(jours <= 0 ? "P1" : "P2", maintenant),
    });
  }

  for (const paiement of faits.paiementsEchoues) {
    elements.push({
      type: "PAIEMENT_ECHOUE",
      priorite: paiement.tentatives >= 3 ? "P0" : "P1",
      entiteId: paiement.id,
      titre: `Prélèvement en échec (${paiement.tentatives}ᵉ tentative)`,
      motif:
        paiement.tentatives >= 3
          ? "Troisième échec : la prochaine mission sera suspendue avec préavis."
          : "Le client doit mettre à jour son moyen de paiement.",
      echeance: echeanceDe(
        paiement.tentatives >= 3 ? "P0" : "P1",
        paiement.depuis,
      ),
    });
  }

  for (const note of faits.notesBasses) {
    elements.push({
      type: "NOTE_BASSE",
      priorite: "P1",
      entiteId: note.id,
      titre: `Avis à ${note.etoiles} étoile${note.etoiles > 1 ? "s" : ""}`,
      motif:
        "Un client qui prend le temps de mettre une note basse a quelque chose à dire. Appeler le jour même vaut mieux que le découvrir à la résiliation.",
      echeance: echeanceDe("P1", note.recuLe),
    });
  }

  for (const ajustement of faits.ajustementsAArbitrer) {
    elements.push({
      type: "AJUSTEMENT_A_ARBITRER",
      priorite: "P1",
      entiteId: ajustement.id,
      titre: `Ajustement de ${ajustement.minutes} min proposé`,
      motif:
        "Logement signalé inhabituellement sale. Rien n'est facturé tant que ce n'est pas arbitré.",
      echeance: echeanceDe("P1", ajustement.depuis),
    });
  }

  for (const candidature of faits.candidaturesSansNouvelle) {
    elements.push({
      type: "CANDIDATURE_SANS_NOUVELLE",
      priorite: "P2",
      entiteId: candidature.id,
      titre: `${candidature.nom} n'avance plus`,
      motif: `Aucune activité depuis ${Math.round(joursDepuis(candidature.depuis, maintenant))} jours. Un bon dossier oublié est un candidat perdu.`,
      echeance: echeanceDe("P2", candidature.depuis),
    });
  }

  return elements.sort((a, b) => a.echeance.getTime() - b.echeance.getTime());
}

/** Combien d'éléments ont dépassé leur délai ? C'est la métrique qui compte. */
export function enRetard(
  file: readonly ElementDeTravail[],
  maintenant: Date,
): ElementDeTravail[] {
  return file.filter(
    (element) => element.echeance.getTime() < maintenant.getTime(),
  );
}

/** Répartition par priorité, pour la barre de tête. */
export function compter(
  file: readonly ElementDeTravail[],
): Record<Priorite, number> {
  const compte: Record<Priorite, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const element of file) compte[element.priorite] += 1;
  return compte;
}
