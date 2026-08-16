import type { Role } from "@prisma/client";

/**
 * Autorisations.
 *
 * Les rôles ne sont volontairement pas hiérarchisés sur une échelle unique.
 * Un intervenant n'est pas « plus » qu'un client : il voit ses missions et
 * rien d'autre, là où un client voit ses réservations et rien d'autre. Les
 * ranger sur un même axe conduirait tôt ou tard à laisser un intervenant lire
 * la liste des clients parce qu'il est « au-dessus ».
 *
 * On raisonne donc en capacités explicites, et chaque rôle reçoit exactement
 * les siennes.
 */

export const PERMISSIONS = [
  /** Modifier les paramètres, la page publique et la facturation. */
  "org:manage",
  /** Inviter, retirer, changer le rôle des membres. */
  "org:members:manage",
  /** Créer et modifier prestations, options et tarifs. */
  "catalog:manage",
  /** Lire toutes les réservations de l'organisation. */
  "booking:read:all",
  /** Lire les réservations dont on est le client. */
  "booking:read:own",
  /** Lire les missions qui nous sont affectées. */
  "assignment:read:own",
  /**
   * Accepter ou refuser une mission qu'on nous propose.
   *
   * Aucun rôle de gestion ne la détient, et c'est la même raison que pour
   * `availability:manage:own` : accepter une mission à la place de quelqu'un
   * reviendrait à la lui imposer. Un gestionnaire peut réattribuer — c'est
   * `assignment:manage` — il ne peut pas répondre à sa place.
   */
  "assignment:respond:own",
  /** Réattribuer manuellement une mission. */
  "assignment:manage",
  /** Créer une réservation pour soi. */
  "booking:create:own",
  /** Saisir une réservation au nom d'un client. */
  "booking:create:behalf",
  /** Déclarer ses disponibilités et connecter son agenda. */
  "availability:manage:own",
  /** Valider les pièces justificatives d'un intervenant. */
  "cleaner:verify",
  /** Rembourser, arbitrer un litige. */
  "payment:refund",
  /** Consulter les indicateurs de l'organisation. */
  "analytics:read",
  /** Administration de la plateforme, au-delà d'une organisation. */
  "platform:admin",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ORG_MANAGER_PERMISSIONS: readonly Permission[] = [
  "catalog:manage",
  "booking:read:all",
  "booking:create:behalf",
  "assignment:manage",
  "cleaner:verify",
  "analytics:read",
];

/**
 * Capacités par rôle.
 *
 * `PLATFORM_ADMIN` porte `platform:admin` en plus des capacités d'un
 * propriétaire : c'est ce qui autorise, sur un chemin explicite et journalisé,
 * à franchir la frontière d'une organisation. Aucun autre rôle ne le peut.
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  CLIENT: ["booking:read:own", "booking:create:own"],

  CLEANER: [
    "assignment:read:own",
    "assignment:respond:own",
    "availability:manage:own",
  ],

  ORG_MANAGER: ORG_MANAGER_PERMISSIONS,

  ORG_OWNER: [
    ...ORG_MANAGER_PERMISSIONS,
    "org:manage",
    "org:members:manage",
    "payment:refund",
  ],

  PLATFORM_ADMIN: [
    ...ORG_MANAGER_PERMISSIONS,
    "org:manage",
    "org:members:manage",
    "payment:refund",
    "platform:admin",
  ],
};

/** Ce rôle dispose-t-il de cette capacité ? */
export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Ce rôle dispose-t-il de toutes ces capacités ? */
export function canAll(
  role: Role,
  permissions: readonly Permission[],
): boolean {
  return permissions.every((permission) => can(role, permission));
}

/**
 * Erreur d'autorisation.
 *
 * Distinguée d'une erreur d'authentification : dans un cas il faut se
 * connecter, dans l'autre le compte est connu mais n'a pas le droit demandé.
 * Le message est volontairement sobre — on ne dit pas à un utilisateur ce
 * qu'il aurait fallu être pour accéder à la ressource.
 */
export class ForbiddenError extends Error {
  readonly permission: Permission | undefined;

  constructor(permission?: Permission) {
    super("Vous n'avez pas accès à cette ressource.");
    this.name = "ForbiddenError";
    this.permission = permission;
  }
}

/** Erreur d'authentification : aucune session valide. */
export class UnauthenticatedError extends Error {
  constructor() {
    super("Vous devez être connecté pour effectuer cette action.");
    this.name = "UnauthenticatedError";
  }
}
