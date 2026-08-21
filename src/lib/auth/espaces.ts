import "server-only";

import { ForbiddenError } from "@/lib/auth/permissions";
import { getCurrentUser, requireOrganization } from "@/lib/auth/session";
import type { AuthenticatedUser } from "@/lib/auth/session";
import type { TenantClient } from "@/lib/db";
import { marketplaceOrganizationId } from "@/lib/organizations";

/**
 * Entrer dans un espace, sans que l'absence de droit soit une panne.
 *
 * `requireOrganization` **lève**, et c'est la bonne conception pour une
 * primitive de sécurité : un appelant qui oublierait de vérifier son résultat
 * ouvrirait la porte, alors qu'un appelant qui oublie d'attraper une exception
 * la referme. Mais une page n'est pas un appelant ordinaire — laisser
 * l'exception remonter produit une **erreur 500**, c'est-à-dire un site en
 * panne, là où la réponse juste est « cet espace n'est pas le vôtre ».
 *
 * Le cas n'est pas théorique, c'est le cas **nominal** : le dépôt a choisi
 * qu'une adresse inconnue crée un compte **sans aucune appartenance**, le
 * rattachement se faisant à la première réservation. Quelqu'un qui se connecte
 * par lien magique avant d'avoir réservé n'a donc de droit nulle part — et
 * voyait jusqu'ici une erreur serveur sur la moitié de son espace.
 *
 * Ces deux fonctions rendent donc un résultat au lieu de lever. Elles ne
 * relâchent rien : elles appellent exactement la même vérification, et se
 * contentent de traduire son refus en quelque chose qu'une page sait afficher.
 */

export type RefusEspace =
  /** Aucune session : la page redirige vers la connexion. */
  | "NON_CONNECTE"
  /** Connecté, mais cet espace n'est pas le sien. */
  | "SANS_ACCES"
  /** Le droit existe, le profil n'a pas encore été créé. */
  | "SANS_PROFIL";

export interface EspaceOuvert<TProfil> {
  ouvert: true;
  user: AuthenticatedUser;
  db: TenantClient;
  organizationId: string;
  profil: TProfil;
}

export interface EspaceFerme {
  ouvert: false;
  refus: RefusEspace;
}

export type Espace<TProfil> = EspaceOuvert<TProfil> | EspaceFerme;

interface ProfilClient {
  id: string;
}

interface ProfilIntervenant {
  id: string;
  displayName: string;
}

type Acces =
  | { refus: RefusEspace }
  | { user: AuthenticatedUser; db: TenantClient; organizationId: string };

/**
 * Résout l'appartenance, en traduisant le refus plutôt qu'en le propageant.
 *
 * Seule `ForbiddenError` est attrapée. Une panne de base, elle, doit continuer
 * de remonter : la confondre avec un refus de droit afficherait « cet espace
 * n'est pas le vôtre » à quelqu'un dont le compte est parfaitement valide, et
 * le vrai incident passerait inaperçu.
 */
async function ouvrir(
  permission: Parameters<typeof requireOrganization>[1],
): Promise<Acces> {
  const user = await getCurrentUser();
  if (!user) return { refus: "NON_CONNECTE" };

  const organizationId = await marketplaceOrganizationId();

  try {
    const { db } = await requireOrganization(organizationId, permission);
    return { user, db, organizationId };
  } catch (erreur) {
    if (erreur instanceof ForbiddenError) return { refus: "SANS_ACCES" };
    throw erreur;
  }
}

export async function espaceClient(): Promise<Espace<ProfilClient>> {
  const acces = await ouvrir("booking:read:own");
  if ("refus" in acces) return { ouvert: false, refus: acces.refus };

  const profil = await acces.db.clientProfile.findFirst({
    where: { userId: acces.user.id },
    select: { id: true },
  });

  /*
   * Le droit sans le profil est un état réel : une invitation acceptée, une
   * réservation abandonnée avant écriture. On le distingue de l'absence de
   * droit parce que la phrase à dire n'est pas la même — « vous n'avez pas
   * encore réservé » plutôt que « cet espace n'est pas le vôtre ».
   */
  if (!profil) return { ouvert: false, refus: "SANS_PROFIL" };

  return { ouvert: true, ...acces, profil };
}

export async function espaceIntervenant(): Promise<Espace<ProfilIntervenant>> {
  const acces = await ouvrir("assignment:read:own");
  if ("refus" in acces) return { ouvert: false, refus: acces.refus };

  const profil = await acces.db.cleanerProfile.findFirst({
    where: { userId: acces.user.id },
    select: { id: true, displayName: true },
  });

  if (!profil) return { ouvert: false, refus: "SANS_PROFIL" };

  return { ouvert: true, ...acces, profil };
}
