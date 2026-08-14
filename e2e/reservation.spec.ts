import { expect, test } from "@playwright/test";

/**
 * Tunnel de réservation.
 *
 * Le parcours complet est exercé de bout en bout, jusqu'à l'écriture en base :
 * c'est le seul moyen de vérifier que le devis affiché, le créneau proposé et
 * la réservation enregistrée sont bien la même chose.
 *
 * Le chemin emprunté est celui de la **saisie manuelle**, délibérément. La
 * complétion d'adresse dépend de la Base Adresse Nationale, un service public
 * qui limite son débit et renvoie parfois 503 : un test qui en dépend échoue
 * pour des raisons étrangères au code. La saisie manuelle est de toute façon le
 * chemin qu'il faut le plus sûrement protéger — c'est celui que prendra un
 * client le jour où la BAN sera indisponible.
 */

test.describe("réservation", () => {
  // Le parcours complet enchaîne quatre allers-retours serveur, dont une
  // recherche de créneaux sur trois semaines : il dépasse le budget par défaut.
  test.setTimeout(120_000);

  test("mène de l'adresse à la confirmation", async ({ page }) => {
    await page.goto("/reserver");
    await expect(page.locator("h1")).toContainText("Réserver un ménage");

    // 1. Adresse — saisie manuelle, commune choisie dans notre référentiel.
    await page
      .getByRole("button", { name: "Saisir mon adresse manuellement" })
      .click();
    await page.fill("#manual-street", "12 rue des Vignes");
    await page.selectOption("#manual-commune", "leognan");
    await page.getByRole("button", { name: "Continuer" }).click();

    // 2. Logement — le devis vient du serveur, jamais du navigateur.
    await expect(page.getByText("Durée estimée")).toBeVisible({
      timeout: 20_000,
    });
    const quote = await page.locator("dl").first().innerText();
    // 80 m² à 25 m²/h font 3 h 30, à 29 €/h en formule régulière.
    expect(quote).toContain("3 h 30");
    expect(quote.replace(/[  ]/g, " ")).toContain("101,50 €");

    await page.getByRole("button", { name: "Voir les créneaux" }).click();

    // 3. Créneau — regroupé par journée, en heure locale.
    const slot = page.locator("main ul li button").first();
    await expect(slot).toBeVisible({ timeout: 30_000 });
    const chosenTime = await slot.innerText();
    expect(chosenTime).toMatch(/^\d{2}:\d{2}$/);
    await slot.click();

    // 4. Coordonnées — le compte se crée à la réservation, pas avant.
    await expect(page.locator("#firstName")).toBeVisible();
    const email = `e2e-${Date.now()}@leoclean.test`;
    await page.fill("#firstName", "Camille");
    await page.fill("#lastName", "Durand");
    await page.fill("#email", email);
    await page.fill("#phone", "06 12 34 56 78");
    await page.fill("#accessNotes", "Digicode 1234, portail vert");

    await page.getByRole("button", { name: "Réserver" }).click();

    await expect(page.getByText("C'est réservé.")).toBeVisible({
      timeout: 30_000,
    });
    // Le récapitulatif reprend l'heure choisie et le montant du devis.
    const main = await page.locator("main").innerText();
    expect(main).toContain(chosenTime);
    expect(main.replace(/[  ]/g, " ")).toContain("101,50 €");
  });

  test("ne propose que des communes desservies en saisie manuelle", async ({
    page,
  }) => {
    // La liste vient du référentiel, pas d'une saisie libre : il est
    // structurellement impossible de réserver hors zone par ce chemin.
    await page.goto("/reserver");
    await page
      .getByRole("button", { name: "Saisir mon adresse manuellement" })
      .click();

    const options = await page
      .locator("#manual-commune option")
      .allInnerTexts();
    expect(options).toHaveLength(16);
    expect(options.join(" ")).toContain("Léognan (33850)");
    expect(options.join(" ")).not.toContain("Bordeaux (33000)");
  });

  test("reste utilisable quand la recherche d'adresse ne rend rien", async ({
    page,
  }) => {
    // La complétion est un confort, pas une dépendance. Une saisie qui ne
    // ramène rien — service indisponible, adresse trop récente — doit mener à
    // la saisie manuelle, pas à une impasse.
    await page.goto("/reserver");
    await page.fill("#address", "zzzz adresse qui n'existe pas quelque part");

    await expect(
      page.getByRole("button", { name: "Saisir mon adresse manuellement" }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("n'indexe pas le tunnel", async ({ page }) => {
    // Le tunnel n'apporte rien en résultat de recherche : il n'a de sens
    // qu'après la page qui a convaincu.
    await page.goto("/reserver");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  });
});
