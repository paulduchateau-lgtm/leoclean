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
