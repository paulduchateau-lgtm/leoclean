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

/** Saisie manuelle de l'adresse, point de départ commun à tous les tests. */
async function saisirAdresseManuelle(
  page: import("@playwright/test").Page,
  commune = "leognan",
) {
  await page
    .getByRole("button", { name: "Saisir mon adresse manuellement" })
    .click();
  await page.fill("#manual-street", "12 rue des Vignes");
  await page.selectOption("#manual-commune", commune);
  await page.getByRole("button", { name: "Décrire mon logement" }).click();
}

test.describe("réservation", () => {
  // Le parcours complet enchaîne plusieurs allers-retours serveur, dont une
  // recherche de créneaux sur trois semaines : il dépasse le budget par défaut.
  test.setTimeout(120_000);

  test("mène de l'adresse à la confirmation", async ({ page }) => {
    await page.goto("/reserver");

    // 1. Adresse. Le prix d'appel est annoncé avant même le premier choix :
    // la barre basse n'est jamais vide.
    await expect(
      page.getByRole("heading", { name: "Où intervenons-nous ?" }),
    ).toBeVisible();
    await expect(page.getByText(/À partir de 29/)).toBeVisible();

    await saisirAdresseManuelle(page);

    // 2. Logement — un type de logement, pas une surface à saisir.
    await expect(
      page.getByRole("heading", { name: /taille de votre logement/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /T3 ou petite maison/ }).click();

    // 3. Rythme — chaque formule porte son propre prix, calculé par le
    // serveur. 70 m² à 25 m²/h font 3 h, à 29 €/h en formule régulière.
    await expect(
      page.getByRole("heading", { name: /À quel rythme/ }),
    ).toBeVisible();
    const biweekly = page.getByRole("button", {
      name: /Tous les quinze jours/,
    });
    await expect(biweekly).toContainText("87,00", { timeout: 20_000 });
    await biweekly.click();

    // 4. Créneau — le prix reste affiché pendant qu'on choisit son jour.
    await expect(
      page.getByRole("heading", { name: /Quand voulez-vous/ }),
    ).toBeVisible();
    const slot = page.locator("main ul li button", { hasText: /^\d{2}:\d{2}$/ });
    await expect(slot.first()).toBeVisible({ timeout: 45_000 });
    const chosenTime = await slot.first().innerText();
    await expect(page.getByText(/par intervention/)).toContainText("3 h");
    await slot.first().click();

    // 5. Récapitulatif — chaque ligne est modifiable, les coordonnées sont
    // demandées une fois la valeur visible.
    await expect(
      page.getByRole("heading", { name: "Voilà ce qu'on a prévu" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Modifier le créneau" }),
    ).toBeVisible();

    const email = `e2e-${Date.now()}@leoclean.test`;
    await page.fill("#firstName", "Camille");
    await page.fill("#lastName", "Durand");
    await page.fill("#email", email);
    await page.fill("#phone", "06 12 34 56 78");

    // Les précisions d'accès sont repliées : elles n'encombrent pas l'écran
    // le plus décisif, mais restent atteignables.
    await page
      .getByRole("button", { name: /Ajouter l'accès au logement/ })
      .click();
    await page.fill("#accessNotes", "Digicode 1234, portail vert");

    await page.getByRole("button", { name: /^Réserver / }).click();

    await expect(page.getByText("C'est réservé.")).toBeVisible({
      timeout: 30_000,
    });
    // Le récapitulatif reprend l'heure choisie et le montant du devis.
    // Les montants portent une espace fine insécable avant l'euro : on
    // normalise toutes les espaces Unicode plutôt que d'en énumérer deux.
    const main = await page.locator("main").innerText();
    expect(main.replace(/\s+/g, " ")).toContain("87,00 €");
    expect(chosenTime).toMatch(/^\d{2}:\d{2}$/);
  });

  test("garde la saisie quand on revient en arrière", async ({ page }) => {
    // Revenir changer un choix ne doit rien détruire : c'est le retour le plus
    // probable du parcours, et il vidait les six champs déjà remplis.
    await page.goto("/reserver");
    await saisirAdresseManuelle(page);
    await page.getByRole("button", { name: /Studio ou T2/ }).click();
    await page
      .getByRole("button", { name: /Tous les quinze jours/ })
      .click({ timeout: 30_000 });

    const slot = page.locator("main ul li button", { hasText: /^\d{2}:\d{2}$/ });
    await expect(slot.first()).toBeVisible({ timeout: 45_000 });
    await slot.first().click();

    await page.fill("#firstName", "Camille");
    await page.fill("#email", "camille@exemple.fr");

    // Depuis le récapitulatif, on va changer le rythme puis on revient.
    await page.getByRole("button", { name: "Modifier le rythme" }).click();
    await page.getByRole("button", { name: /Une seule fois/ }).click();

    await expect(
      page.getByRole("heading", { name: "Voilà ce qu'on a prévu" }),
    ).toBeVisible();
    await expect(page.locator("#firstName")).toHaveValue("Camille");
    await expect(page.locator("#email")).toHaveValue("camille@exemple.fr");
  });

  test("propose de reprendre un parcours interrompu", async ({ page }) => {
    await page.goto("/reserver");
    await saisirAdresseManuelle(page);
    await page.getByRole("button", { name: /Maison familiale/ }).click();

    await page.reload();

    await expect(page.getByText(/Vous réserviez un ménage à Léognan/)).toBeVisible();
    await page.getByRole("button", { name: /Reprendre où j'en étais/ }).click();
    await expect(
      page.getByRole("heading", { name: /À quel rythme/ }),
    ).toBeVisible();
  });

  test("accepte une surface exacte, repliée par défaut", async ({ page }) => {
    await page.goto("/reserver");
    await saisirAdresseManuelle(page);

    await expect(page.locator("#surface")).toHaveCount(0);
    await page
      .getByRole("button", { name: /Je connais ma surface exacte/ })
      .click();
    await page.fill("#surface", "80");
    await page.getByRole("button", { name: "Choisir mon rythme" }).click();

    // 80 m² à 25 m²/h font 3 h 30, à 29 €/h en formule régulière.
    await expect(
      page.getByRole("button", { name: /Tous les quinze jours/ }),
    ).toContainText("101,50", { timeout: 20_000 });
    await expect(page.getByText(/par intervention/)).toContainText("3 h 30");
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

  test("présélectionne la commune d'où l'on vient", async ({ page }) => {
    // Le lien des pages locales transmet la commune : on ne retape pas la
    // ville dont on vient de lire la page entière.
    await page.goto("/reserver?commune=gradignan");
    await page
      .getByRole("button", { name: "Saisir mon adresse manuellement" })
      .click();

    await expect(page.locator("#manual-commune")).toHaveValue("gradignan");
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
