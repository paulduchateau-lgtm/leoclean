import { describe, expect, it } from "vitest";

import {
  canonicalHost,
  hostOf,
  isAppPath,
  isIndexableHost,
  isNeutralPath,
  isProPath,
  porteLaCoqueVitrine,
} from "@/lib/hosting";

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
    "/mon-espace",
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

describe("hôtes indexables", () => {
  const PRODUCTION = { environnement: "production" as const, ...HOSTS };

  it("indexe les deux domaines de production", () => {
    expect(isIndexableHost(PRODUCTION, "leoclean.fr")).toBe(true);
    expect(isIndexableHost(PRODUCTION, "app.leoclean.fr")).toBe(true);
  });

  it("refuse l'indexation du domaine Vercel et des prévisualisations", () => {
    // Le doublon le plus coûteux : même contenu, même mots-clés, autre domaine.
    expect(isIndexableHost(PRODUCTION, "leoclean.vercel.app")).toBe(false);
    expect(isIndexableHost(PRODUCTION, "leoclean-git-refonte.vercel.app")).toBe(
      false,
    );
  });

  it("n'a pas d'opinion tant que l'origine canonique n'est pas configurée", () => {
    // Un oubli de variable ne doit pas mettre le site entier hors de l'index.
    const sansOrigine = {
      environnement: "production" as const,
      site: null,
      app: null,
    };
    expect(isIndexableHost(sansOrigine, "leoclean.fr")).toBe(true);
    expect(isIndexableHost(sansOrigine, "localhost:3000")).toBe(true);
  });

  it("indexe le développement, où la vitrine est son propre domaine", () => {
    const local = {
      environnement: "production" as const,
      site: "localhost:3000",
      app: null,
    };
    expect(isIndexableHost(local, "localhost:3000")).toBe(true);
  });

  it("refuse un environnement de test, fût-il sur son propre domaine déclaré", () => {
    /*
     * Le cas qui a motivé la déclaration d'environnement. La dev reçoit
     * `dev.leoclean.fr` et déclare cette origine : la comparaison des noms
     * d'hôte l'autoriserait, et le site se retrouverait dans l'index en double,
     * face à sa propre production, sur les requêtes qu'elle sert à gagner.
     */
    const dev = {
      environnement: "dev" as const,
      site: "dev.leoclean.fr",
      app: null,
    };
    expect(isIndexableHost(dev, "dev.leoclean.fr")).toBe(false);
  });

  it("refuse un environnement de test même sans origine configurée", () => {
    // La tolérance à l'oubli de variable ne vaut que pour la production.
    const dev = { environnement: "dev" as const, site: null, app: null };
    expect(isIndexableHost(dev, "dev.leoclean.fr")).toBe(false);
    expect(isIndexableHost(dev, "localhost:3000")).toBe(false);
  });
});

describe("face professionnelle", () => {
  const TROIS = {
    site: "leoclean.fr",
    app: "app.leoclean.fr",
    pro: "pro.leoclean.fr",
  };

  it.each([
    "/travailler-avec-nous",
    "/rejoindre",
    "/rejoindre/dossier",
    "/intervenant",
    "/intervenant/revenus",
  ])("range « %s » du côté professionnel", (path) => {
    expect(isProPath(path)).toBe(true);
    expect(canonicalHost(TROIS, "leoclean.fr", path)).toBe("pro.leoclean.fr");
  });

  it("ramène sur la vitrine ce qui n'est pas de son ressort", () => {
    // Le défaut le plus coûteux d'une table de routage est la boucle : on
    // vérifie donc les deux sens, comme pour l'application.
    expect(canonicalHost(TROIS, "pro.leoclean.fr", "/tarifs")).toBe(
      "leoclean.fr",
    );
    expect(canonicalHost(TROIS, "pro.leoclean.fr", "/reserver")).toBe(
      "app.leoclean.fr",
    );
    expect(
      canonicalHost(TROIS, "pro.leoclean.fr", "/travailler-avec-nous"),
    ).toBeNull();
  });

  it("ne redirige jamais la connexion, d'où qu'elle vienne", () => {
    // C'est ce qui donne à chaque face sa propre session. Rediriger
    // `/connexion` vers un hôte unique y déposerait le cookie, et l'autre face
    // ne le recevrait jamais — le cookie étant lié à l'hôte.
    for (const hote of ["leoclean.fr", "app.leoclean.fr", "pro.leoclean.fr"]) {
      expect(canonicalHost(TROIS, hote, "/connexion")).toBeNull();
      expect(
        canonicalHost(TROIS, hote, "/api/auth/callback/resend"),
      ).toBeNull();
    }
    expect(isNeutralPath("/connexion")).toBe(true);
    expect(isNeutralPath("/api/auth/callback/google")).toBe(true);
  });

  it("ne bouge rien tant que le sous-domaine n'est pas déclaré", () => {
    // Le repli est la partie qui compte : router vers un hôte qui n'existe
    // pas encore produirait un 308 vers un domaine introuvable — la panne déjà
    // vécue en production sur `NEXT_PUBLIC_APP_URL`. Sans `pro`, chaque chemin
    // retourne exactement là où il vivait la veille.
    const DEUX = { site: "leoclean.fr", app: "app.leoclean.fr", pro: null };

    expect(
      canonicalHost(DEUX, "leoclean.fr", "/travailler-avec-nous"),
    ).toBeNull();
    expect(canonicalHost(DEUX, "leoclean.fr", "/rejoindre")).toBeNull();
    expect(canonicalHost(DEUX, "leoclean.fr", "/intervenant")).toBe(
      "app.leoclean.fr",
    );
  });

  it("laisse la face professionnelle s'indexer", () => {
    expect(
      isIndexableHost(
        { environnement: "production", ...TROIS },
        "pro.leoclean.fr",
      ),
    ).toBe(true);
  });

  it("garde l'espace intervenant hors de la coque client", () => {
    // Il change d'hôte, pas de nature : c'est un espace connecté, où un seul
    // modèle de navigation doit régner.
    expect(isAppPath("/intervenant/revenus")).toBe(true);
  });
});

describe("coque de la vitrine", () => {
  /*
   * La barre d'onglets client proposait « Réserver » sous un tunnel de
   * candidature. Les deux prédicats se ressemblent assez pour qu'on les
   * confonde de nouveau : le test dit lequel répond à quoi.
   */
  it.each(["/reserver", "/mon-espace", "/intervenant", "/connexion"])(
    "retire la coque de « %s », comme un espace applicatif",
    (path) => {
      expect(porteLaCoqueVitrine(path)).toBe(false);
    },
  );

  it("retire la coque du tunnel de candidature sans en faire un chemin applicatif", () => {
    expect(porteLaCoqueVitrine("/rejoindre")).toBe(false);
    expect(porteLaCoqueVitrine("/rejoindre/dossier")).toBe(false);
    // Sans hôte `pro`, il reste servi par la vitrine et non par l'application.
    expect(isAppPath("/rejoindre")).toBe(false);
    expect(
      canonicalHost(
        { site: "leoclean.fr", app: "app.leoclean.fr" },
        "leoclean.fr",
        "/rejoindre",
      ),
    ).toBeNull();
  });

  it.each(["/", "/tarifs", "/leognan", "/travailler-avec-nous"])(
    "garde la coque sur « %s »",
    (path) => {
      expect(porteLaCoqueVitrine(path)).toBe(true);
    },
  );
});
