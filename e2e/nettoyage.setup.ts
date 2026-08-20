/*
 * Playwright ne charge pas `.env` : il lance le serveur en sous-processus,
 * mais ce fichier-ci tourne dans son propre contexte et doit ouvrir sa propre
 * connexion.
 */
import "dotenv/config";

import { test as nettoyage } from "@playwright/test";

import { hacher } from "@/lib/auth/mot-de-passe";
import { prisma } from "@/lib/db";

import { COMPTE_MOT_DE_PASSE, DOMAINE_DE_TEST } from "./comptes";

/**
 * Nettoyage des réservations écrites par les tests.
 *
 * Le parcours complet de bout en bout **réserve réellement** : c'est tout son
 * intérêt, et c'est aussi ce qui rend la suite non répétable. Chaque exécution
 * consomme un créneau chez un intervenant du jeu de données, et au bout d'une
 * dizaine de passages il n'en reste plus à Léognan pour une mission de trois
 * heures — le test échoue alors sur « aucun créneau », c'est-à-dire pour une
 * bonne raison, ce qui en fait un mauvais test.
 *
 * Le nettoyage ne vise que ce qu'il a créé : les comptes du domaine
 * `@leoclean.test`, qu'aucun humain ne peut posséder. Il ne touche ni au seed,
 * ni aux profils créés à la main, ni au travail d'une autre session sur la
 * même base — c'est la raison pour laquelle il filtre sur l'email plutôt que
 * de tronquer des tables comme le font les tests d'intégration.
 *
 * Il tourne **avant** la suite et non après : un échec en cours de route
 * laisserait sinon la base dans l'état qui l'a provoqué, et l'exécution
 * suivante partirait du même mauvais pied.
 */

/**
 * Fixtures du formulaire de rappel.
 *
 * Elles n'ont ni compte ni email — l'un des tests vérifie précisément que le
 * formulaire aboutit sans adresse — donc rien ne les rattache au domaine de
 * test, et la cascade ne les emporte pas. Elles s'accumulaient à raison de
 * trois par exécution, et finissaient par noyer les vraies demandes dans le
 * back-office, où elles réclament un rappel dans la journée.
 *
 * Le couple nom + téléphone est recopié depuis `pre-reservation.spec.ts` : le
 * ciblage est étroit à dessein, pour qu'une demande réelle ne puisse jamais
 * être emportée par le nettoyage.
 */
const DEMANDES_DE_TEST = [
  { name: "Claire Dubourg", phone: "0612345678" },
  { name: "Damien Lafitte", phone: "0684363862" },
];

nettoyage("efface les réservations des exécutions précédentes", async () => {
  const demandes = await prisma.lead.deleteMany({
    where: {
      OR: DEMANDES_DE_TEST.map((demande) => ({ ...demande, email: null })),
    },
  });
  if (demandes.count > 0) {
    console.log(
      `Nettoyage : ${demandes.count} demande(s) de rappel de test effacée(s).`,
    );
  }

  const comptes = await prisma.user.findMany({
    where: { email: { endsWith: DOMAINE_DE_TEST } },
    select: { id: true },
  });

  if (comptes.length === 0) {
    await prisma.$disconnect();
    return;
  }

  const identifiants = comptes.map((compte) => compte.id);

  /*
   * Les réservations, les affectations et les adresses disparaissent en
   * cascade avec le profil client : le schéma le garantit, et s'en remettre à
   * lui vaut mieux qu'une suite de suppressions à tenir à jour.
   */
  await prisma.clientProfile.deleteMany({
    where: { userId: { in: identifiants } },
  });
  await prisma.user.deleteMany({ where: { id: { in: identifiants } } });

  console.log(
    `Nettoyage : ${comptes.length} compte(s) de test et leurs réservations effacés.`,
  );

  await prisma.$disconnect();
});

/**
 * Remet à zéro les compteurs de limitation de débit.
 *
 * Deux scénarios de la suite se trompent **volontairement** de mot de passe,
 * pour vérifier que le message ne distingue pas l'adresse inconnue du mot de
 * passe faux. Chacun consomme un jeton du compteur d'échecs — quatre par
 * exécution, deux projets compris, et davantage avec les reprises de la CI.
 *
 * Au bout de quelques exécutions le quota tombe, et c'est le scénario de
 * connexion **réussie** qui échoue : un test rouge pour une bonne raison, ce
 * qui en fait un mauvais test. On repart donc d'un compteur vide, comme on
 * repart d'une base sans réservations de test.
 */
nettoyage("remet à zéro la limitation de débit", async () => {
  const { count } = await prisma.rateLimit.deleteMany({
    where: { key: { startsWith: "connexion-" } },
  });
  if (count > 0) {
    console.log(`Nettoyage : ${count} compteur(s) de connexion remis à zéro.`);
  }
  await prisma.$disconnect();
});

nettoyage("prépare un compte avec mot de passe", async () => {
  await prisma.user.upsert({
    where: { email: COMPTE_MOT_DE_PASSE.email },
    update: { passwordHash: await hacher(COMPTE_MOT_DE_PASSE.motDePasse) },
    create: {
      email: COMPTE_MOT_DE_PASSE.email,
      name: "Camille Connexion",
      emailVerified: new Date(),
      passwordHash: await hacher(COMPTE_MOT_DE_PASSE.motDePasse),
      passwordUpdatedAt: new Date(),
    },
  });

  await prisma.$disconnect();
});
