import { beforeEach, describe, expect, it } from "vitest";

import {
  MESSAGE_ECHEC,
  definirLeMotDePasse,
  fermerToutesLesSessions,
  lireLetatDeConnexion,
  retirerLeMotDePasse,
  verifierIdentifiants,
} from "@/lib/auth/identifiants";
import {
  DUREE_SESSION_SECONDES,
  creerSessionDeConnexion,
} from "@/lib/auth/session-connexion";
import { prisma } from "@/lib/db";

/**
 * La connexion par mot de passe écrit-elle une session **révocable** ?
 *
 * C'est la seule question qui compte ici, et elle mérite un test d'intégration
 * plutôt qu'un test unitaire. Auth.js n'écrit pas de session en base pour le
 * fournisseur `Credentials` : il bascule sur un jeton signé, quelle que soit la
 * stratégie déclarée. `authConfig.jwt.encode` intercepte cet encodage et crée
 * la ligne lui-même — un montage qui s'appuie sur un comportement interne, donc
 * exactement le genre de chose qui casse à une mise à jour, en silence.
 *
 * Si ce test échoue après un `npm update`, la conséquence n'est pas cosmétique :
 * les connexions par mot de passe deviendraient non révocables, et la
 * suspension d'un intervenant comme la suppression d'un compte au titre du RGPD
 * cesseraient de couper l'accès.
 */

const ADRESSE = "test-mot-de-passe@leoclean.test";
const MOT_DE_PASSE = "le chat dort sur le radiateur";

let userId: string;

beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: ADRESSE } });
  const utilisateur = await prisma.user.create({
    data: { email: ADRESSE, name: "Camille Test" },
    select: { id: true },
  });
  userId = utilisateur.id;
});

describe("session d'une connexion par mot de passe", () => {
  it("écrit une ligne Session, et non un jeton signé", async () => {
    const jeton = await creerSessionDeConnexion(userId);

    /*
     * Un JWT porte des points séparant ses segments. Le jeton rendu doit être
     * un identifiant de session ordinaire : c'est ce qui permet à l'adaptateur
     * de le résoudre et à une suppression de le révoquer.
     */
    expect(jeton).not.toContain(".");

    const session = await prisma.session.findUnique({
      where: { sessionToken: jeton },
      select: { userId: true, expires: true },
    });

    expect(session?.userId).toBe(userId);
    expect(session!.expires.getTime()).toBeGreaterThan(Date.now());
  });

  it("aligne sa durée sur celle des autres sessions", async () => {
    const maintenant = new Date("2026-08-20T10:00:00Z");
    const jeton = await creerSessionDeConnexion(userId, maintenant);

    const session = await prisma.session.findUniqueOrThrow({
      where: { sessionToken: jeton },
      select: { expires: true },
    });

    expect(session.expires.getTime() - maintenant.getTime()).toBe(
      DUREE_SESSION_SECONDES * 1000,
    );
  });

  /*
   * La garantie, en un test : la ligne se supprime, donc l'accès se coupe. Un
   * jeton signé, lui, resterait valide jusqu'à son expiration.
   */
  it("est révocable par suppression", async () => {
    const jeton = await creerSessionDeConnexion(userId);
    await prisma.session.delete({ where: { sessionToken: jeton } });

    await expect(
      prisma.session.findUnique({ where: { sessionToken: jeton } }),
    ).resolves.toBeNull();
  });
});

describe("verifierIdentifiants", () => {
  it("refuse un compte sans mot de passe", async () => {
    await expect(
      verifierIdentifiants(ADRESSE, MOT_DE_PASSE),
    ).resolves.toBeNull();
  });

  it("reconnaît le bon mot de passe", async () => {
    await definirLeMotDePasse(userId, MOT_DE_PASSE, null);
    const identite = await verifierIdentifiants(ADRESSE, MOT_DE_PASSE);
    expect(identite?.id).toBe(userId);
  });

  it("refuse un mot de passe faux", async () => {
    await definirLeMotDePasse(userId, MOT_DE_PASSE, null);
    await expect(
      verifierIdentifiants(ADRESSE, "le chien dort sur le radiateur"),
    ).resolves.toBeNull();
  });

  /* L'adresse est normalisée : personne ne tape sa casse à l'identique. */
  it("ignore la casse de l'adresse", async () => {
    await definirLeMotDePasse(userId, MOT_DE_PASSE, null);
    await expect(
      verifierIdentifiants(ADRESSE.toUpperCase(), MOT_DE_PASSE),
    ).resolves.not.toBeNull();
  });

  it("rend le même résultat pour une adresse inconnue", async () => {
    await expect(
      verifierIdentifiants("personne@leoclean.test", MOT_DE_PASSE),
    ).resolves.toBeNull();
    /* Le message d'échec est unique et ne nomme aucune des deux valeurs. */
    expect(MESSAGE_ECHEC).not.toMatch(
      /adresse inconnue|mot de passe incorrect/i,
    );
  });
});

describe("definirLeMotDePasse", () => {
  it("exige l'ancien pour en changer", async () => {
    await definirLeMotDePasse(userId, MOT_DE_PASSE, null);

    await expect(
      definirLeMotDePasse(userId, "une autre phrase entière", null),
    ).rejects.toThrow(/actuel/i);

    await expect(
      definirLeMotDePasse(userId, "une autre phrase entière", MOT_DE_PASSE),
    ).resolves.toBeUndefined();
  });

  it("applique la politique", async () => {
    await expect(definirLeMotDePasse(userId, "court", null)).rejects.toThrow(
      /caractères/i,
    );
  });

  it("journalise, parce qu'un changement d'identifiant se relit", async () => {
    await definirLeMotDePasse(userId, MOT_DE_PASSE, null);
    const trace = await prisma.auditLog.findFirst({
      where: { actorUserId: userId, action: "user.password.set" },
    });
    expect(trace).not.toBeNull();
  });
});

describe("retirerLeMotDePasse", () => {
  it("ramène le compte au lien de connexion seul", async () => {
    await definirLeMotDePasse(userId, MOT_DE_PASSE, null);
    await retirerLeMotDePasse(userId, MOT_DE_PASSE);

    const etat = await lireLetatDeConnexion(userId);
    expect(etat.aUnMotDePasse).toBe(false);
    expect(etat.motDePasseDepuis).toBeNull();
  });

  /*
   * Retirer son mot de passe n'est pas un signal de compromission : déconnecter
   * quelqu'un de tous ses appareils parce qu'il simplifie sa connexion serait
   * une punition sans motif.
   */
  it("ne révoque pas les sessions ouvertes", async () => {
    await definirLeMotDePasse(userId, MOT_DE_PASSE, null);
    await prisma.session.create({
      data: {
        sessionToken: "jeton-de-test-retrait",
        userId,
        expires: new Date(Date.now() + 86_400_000),
      },
    });

    await retirerLeMotDePasse(userId, MOT_DE_PASSE);

    expect(await prisma.session.count({ where: { userId } })).toBe(1);
  });
});

describe("fermerToutesLesSessions", () => {
  it("emporte la session en cours avec les autres", async () => {
    await prisma.session.createMany({
      data: [1, 2, 3].map((numero) => ({
        sessionToken: `jeton-de-test-${numero}`,
        userId,
        expires: new Date(Date.now() + 86_400_000),
      })),
    });

    await expect(fermerToutesLesSessions(userId)).resolves.toBe(3);
    expect(await prisma.session.count({ where: { userId } })).toBe(0);
  });
});
