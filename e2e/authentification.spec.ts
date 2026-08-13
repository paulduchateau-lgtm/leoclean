import { expect, test } from "@playwright/test";

/**
 * Parcours de connexion.
 *
 * On vérifie ce qui protège réellement : qu'un espace connecté n'est pas
 * atteignable sans session, et que la demande de lien ne révèle jamais si une
 * adresse est connue.
 */

test.describe("accès aux espaces connectés", () => {
  test("renvoie vers la connexion et retient la destination", async ({
    page,
  }) => {
    await page.goto("/mon-compte");

    await expect(page).toHaveURL(/\/connexion\?callbackUrl=%2Fmon-compte/);
    await expect(
      page.getByRole("heading", { name: "Se connecter" }),
    ).toBeVisible();
  });
});

test.describe("demande d'un lien de connexion", () => {
  test("confirme l'envoi sans révéler si le compte existe", async ({
    page,
  }) => {
    await page.goto("/connexion");

    await page
      .getByLabel("Votre adresse email")
      .fill("inconnu@exemple.invalid");
    await page
      .getByRole("button", { name: "Recevoir mon lien de connexion" })
      .click();

    // Le même message pour une adresse connue et une adresse inconnue : sans
    // cela, le formulaire servirait à énumérer les comptes.
    await expect(page.getByText("Regardez votre boîte mail")).toBeVisible();
    await expect(page.getByText(/Si un compte existe/)).toBeVisible();
  });

  test("signale une adresse mal formée sans quitter la page", async ({
    page,
  }) => {
    await page.goto("/connexion");

    await page.getByLabel("Votre adresse email").fill("pas-une-adresse");
    await page
      .getByRole("button", { name: "Recevoir mon lien de connexion" })
      .click();

    // On cible le message du champ : Next.js expose lui aussi un élément
    // `role="alert"` pour annoncer les changements de route.
    await expect(page.locator("#email-error")).toContainText("adresse email");
  });

  test("n'indexe pas la page de connexion", async ({ page }) => {
    await page.goto("/connexion");

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  });
});
