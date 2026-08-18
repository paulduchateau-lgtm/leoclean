/**
 * Diffusion d'une mission à plusieurs intervenants, par lots.
 *
 * Le modèle précédent désignait **un** intervenant à la réservation et lui
 * tenait sa place. Celui-ci propose la mission à plusieurs, et le premier qui
 * accepte l'emporte. Le changement n'est pas cosmétique : il déplace la
 * garantie anti-double-réservation de la réservation vers l'acceptation, et il
 * transforme ce que le tunnel vend — une demande en recherche, plus un
 * rendez-vous ferme.
 *
 * Ce qu'on y gagne : personne ne se voit imposer une mission. C'est la même
 * raison qui fait qu'aucun rôle de gestion ne détient `availability:manage:own`
 * — un indépendant n'est pas un salarié, et une plateforme qui affecte d'office
 * fabrique du lien de subordination.
 *
 * Module **pur** : ni base, ni horloge implicite, ni session. Toutes les dates
 * entrent en paramètre. C'est ce qui permet de tester une échéance à la
 * milliseconde, et une délibération de six jours, sans monter quoi que ce soit.
 *
 * **Le premier lot n'est pas « les cinq plus proches ».** Ce sont les cinq
 * meilleurs au score existant, dont le trajet est déjà la composante
 * dominante — mais qui porte aussi la continuité. Composer sur la distance
 * seule ferait changer d'intervenant un client régulier dès qu'un autre habite
 * cent mètres plus près, alors que « la même personne chaque semaine » est la
 * promesse centrale du service. Ce module ne classe donc rien : il reçoit une
 * liste déjà ordonnée et la coupe.
 */

/** Nombre d'intervenants sollicités d'emblée. */
export const PREMIER_LOT_TAILLE = 5;

/**
 * Heures laissées au premier lot.
 *
 * Un jour pour répondre sur les conditions exactes du client. Au-delà, ce
 * n'est plus une mission qu'on propose, c'est une mission qu'on garde au
 * chaud pendant que le client attend sans nouvelle.
 */
export const PREMIER_LOT_HEURES = 24;

/** Jours laissés au second lot, tous les intervenants du secteur. */
export const SECOND_LOT_JOURS = 6;

/**
 * Durée totale de la recherche.
 *
 * Une semaine, soit exactement le premier lot plus le second. Passé ce délai,
 * on cesse de chercher et on le dit au client — mais **la demande ne meurt
 * pas** : les horaires alternatifs déjà proposés restent acceptables jusqu'à
 * leur propre échéance. « Cesser de chercher » et « clore la demande » sont
 * deux choses différentes, et les confondre reviendrait à jeter des
 * propositions qu'un intervenant a prises la peine d'écrire.
 */
export const RECHERCHE_JOURS = 7;

/**
 * Validité d'une contre-proposition, en jours.
 *
 * Deux semaines, soit le double de la recherche : c'est ce qui permet au
 * client de répondre « continuez à chercher mon heure exacte » sans perdre les
 * alternatives, et d'y revenir plus tard. Un intervenant peut la retirer avant
 * terme depuis son espace ; c'est le seul moyen de l'éteindre par avance.
 */
export const CONTRE_PROPOSITION_JOURS = 14;

const HEURE_MS = 3_600_000;
const JOUR_MS = 24 * HEURE_MS;

export type Lot = 1 | 2;

export interface Lots<T> {
  /** Les mieux classés, sollicités d'emblée. */
  premier: T[];
  /** Le reste du secteur, sollicité si le premier lot n'a rien donné. */
  second: T[];
}

/**
 * Coupe une liste déjà classée en deux lots.
 *
 * Aucun tri ici, à dessein : le classement est l'affaire du score, et un tri
 * refait à cet étage finirait par diverger de celui qui décide vraiment.
 */
export function composerLots<T>(
  candidatsClasses: readonly T[],
  taille: number = PREMIER_LOT_TAILLE,
): Lots<T> {
  return {
    premier: candidatsClasses.slice(0, taille),
    second: candidatsClasses.slice(taille),
  };
}

/** Instant où l'on cesse de chercher un intervenant. */
export function finDeRecherche(demandeeA: Date): Date {
  return new Date(demandeeA.getTime() + RECHERCHE_JOURS * JOUR_MS);
}

/**
 * Échéance d'un lot, **bornée par la fin de la recherche**.
 *
 * La borne n'est pas une précaution théorique. Quand le premier lot n'a rien
 * donné mais qu'il a produit des alternatives, le second lot n'est émis qu'au
 * moment où le client demande à continuer de chercher — trois jours plus tard,
 * peut-être. Six jours pleins à compter de là mèneraient au neuvième jour,
 * alors qu'on a promis une semaine.
 */
export function echeanceDuLot(lot: Lot, lotEmisA: Date, demandeeA: Date): Date {
  const duree =
    lot === 1 ? PREMIER_LOT_HEURES * HEURE_MS : SECOND_LOT_JOURS * JOUR_MS;
  const echeance = lotEmisA.getTime() + duree;
  const fin = finDeRecherche(demandeeA).getTime();
  return new Date(Math.min(echeance, fin));
}

/**
 * Validité d'une contre-proposition, **bornée par le créneau qu'elle propose**.
 *
 * Quinze jours de validité sur un créneau situé dans trois jours laisserait le
 * client accepter, le dixième jour, une heure passée depuis une semaine.
 */
export function validiteContreProposition(
  emiseA: Date,
  creneauDebut: Date,
): Date {
  const validite = emiseA.getTime() + CONTRE_PROPOSITION_JOURS * JOUR_MS;
  return new Date(Math.min(validite, creneauDebut.getTime()));
}

export interface EtatDiffusion {
  /** Instant de la demande du client, origine de tous les délais. */
  demandeeA: Date;
  lotEnCours: Lot;
  /** Instant d'émission du lot en cours, qui n'est pas celui de la demande. */
  lotEmisA: Date;
  /**
   * Contre-propositions encore acceptables par le client.
   *
   * Leur seule présence change la suite : on ne relance pas la recherche dans
   * le dos de quelqu'un à qui l'on vient de soumettre un choix.
   */
  contrePropositionsVivantes: number;
}

export type Etape =
  /** Rien à faire avant cette date. */
  | { type: "attendre"; jusqua: Date }
  /** Élargir à tous les intervenants du secteur. */
  | { type: "diffuser"; lot: 2; echeance: Date }
  /**
   * Soumettre les horaires alternatifs au client, et attendre sa décision :
   * accepter l'un d'eux, ou demander à continuer la recherche.
   */
  | { type: "soumettre-alternatives" }
  /** Cesser de chercher, prévenir le client, laisser vivre les alternatives. */
  | { type: "cesser-la-recherche" };

/**
 * Ce qu'il y a à faire d'une demande sans intervenant, à cet instant.
 *
 * L'ordre des trois questions est le fond du sujet.
 *
 * **La fin de recherche passe avant tout le reste.** Un client à qui l'on a
 * promis une semaine ne doit pas voir sa demande diffusée le huitième jour
 * parce qu'un lot avait encore du temps devant lui.
 *
 * **Les alternatives passent avant l'élargissement.** Quand le premier lot
 * s'achève sans acceptation mais qu'un intervenant a proposé une autre heure,
 * on ne diffuse pas au secteur entier : on rend la main au client. Élargir
 * sans lui demander reviendrait à chercher son heure exacte alors qu'il aurait
 * peut-être pris l'alternative sur-le-champ, et à mobiliser tout un vivier
 * pour rien. C'est lui qui décide, et sa décision de continuer ne détruit
 * jamais les propositions reçues.
 */
export function prochaineEtape(etat: EtatDiffusion, maintenant: Date): Etape {
  if (maintenant.getTime() >= finDeRecherche(etat.demandeeA).getTime()) {
    return { type: "cesser-la-recherche" };
  }

  const echeance = echeanceDuLot(
    etat.lotEnCours,
    etat.lotEmisA,
    etat.demandeeA,
  );
  if (maintenant.getTime() < echeance.getTime()) {
    return { type: "attendre", jusqua: echeance };
  }

  if (etat.contrePropositionsVivantes > 0) {
    return { type: "soumettre-alternatives" };
  }

  if (etat.lotEnCours === 1) {
    return {
      type: "diffuser",
      lot: 2,
      echeance: echeanceDuLot(2, maintenant, etat.demandeeA),
    };
  }

  return { type: "cesser-la-recherche" };
}
