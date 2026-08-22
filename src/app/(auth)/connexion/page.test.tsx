import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Ce que la page de connexion doit faire d'une session déjà ouverte.
 *
 * Le défaut gardé ici a été trouvé en production : la redirection du visiteur
 * déjà connecté était écrite **avant** la lecture de `callbackUrl`, si bien
 * qu'elle envoyait tout le monde à l'accueil. Quelqu'un qui cliquait
 * « J'ai déjà un compte » depuis la face pro atterrissait sur la vitrine
 * client, sans rien comprendre.
 *
 * Le cas est le plus fréquent qui soit : les trois portes du site — espace
 * client, espace pro, lien magique — visent toutes `/connexion?callbackUrl=…`
 * précisément pour qu'une seule adresse serve le visiteur connecté comme
 * l'autre.
 *
 * On lit la source plutôt que le rendu : ce qu'on protège est un **ordre**, et
 * un ordre se casse en déplaçant une ligne, sans qu'aucun rendu ne change tant
 * qu'on ne teste pas avec une session.
 */

const SOURCE = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("connexion — visiteur déjà connecté", () => {
  it("lit la destination avant de rediriger", () => {
    const destination = SOURCE.indexOf("const callbackUrl =");
    const redirection = SOURCE.indexOf("if (await getCurrentUser())");

    expect(destination).toBeGreaterThan(-1);
    expect(redirection).toBeGreaterThan(-1);
    expect(
      redirection,
      "la redirection doit venir après la lecture de callbackUrl",
    ).toBeGreaterThan(destination);
  });

  it("ne renvoie jamais à l'accueil en dur", () => {
    // `redirect("/")` ici est exactement le défaut : la valeur de repli est
    // déjà portée par `callbackUrl`, qui vaut « / » quand rien n'est demandé.
    expect(SOURCE).not.toMatch(/redirect\(\s*"\/"\s*\)/);
    expect(SOURCE).toContain("redirect(callbackUrl)");
  });

  it("n'accepte qu'un chemin interne comme destination", () => {
    // Une URL absolue ferait de la connexion une redirection ouverte.
    expect(SOURCE).toContain('candidate?.startsWith("/")');
    expect(SOURCE).toContain('!candidate.startsWith("//")');
  });
});
