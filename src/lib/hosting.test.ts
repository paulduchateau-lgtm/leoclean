import { describe, expect, it } from "vitest";

import { canonicalHost, hostOf, isAppPath } from "@/lib/hosting";

/**
 * Répartition entre la vitrine et l'application.
 *
 * Ce qui se vérifie ici est une table de routage, et son défaut le plus
 * coûteux serait une boucle : un chemin renvoyé d'un hôte à l'autre
 * indéfiniment. D'où les allers-retours testés dans les deux sens.
 */

const HOSTS = { site: "leoclean.fr", app: "app.leoclean.fr" };

describe("appartenance d'un chemin", () => {
  it.each([
    "/reserver",
    "/reserver?commune=leognan",
    "/connexion",
    "/connexion/verification",
    "/mon-compte",
    "/intervenant/missions",
    "/api/auth/callback/resend",
  ])("range « %s » du côté de l'application", (path) => {
    expect(isAppPath(path.split("?")[0]!)).toBe(true);
  });

  it.each([
    "/",
    "/menage-a-domicile/leognan",
    "/tarifs",
    "/blog/prix-menage-a-domicile-sud-bordeaux",
    "/etre-rappele",
    "/api/public/informations",
    "/robots.txt",
    "/sitemap.xml",
    "/llms.txt",
  ])("range « %s » du côté de la vitrine", (path) => {
    expect(isAppPath(path)).toBe(false);
  });

  it("ne confond pas un préfixe avec un début de mot", () => {
    // `/reservations-anciennes` n'est pas `/reserver`.
    expect(isAppPath("/reservations-anciennes")).toBe(false);
    expect(isAppPath("/mon-compte-client")).toBe(false);
  });
});

describe("hôte canonique", () => {
  it("envoie le tunnel sur l'application", () => {
    expect(canonicalHost(HOSTS, "leoclean.fr", "/reserver")).toBe(
      "app.leoclean.fr",
    );
  });

  it("renvoie une page publique sur la vitrine", () => {
    expect(canonicalHost(HOSTS, "app.leoclean.fr", "/tarifs")).toBe(
      "leoclean.fr",
    );
  });

  it("ne déplace pas ce qui est déjà au bon endroit", () => {
    expect(canonicalHost(HOSTS, "leoclean.fr", "/tarifs")).toBeNull();
    expect(canonicalHost(HOSTS, "app.leoclean.fr", "/reserver")).toBeNull();
  });

  it("ne boucle jamais : la destination est toujours stable", () => {
    for (const path of ["/reserver", "/tarifs", "/", "/api/auth/session"]) {
      for (const from of ["leoclean.fr", "app.leoclean.fr"]) {
        const first = canonicalHost(HOSTS, from, path);
        if (first === null) continue;
        // Une seconde évaluation depuis la destination ne doit plus rien
        // proposer : sans cela, les deux hôtes se renverraient la requête.
        expect(canonicalHost(HOSTS, first, path)).toBeNull();
      }
    }
  });

  it("se tait hors production", () => {
    // Un seul domaine, une origine absente, un hôte inconnu : dans les trois
    // cas le site tourne sur un domaine unique, comme avant.
    expect(
      canonicalHost(
        { site: "leoclean.fr", app: "leoclean.fr" },
        "leoclean.fr",
        "/reserver",
      ),
    ).toBeNull();
    expect(
      canonicalHost({ site: null, app: null }, "leoclean.fr", "/reserver"),
    ).toBeNull();
    expect(canonicalHost(HOSTS, "localhost:3000", "/reserver")).toBeNull();
    expect(
      canonicalHost(HOSTS, "leoclean-git-refonte.vercel.app", "/reserver"),
    ).toBeNull();
  });
});

describe("lecture d'une origine", () => {
  it("en extrait l'hôte, port compris", () => {
    expect(hostOf("https://leoclean.fr")).toBe("leoclean.fr");
    expect(hostOf("https://app.leoclean.fr/")).toBe("app.leoclean.fr");
    expect(hostOf("http://localhost:3000")).toBe("localhost:3000");
  });

  it("renonce plutôt que de lever sur une origine illisible", () => {
    expect(hostOf(undefined)).toBeNull();
    expect(hostOf("")).toBeNull();
    expect(hostOf("pas-une-url")).toBeNull();
  });
});
