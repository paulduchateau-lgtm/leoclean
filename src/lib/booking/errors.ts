/**
 * Erreurs métier de la réservation.
 *
 * Elles vivent dans un module sans dépendance pour que `action-result.ts` — qui
 * ne connaît ni Prisma ni la base — puisse les traduire en messages
 * affichables. Une erreur métier n'est pas un incident : c'est un cas nominal
 * qu'un formulaire doit savoir présenter.
 */

/**
 * Erreur métier attendue, dont le message est destiné à l'utilisateur.
 *
 * La distinction compte : une erreur inattendue est journalisée intégralement
 * et résumée à l'écran, parce que son détail peut révéler la structure
 * interne. Une erreur métier, elle, est écrite pour être lue — la masquer
 * derrière « une erreur est survenue » laisserait le client sans rien
 * comprendre à un refus parfaitement normal.
 */
export class BusinessError extends Error {}

/**
 * Le créneau a été pris entre l'affichage et la validation.
 *
 * C'est la course que la contrainte d'exclusion en base arbitre. Elle n'est pas
 * rare : deux clients qui regardent le même mardi matin dans une commune où un
 * seul intervenant est disponible la déclenchent naturellement. Le message doit
 * donc être normal, pas alarmant.
 */
export class SlotTakenError extends BusinessError {
  override readonly name = "SlotTakenError";

  constructor() {
    super(
      "Ce créneau vient d'être réservé. Choisissez-en un autre : la liste " +
        "affichée est à jour.",
    );
  }
}

/** Aucun intervenant ne peut prendre ce créneau à cette adresse. */
export class NoCleanerAvailableError extends BusinessError {
  override readonly name = "NoCleanerAvailableError";

  constructor() {
    super(
      "Aucun intervenant n'est disponible sur ce créneau. Essayez une autre " +
        "heure, ou appelez-nous : nous trouvons souvent une solution.",
    );
  }
}

/** L'adresse est hors de la zone d'intervention. */
export class OutsideCoverageError extends BusinessError {
  override readonly name = "OutsideCoverageError";

  constructor(cityName: string) {
    super(
      `Léo Clean n'intervient pas encore à ${cityName}. Notre zone couvre ` +
        `seize communes au sud de Bordeaux.`,
    );
  }
}

/**
 * Code d'erreur PostgreSQL d'une violation de contrainte d'exclusion.
 *
 * `23P01` est ce que renvoie la base quand `Assignment_no_overlap` refuse une
 * mission qui chevauche une autre, temps de trajet compris. C'est le verrou
 * anti-double-réservation, et il vit là plutôt que dans le code applicatif
 * parce qu'aucune vérification préalable ne résiste à deux requêtes
 * simultanées.
 */
export const EXCLUSION_VIOLATION_CODE = "23P01";

/** Vraie si l'erreur est le refus de la contrainte anti-chevauchement. */
export function isExclusionViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  // On ne teste pas `instanceof PrismaClientKnownRequestError` : selon le
  // chemin d'erreur, Prisma expose le code natif dans `meta.code` plutôt que
  // dans `code`, et le message brut le contient toujours.
  const candidate = error as {
    code?: unknown;
    meta?: { code?: unknown };
    message?: unknown;
  };
  return (
    candidate.code === EXCLUSION_VIOLATION_CODE ||
    candidate.meta?.code === EXCLUSION_VIOLATION_CODE ||
    (typeof candidate.message === "string" &&
      candidate.message.includes(EXCLUSION_VIOLATION_CODE))
  );
}
