import { expect, test } from "@playwright/test";

/**
 * Site public.
 *
 * L'acquisition passe par le référencement : ce qui est vérifié ici n'est pas
 * l'esthétique mais ce dont dépendent les moteurs et les modèles de langage —
 * un titre unique, un contenu réellement distinct d'une commune à l'autre, un
 * balisage exploitable, et des fichiers machine cohérents avec les pages.
 */

/**
 * Les seize communes desservies. La liste est recopiée plutôt qu'importée :
 * un test de bout en bout qui lirait la même constante que la page ne
 * détecterait pas une page manquante, seulement une incohérence interne.
 */
const COMMUNES = [
  "villenave-d-ornon",
  "gradignan",
  "cestas",
  "leognan",
  "cadaujac",
  "la-brede",
  "saint-selve",
  "martillac",
  "saucats",
  "saint-medard-d-eyrans",
  "castres-gironde",
  "beautiran",
  "cabanac-et-villagrains",
  "saint-morillon",
  "ayguemorte-les-graves",
  "isle-saint-georges",
];

test.describe("pages par commune", () => {
  test("chaque commune a un titre et une description qui lui sont propres", async ({
    page,
  }) => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();

    for (const commune of COMMUNES) {
      await page.goto(`/menage-a-domicile/${commune}`);
      titles.add(await page.title());
      descriptions.add(
        (await page
          .locator('meta[name="description"]')
          .getAttribute("content")) ?? "",
      );
    }

    // Des titres dupliqués signaleraient des pages satellites.
    expect(titles.size).toBe(COMMUNES.length);
    expect(descriptions.size).toBe(COMMUNES.length);
  });

  test("le corps de page diffère réellement d'une commune à l'autre", async ({
    page,
  }) => {
    await page.goto("/menage-a-domicile/martillac");
    const martillac = await page.locator("main").innerText();
    await page.goto("/menage-a-domicile/isle-saint-georges");
    const isle = await page.locator("main").innerText();

    expect(martillac).toContain("8 min");
    expect(isle).toContain("18 min");
    expect(martillac).not.toBe(isle);
  });

  test("expose un balisage structuré exploitable", async ({ page }) => {
    await page.goto("/menage-a-domicile/leognan");

    const raw = await page
      .locator('script[type="application/ld+json"]')
      .innerText();
    const data = JSON.parse(raw) as { "@type": string }[];
    const types = data.map((entry) => entry["@type"]);

    expect(types).toContain("HomeAndConstructionBusiness");
    expect(types).toContain("Service");
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("FAQPage");
  });

  test("affiche les tarifs dans un tableau sémantique", async ({ page }) => {
    await page.goto("/menage-a-domicile/cadaujac");

    const table = page.locator("table").first();
    await expect(table).toBeVisible();
    await expect(table.getByText("29 €/h")).toBeVisible();
  });

  test("ne mentionne pas le crédit d'impôt sans déclaration SAP", async ({
    page,
  }) => {
    // Communiquer sur l'avantage fiscal sans être déclaré expose à une
    // sanction : l'affichage est conditionné, pas seulement le calcul.
    await page.goto("/menage-a-domicile/leognan");
    await expect(page.getByText("Après crédit d'impôt")).toHaveCount(0);
  });

  test("renvoie 404 sur une commune non publiée", async ({ page }) => {
    const response = await page.goto("/menage-a-domicile/bordeaux");
    expect(response?.status()).toBe(404);
  });
});

test.describe("fichiers machine", () => {
  test("robots.txt autorise les robots des modèles de langage", async ({
    request,
  }) => {
    const body = await (await request.get("/robots.txt")).text();

    for (const bot of [
      "GPTBot",
      "ClaudeBot",
      "PerplexityBot",
      "Google-Extended",
    ]) {
      expect(body).toContain(bot);
    }
    expect(body).toContain("Disallow: /mon-compte");
  });

  test("llms.txt annonce les mêmes tarifs que les pages", async ({
    request,
  }) => {
    // Les montants sont formatés avec une espace fine insécable, typographie
    // française correcte ; on la normalise pour écrire une attente lisible.
    const body = (await (await request.get("/llms.txt")).text()).replace(
      /[\u202f\u00a0]/g,
      " ",
    );

    expect(body).toContain("29 €/h");
    expect(body).toContain("33 €/h");
    expect(body).toContain("16 communes");
    expect(body).toContain("06 84 36 38 62");
  });

  test("l'API publique expose la zone et les tarifs", async ({ request }) => {
    const response = await request.get("/api/public/informations");
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.zoneIntervention.nombreCommunes).toBe(16);
    expect(data.zoneIntervention.populationDesservie).toBe(133834);
    expect(data.tarifs.formules[0].tarifHoraireEuros).toBe(29);
  });

  test("le sitemap référence chaque commune publiée", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();

    for (const commune of COMMUNES) {
      expect(body).toContain(`/menage-a-domicile/${commune}`);
    }
  });
});

test.describe("blog", () => {
  test("liste les articles et les rend lisibles", async ({ page }) => {
    await page.goto("/blog");
    const links = page.locator('main a[href^="/blog/"]');
    await expect(links.first()).toBeVisible();

    await page.goto("/blog/prix-menage-a-domicile-sud-bordeaux");
    await expect(page.locator("h1")).toContainText("Combien coûte");
    await expect(page.locator("table").first()).toBeVisible();
  });

  test("balise les articles en Article et FAQPage", async ({ page }) => {
    await page.goto("/blog/duree-menage-maison-100m2");

    const raw = await page
      .locator('script[type="application/ld+json"]')
      .innerText();
    const types = (JSON.parse(raw) as { "@type": string }[]).map(
      (entry) => entry["@type"],
    );

    expect(types).toContain("Article");
    expect(types).toContain("FAQPage");
    expect(types).toContain("BreadcrumbList");
  });

  test("garde hors ligne l'article sur le crédit d'impôt", async ({ page }) => {
    // Tant que la déclaration SAP n'est pas obtenue, l'article n'existe pas —
    // ni dans la liste, ni à son URL propre.
    await page.goto("/blog");
    await expect(page.getByText("Crédit d'impôt")).toHaveCount(0);

    const response = await page.goto("/blog/credit-impot-menage-a-domicile");
    expect(response?.status()).toBe(404);
  });
});

test.describe("intentions secondaires", () => {
  test("répond à une autre question que la page commune", async ({ page }) => {
    await page.goto("/menage-a-domicile/leognan");
    const commune = await page.locator("main").innerText();

    await page.goto("/femme-de-menage/leognan");
    const femme = await page.locator("main").innerText();
    await expect(page.locator("h1")).toContainText("Femme de ménage à Léognan");

    await page.goto("/repassage/leognan");
    const repassage = await page.locator("main").innerText();
    await expect(page.locator("h1")).toContainText("Repassage");

    // Trois pages sur la même commune : trois contenus réellement distincts.
    expect(new Set([commune, femme, repassage]).size).toBe(3);
    expect(femme).toContain("CESU");
    expect(repassage).toContain("corbeille");
  });

  test("redirige en 301 les pages d'intention retirées", async ({ page }) => {
    /*
     * Ces six URL étaient indexables avant la réduction du 16 août 2026 : les
     * laisser répondre 404 perdrait sèchement ce qu'elles avaient acquis. La
     * redirection permanente transmet ce capital à la page commune, qui traite
     * le même lieu et existe toujours.
     */
    for (const [ancienne, nouvelle] of [
      ["/femme-de-menage/cestas", "/menage-a-domicile/cestas"],
      ["/femme-de-menage/la-brede", "/menage-a-domicile/la-brede"],
      ["/repassage/martillac", "/menage-a-domicile/martillac"],
    ]) {
      const response = await page.goto(ancienne!);
      expect(new URL(page.url()).pathname, ancienne).toBe(nouvelle);
      expect(response?.status(), ancienne).toBe(200);
    }
  });

  test("ne publie plus que trois communes par intention", async ({
    request,
  }) => {
    // Trois pages fortes valent mieux que six tièdes : le relevé de
    // duplication les donnait à 84 % identiques entre elles.
    const body = await (await request.get("/sitemap.xml")).text();
    const femme = body.match(/\/femme-de-menage\//g) ?? [];
    const repassage = body.match(/\/repassage\//g) ?? [];

    expect(femme).toHaveLength(3);
    expect(repassage).toHaveLength(3);
    expect(body).toContain("/femme-de-menage/leognan");
    expect(body).toContain("/repassage/leognan");
  });

  test("renvoie 404 là où l'intention n'est pas publiée", async ({ page }) => {
    // Le déploiement est volontairement restreint : une commune sans contenu
    // propre ne doit pas produire une page vide, mais rien du tout.
    const response = await page.goto("/repassage/isle-saint-georges");
    expect(response?.status()).toBe(404);
  });
});

test.describe("cartes de partage", () => {
  /**
   * Ce que voit quelqu'un à qui l'on envoie un lien dans WhatsApp.
   *
   * Deux défauts se ressemblent et coûtent la même chose : pas d'image du
   * tout — le lien s'affiche en ligne de texte grise — et une image présente
   * mais rattachée à la mauvaise URL, auquel cas tous les partages du site se
   * consolident sur l'accueil.
   */
  const PAGES = ["/", "/tarifs", "/menage-a-domicile/leognan"];

  test("chaque page annonce sa propre URL de partage", async ({ page }) => {
    const urls = new Set<string>();

    for (const path of PAGES) {
      await page.goto(path);
      const url = await page
        .locator('meta[property="og:url"]')
        .getAttribute("content");
      expect(url, `og:url manquant sur ${path}`).toBeTruthy();
      expect(url).toMatch(/^https?:\/\//);
      urls.add(url!);

      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute("href");
      // `canonical` et `og:url` désignent la même page, toujours.
      expect(canonical, `canonical manquant sur ${path}`).toBeTruthy();
      expect(new URL(url!).pathname).toBe(new URL(canonical!).pathname);
    }

    expect(urls.size).toBe(PAGES.length);
  });

  test("chaque page porte une image de partage servie", async ({
    page,
    request,
  }) => {
    for (const path of PAGES) {
      await page.goto(path);
      const image = await page
        .locator('meta[property="og:image"]')
        .getAttribute("content");
      expect(image, `og:image manquant sur ${path}`).toBeTruthy();

      const response = await request.get(image!);
      expect(response.status(), `image injoignable pour ${path}`).toBe(200);
      expect(response.headers()["content-type"]).toContain("image/png");
    }
  });

  test("la carte d'une commune lui est propre", async ({ page }) => {
    await page.goto("/menage-a-domicile/gradignan");
    const gradignan = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content");

    await page.goto("/menage-a-domicile/cestas");
    const cestas = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content");

    expect(gradignan).not.toBe(cestas);
  });

  test("demande une vignette pleine largeur", async ({ page }) => {
    // En `summary`, X recadre la carte en carré de 144 pixels : ni le nom de
    // la commune ni le tarif n'y seraient lisibles.
    await page.goto("/");
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
  });
});

test.describe("maillage interne", () => {
  /**
   * Le pied de page exposait quarante liens depuis chaque page : l'autorité
   * s'y répartissait en parts si petites qu'aucune page locale n'en
   * bénéficiait. Ce qui se vérifie ici est la concentration, pas l'esthétique.
   */
  test("le pied de page ne dilue plus", async ({ page }) => {
    await page.goto("/menage-a-domicile/leognan");
    const liens = page.locator("footer a");
    // Six communes, la page pivot, quelques pages de contenu, le téléphone et
    // l'email : on reste très en deçà des quarante d'avant.
    expect(await liens.count()).toBeLessThanOrEqual(15);

    await expect(
      page.getByRole("link", { name: /16 communes desservies/ }).first(),
    ).toBeVisible();
  });

  test("chaque page commune lie vers ses voisines, pas vers les quinze autres", async ({
    page,
  }) => {
    await page.goto("/menage-a-domicile/martillac");
    const section = page.locator("main section", {
      has: page.getByRole("heading", { name: /Autour de Martillac/ }),
    });

    const voisines = section.locator("a[href^='/menage-a-domicile/']");
    expect(await voisines.count()).toBe(3);
    await expect(section).toContainText("Saint-Médard-d'Eyrans");
    await expect(section).not.toContainText("Villenave-d'Ornon");
  });

  test("la page pivot porte le maillage exhaustif", async ({ page }) => {
    await page.goto("/zones-desservies");

    const lignes = page.locator("main table tbody tr");
    expect(await lignes.count()).toBe(16);

    // Les seize communes y figurent, et celles qui ont une page y sont liées.
    for (const commune of COMMUNES) {
      await expect(
        page.locator(`main a[href="/menage-a-domicile/${commune}"]`),
      ).toHaveCount(1);
    }
  });

  test("la page pivot est au sitemap", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();
    expect(body).toContain("/zones-desservies");
  });
});

test.describe("données structurées", () => {
  test("déclare la durée minimale avec le tarif", async ({ page }) => {
    // Un prix horaire seul laisse croire qu'une heure suffit, alors que le
    // minimum facturé est de deux.
    await page.goto("/tarifs");

    const raw = await page
      .locator('script[type="application/ld+json"]')
      .innerText();
    const data = JSON.parse(raw) as Record<string, unknown>[];

    const service = data.find((entry) => entry["@type"] === "Service");
    const offers = service?.offers as { eligibleQuantity?: unknown }[];
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      expect(offer.eligibleQuantity).toMatchObject({
        "@type": "QuantitativeValue",
        minValue: 2,
        unitCode: "HUR",
      });
    }
  });

  test("annonce une fourchette de prix sur l'établissement", async ({
    page,
  }) => {
    await page.goto("/");
    const raw = await page
      .locator('script[type="application/ld+json"]')
      .innerText();
    const data = JSON.parse(raw) as Record<string, unknown>[];

    const business = data.find(
      (entry) => entry["@type"] === "HomeAndConstructionBusiness",
    );
    expect(business?.priceRange).toBe("€€");
  });
});

test.describe("référencement par les modèles de langage", () => {
  test("chaque page indexable porte son résumé factuel", async ({ page }) => {
    // Un modèle n'a pas de « position 1 » : il cite la phrase qui répond, ou
    // il ne cite rien. Le résumé doit donc porter le service, le lieu et le
    // chiffre clé, et rester vrai hors de sa page.
    for (const path of [
      "/",
      "/tarifs",
      "/zones-desservies",
      "/menage-a-domicile/leognan",
      "/femme-de-menage/gradignan",
    ]) {
      await page.goto(path);
      const summary = await page
        .locator('meta[name="llm-summary"]')
        .getAttribute("content");

      expect(summary, `llm-summary manquant sur ${path}`).toBeTruthy();
      expect(summary).toContain("Léo Clean");
      expect(summary, `pas de chiffre dans le résumé de ${path}`).toMatch(/\d/);

      // Les deux noms circulent, aucun n'est normalisé : on pose les deux.
      await expect(page.locator('meta[name="ai:content"]')).toHaveAttribute(
        "content",
        summary!,
      );
    }
  });

  test("le bloc de réponses ouvre le contenu de la page commune", async ({
    page,
  }) => {
    await page.goto("/menage-a-domicile/gradignan");

    const questions = page.locator("main h3");
    // Trois questions, la première étant celle du prix.
    expect(await questions.count()).toBeGreaterThanOrEqual(3);
    await expect(questions.first()).toContainText(
      "Combien coûte un ménage à domicile à Gradignan",
    );

    // La réponse se suffit à elle-même : entité, chiffres et lieu.
    const answer = await questions.first().locator("+ p").innerText();
    const normalise = answer.replace(/\s+/g, " ");
    expect(normalise).toContain("Léo Clean");
    expect(normalise).toContain("Gradignan");
    expect(normalise).toContain("29 €/h");
    expect(normalise).toContain("101,50 €");
  });

  test("le même balisage FAQPage que le bloc affiché", async ({ page }) => {
    // Un balisage qui annonce autre chose que la page est une divergence que
    // Google sanctionne.
    await page.goto("/menage-a-domicile/gradignan");

    const raw = await page
      .locator('script[type="application/ld+json"]')
      .innerText();
    const data = JSON.parse(raw) as Record<string, unknown>[];
    const faq = data.find((entry) => entry["@type"] === "FAQPage");
    const questions = (faq?.mainEntity as { name: string }[]).map(
      (entry) => entry.name,
    );

    const affichees = await page.locator("main h3").allInnerTexts();
    for (const question of questions) {
      expect(affichees).toContain(question);
    }
  });

  test("llms-full.txt reprend le corps des pages", async ({ request }) => {
    const body = (await (await request.get("/llms-full.txt")).text()).replace(
      /[  ]/g,
      " ",
    );

    // Chaque page commune y figure avec sa source et son contenu propre.
    for (const commune of COMMUNES) {
      expect(body).toContain(`/menage-a-domicile/${commune}`);
    }
    expect(body).toContain("## Ménage à domicile à Gradignan (33170)");
    expect(body).toContain("Femme de ménage à");
    expect(body).toContain("29 €/h");

    // Les espaces connectés n'y sont pas : ils ne répondent à rien.
    expect(body).not.toContain("/mon-compte");
    expect(body).not.toContain("/connexion");
  });

  test("llms.txt renvoie vers le texte intégral", async ({ request }) => {
    const body = await (await request.get("/llms.txt")).text();
    expect(body).toContain("/llms-full.txt");
  });

  test("robots.txt nomme Bingbot comme les autres", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toContain("Bingbot");
  });
});
