import { expect, test } from "@playwright/test";

test.describe("socle applicatif", () => {
  test("la page d'accueil se rend et annonce la zone couverte", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Léognan").first()).toBeVisible();
  });

  test("la page est servie en français", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  });
});
