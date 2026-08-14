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
