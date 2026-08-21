import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Ce que l'espace client n'a pas le droit d'exiger.
 *
 * Le défaut qu'on garde ici a été trouvé en production sur `dev.leoclean.fr` :
 * chaque page bâtie sur `espaceClient()` répondait « cet espace n'est pas le
 * vôtre » à un vrai client. La cause était `requireOrganization`, qui exige une
 * `Membership` portant la capacité demandée — **et un client de la marketplace
 * n'en a aucune**, son compte se créant à la réservation sans appartenance.
 *
 * Il ne s'était pas vu parce que les comptes de test en portent une, et parce
 * que `/mon-espace` lit ses réservations par un autre chemin. Autrement dit :
 * la seule façon de le rencontrer était d'être un client ordinaire.
 *
 * On lit la source plutôt que le comportement : ce qu'on interdit est une
 * dépendance, et elle se réintroduit d'une ligne, sans qu'aucun test de
 * comportement écrit avec un compte de test ne s'en aperçoive.
 */

const SOURCE = readFileSync(new URL("./espaces.ts", import.meta.url), "utf8");

/** Le corps d'une fonction exportée, jusqu'à l'accolade fermante de colonne 0. */
function corpsDe(nom: string): string {
  const debut = SOURCE.indexOf(`export async function ${nom}(`);
  expect(debut, `${nom} introuvable`).toBeGreaterThan(-1);
  const fin = SOURCE.indexOf("\n}", debut);
  return SOURCE.slice(debut, fin);
}

describe("espace client", () => {
  it("n'exige aucune appartenance", () => {
    // `requireOrganization` lève `ForbiddenError` sans `Membership`. L'appeler
    // ici ferme l'espace à exactement les gens à qui il est destiné.
    expect(corpsDe("espaceClient")).not.toContain("requireOrganization");
    expect(corpsDe("espaceClient")).not.toContain("ouvrir(");
  });

  it("résout le profil depuis la session, jamais depuis une entrée", () => {
    // C'est ce qui remplace la vérification de droit : on ne lit que les
    // lignes du profil rattaché à la session, sur un client déjà cloisonné à
    // l'organisation. Un identifiant reçu du navigateur n'y a aucune part.
    const corps = corpsDe("espaceClient");

    expect(corps).toContain("getCurrentUser()");
    expect(corps).toContain("forOrganization(");
    expect(corps).toContain("userId: user.id");
  });

  it("laisse l'espace intervenant sur son contrôle de capacité", () => {
    // Un intervenant, lui, **a** une appartenance : c'est elle qui porte
    // `assignment:read:own`, et la retirer ouvrirait l'espace à quiconque a un
    // profil. Les deux espaces ne se ressemblent pas, et c'est voulu.
    expect(corpsDe("espaceIntervenant")).toContain("assignment:read:own");
  });
});
