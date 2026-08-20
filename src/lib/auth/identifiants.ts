import "server-only";

import { prisma } from "@/lib/db";

import {
  MESSAGES_REFUS,
  aReencoder,
  empreinteFactice,
  hacher,
  verifier,
  verifierMotDePasse,
} from "./mot-de-passe";

/**
 * Identifiants : ce qui touche à la base.
 *
 * `mot-de-passe.ts` décide et dérive, ce module lit et écrit. La séparation
 * n'est pas décorative : elle permet de tester la politique et la
 * cryptographie sans base, et c'est précisément la partie qu'on ne veut pas
 * découvrir fausse en production.
 */

export class IdentifiantsRefusesError extends Error {}

/**
 * Le message d'un échec de connexion, toujours le même.
 *
 * Il ne dit **jamais** laquelle des deux valeurs est fausse, ni si l'adresse
 * existe. Répondre différemment transformerait le formulaire en outil
 * d'énumération de comptes — le même raisonnement qui gouverne déjà la demande
 * de lien magique.
 */
export const MESSAGE_ECHEC =
  "Cette adresse et ce mot de passe ne correspondent à aucun compte.";

export interface IdentiteVerifiee {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Vérifie un couple adresse / mot de passe.
 *
 * **Le temps de réponse ne dépend pas de l'existence du compte.** Quand
 * l'adresse est inconnue, ou qu'elle n'a pas de mot de passe, on dérive quand
 * même contre une empreinte factice : sans cela, une réponse instantanée d'un
 * côté et soixante millisecondes de l'autre suffiraient à énumérer les comptes,
 * ce que le message identique s'efforce d'empêcher.
 */
export async function verifierIdentifiants(
  email: string,
  motDePasse: string,
): Promise<IdentiteVerifiee | null> {
  const adresse = email.trim().toLowerCase();

  const utilisateur = await prisma.user.findUnique({
    where: { email: adresse },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
    },
  });

  const empreinte = utilisateur?.passwordHash ?? (await empreinteFactice());
  const correspond = await verifier(motDePasse, empreinte);

  if (!utilisateur?.passwordHash || !correspond) return null;

  /*
   * Le mot de passe en clair n'est disponible qu'ici, à la connexion : c'est
   * donc la seule occasion de durcir les paramètres sans rien demander à
   * personne. L'échec est avalé — un réencodage raté ne doit pas refuser une
   * connexion par ailleurs valide.
   */
  if (aReencoder(utilisateur.passwordHash)) {
    try {
      await prisma.user.update({
        where: { id: utilisateur.id },
        data: { passwordHash: await hacher(motDePasse) },
      });
    } catch (erreur) {
      console.error("Réencodage du mot de passe impossible", erreur);
    }
  }

  return {
    id: utilisateur.id,
    email: utilisateur.email,
    name: utilisateur.name,
  };
}

/**
 * Définit ou remplace le mot de passe d'un compte.
 *
 * **Aucun mot de passe actuel n'est demandé pour en définir un premier** : la
 * session prouve déjà qu'on reçoit les emails de l'adresse, ce qui est
 * exactement le niveau de preuve d'un lien magique. En revanche, **remplacer un
 * mot de passe existant exige l'ancien** — sinon un poste laissé ouvert dans un
 * café permettrait à quelqu'un de verrouiller le compte de son propriétaire.
 */
export async function definirLeMotDePasse(
  userId: string,
  nouveau: string,
  actuel: string | null,
): Promise<void> {
  const utilisateur = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, name: true, passwordHash: true },
  });

  if (utilisateur.passwordHash) {
    if (!actuel || !(await verifier(actuel, utilisateur.passwordHash))) {
      throw new IdentifiantsRefusesError(
        "Votre mot de passe actuel ne correspond pas.",
      );
    }
  }

  const refus = verifierMotDePasse(nouveau, {
    email: utilisateur.email,
    nom: utilisateur.name,
  });
  if (refus) throw new IdentifiantsRefusesError(MESSAGES_REFUS[refus]);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: utilisateur.id },
      data: {
        passwordHash: await hacher(nouveau),
        passwordUpdatedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: utilisateur.id,
        action: utilisateur.passwordHash
          ? "user.password.changed"
          : "user.password.set",
        entityType: "User",
        entityId: utilisateur.id,
      },
    });
  });
}

/**
 * Retire le mot de passe.
 *
 * Le compte revient au lien de connexion seul, qui n'a jamais cessé de
 * fonctionner. On exige quand même le mot de passe actuel : retirer un verrou
 * est un acte à protéger autant que le poser.
 *
 * **Les sessions ne sont pas révoquées ici.** Retirer son mot de passe n'est
 * pas un signal de compromission — c'est un choix de commodité — et déconnecter
 * quelqu'un de tous ses appareils parce qu'il simplifie sa connexion serait une
 * punition sans motif. La révocation reste au bouton qui la nomme.
 */
export async function retirerLeMotDePasse(
  userId: string,
  actuel: string,
): Promise<void> {
  const utilisateur = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });

  if (
    !utilisateur.passwordHash ||
    !(await verifier(actuel, utilisateur.passwordHash))
  ) {
    throw new IdentifiantsRefusesError(
      "Votre mot de passe actuel ne correspond pas.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: utilisateur.id },
      data: { passwordHash: null, passwordUpdatedAt: null },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: utilisateur.id,
        action: "user.password.removed",
        entityType: "User",
        entityId: utilisateur.id,
      },
    });
  });
}

export interface EtatConnexion {
  aUnMotDePasse: boolean;
  motDePasseDepuis: string | null;
  /** Fournisseurs sociaux rattachés — `google`, `apple`… */
  comptesLies: string[];
  /** Sessions ouvertes, celle en cours comprise. */
  sessionsOuvertes: number;
}

export async function lireLetatDeConnexion(
  userId: string,
): Promise<EtatConnexion> {
  const utilisateur = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      passwordHash: true,
      passwordUpdatedAt: true,
      accounts: { select: { provider: true } },
      _count: { select: { sessions: true } },
    },
  });

  return {
    /*
     * On rend un booléen, jamais l'empreinte : une empreinte qui traverse une
     * frontière est une empreinte qu'on peut attaquer hors ligne, et rien à
     * l'écran n'en a besoin.
     */
    aUnMotDePasse: utilisateur.passwordHash !== null,
    motDePasseDepuis: utilisateur.passwordUpdatedAt?.toISOString() ?? null,
    comptesLies: utilisateur.accounts.map((compte) => compte.provider),
    sessionsOuvertes: utilisateur._count.sessions,
  };
}

/**
 * Ferme toutes les sessions.
 *
 * C'est le geste qui donne son sens aux sessions en base : un jeton signé ne se
 * révoque pas avant son expiration, une ligne se supprime. La session en cours
 * part avec les autres — quelqu'un qui clique « déconnecter partout » depuis un
 * appareil dont il doute veut précisément que celui-ci soit inclus.
 */
export async function fermerToutesLesSessions(userId: string): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { userId } });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      action: "user.sessions.revoked",
      entityType: "User",
      entityId: userId,
      metadata: { sessions: count },
    },
  });

  return count;
}
