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

/**
 * Code d'erreur PostgreSQL d'un interblocage.
 *
 * Il apparaît dans exactement la même situation, et c'était l'angle mort : deux
 * réservations simultanées sur le même créneau écrivent chacune une
 * réservation, ses lignes, puis l'affectation. Quand elles se croisent, chacune
 * attend la transaction de l'autre et PostgreSQL en sacrifie une — avec
 * `40P01`, pas `23P01`. Le refus est le même sur le fond : quelqu'un d'autre
 * écrivait ce créneau au même instant.
 */
export const DEADLOCK_CODE = "40P01";

/**
 * Codes natifs portés par une erreur, où qu'ils se trouvent.
 *
 * Prisma n'expose plus le code PostgreSQL au même endroit selon la version et
 * l'adaptateur : il a été dans `code`, puis dans `meta.code`, et il est
 * aujourd'hui enfoui dans `meta.driverAdapterError.cause.code`, le message
 * n'étant plus qu'un laconique « Database error. ». Chercher à un seul endroit
 * revenait à ne plus rien reconnaître — et à rendre au client une trace
 * technique là où le produit promet une phrase lisible.
 */
function nativeErrorCodes(
  value: unknown,
  depth = 0,
  found: Set<string> = new Set(),
): Set<string> {
  if (depth > 6 || value === null || typeof value !== "object") {
    return found;
  }

  const record = value as Record<string, unknown>;
  for (const key of ["code", "originalCode"]) {
    const candidate = record[key];
    if (typeof candidate === "string") {
      found.add(candidate);
    }
  }
  // Le message reste inspecté : sur certains chemins, c'est là qu'il figure.
  if (typeof record.message === "string") {
    for (const code of [EXCLUSION_VIOLATION_CODE, DEADLOCK_CODE]) {
      if (record.message.includes(code)) {
        found.add(code);
      }
    }
  }

  for (const key of ["cause", "meta", "driverAdapterError", "error"]) {
    nativeErrorCodes(record[key], depth + 1, found);
  }

  return found;
}

/** Vraie si l'erreur est le refus de la contrainte anti-chevauchement. */
export function isExclusionViolation(error: unknown): boolean {
  return nativeErrorCodes(error).has(EXCLUSION_VIOLATION_CODE);
}

/**
 * Violation d'unicité.
 *
 * Deux emplois, tous deux liés à la diffusion : `Assignment_one_accepted_per_booking`
 * quand deux intervenants acceptent la même mission — le second a perdu la
 * course — et l'unicité d'une contre-proposition.
 */
export const UNIQUE_VIOLATION_CODE = "23505";

/**
 * Vraie si un autre intervenant a accepté la mission le premier.
 *
 * L'index unique partiel sur `("bookingId") WHERE status = 'ACCEPTED'` est ce
 * qui départage la course. Le perdant ne doit pas lire une erreur technique : il
 * a répondu de bonne foi, quelques secondes trop tard.
 */
export function isRaceLost(error: unknown): boolean {
  return nativeErrorCodes(error).has(UNIQUE_VIOLATION_CODE);
}

/**
 * Vraie si la base a refusé l'écriture parce qu'une autre transaction
 * réservait le même créneau au même instant.
 *
 * Les deux codes se traitent identiquement : on essaie l'intervenant suivant,
 * et s'il n'y en a plus, le créneau est réellement parti. La transaction est
 * déjà annulée dans les deux cas — rien n'est resté à moitié écrit.
 */
export function isConcurrentSlotWrite(error: unknown): boolean {
  const codes = nativeErrorCodes(error);
  return codes.has(EXCLUSION_VIOLATION_CODE) || codes.has(DEADLOCK_CODE);
}
