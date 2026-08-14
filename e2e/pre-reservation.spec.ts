import { expect, test } from "@playwright/test";

/**
 * Demande de rappel.
 *
 * C'est le seul point de conversion autonome du site tant que le tunnel de
 * réservation n'est pas ouvert : il doit accepter ce qu'un humain tape
 * réellement, et ne jamais perdre une demande.
 */

test.describe("formulaire de rappel", () => {
  test("enregistre une demande et confirme le rappel", async ({ page }) => {
    await page.goto("/etre-rappele");

    await page.getByLabel("Votre nom").fill("Claire Dubourg");
    await page.getByLabel("Votre téléphone").fill("06 12 34 56 78");
    await page.getByLabel("Votre commune").selectOption("33238");
    await page
      .getByLabel(/Votre besoin/)
      .fill("Maison de 110 m², plutôt le mardi matin.");

    // Le formulaire écarte les envois de moins de trois secondes : un humain
    // met plus longtemps, un robot non.
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: "Être rappelé" }).click();

    await expect(page.getByText("C'est noté, merci.")).toBeVisible();
  });

  test("accepte les numéros tels que les gens les écrivent", async ({
    page,
  }) => {
    await page.goto("/etre-rappele");

    await page.getByLabel("Votre nom").fill("Damien Lafitte");
    await page.getByLabel("Votre téléphone").fill("+33 6.84.36.38.62");
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: "Être rappelé" }).click();

    await expect(page.getByText("C'est noté, merci.")).toBeVisible();
  });

  test("signale un numéro invalide sans perdre la saisie", async ({ page }) => {
    await page.goto("/etre-rappele");

    await page.getByLabel("Votre nom").fill("Test");
    await page.getByLabel("Votre téléphone").fill("12345");
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: "Être rappelé" }).click();

    await expect(page.locator("#phone-error")).toContainText("ne semble pas");
  });

  test("propose le formulaire pré-rempli depuis une page commune", async ({
    page,
  }) => {
    await page.goto("/menage-a-domicile/gradignan");

    // La commune est déjà sélectionnée : une question de moins à poser.
    await expect(page.getByLabel("Votre commune")).toHaveValue("33192");
  });
});
