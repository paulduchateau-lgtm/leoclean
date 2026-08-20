import { expect, test } from "@playwright/test";

import { COMPTE_MOT_DE_PASSE as COMPTE } from "./comptes";

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
      .getByRole("button", { name: "Recevoir un lien de connexion" })
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
      .getByRole("button", { name: "Recevoir un lien de connexion" })
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

/**
 * Connexion par mot de passe.
 *
 * Ce que ces tests protègent n'est pas le formulaire mais **le montage qui le
 * fait écrire une session en base**. Auth.js n'en écrit pas pour le
 * fournisseur `Credentials` : il bascule sur un jeton signé, et
 * `authConfig.jwt.encode` intercepte cet encodage. C'est une dépendance à un
 * comportement interne, donc exactement le genre de chose qui cesse de
 * fonctionner à une mise à jour, sans que rien ne le dise.
 *
 * Le test unitaire vérifie que la ligne s'écrit ; celui-ci vérifie qu'Auth.js
 * passe bien par là.
 */
test.describe("connexion par mot de passe", () => {
  test("ouvre l'espace, et le cookie porte une session révocable", async ({
    page,
    context,
  }) => {
    await page.goto("/connexion?callbackUrl=%2Fmon-compte");

    await page.getByLabel("Votre adresse email").fill(COMPTE.email);
    await page.getByLabel("Votre mot de passe").fill(COMPTE.motDePasse);
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page).toHaveURL(/\/mon-compte/);
    await expect(
      page.getByRole("heading", { name: "Mon compte" }),
    ).toBeVisible();

    /*
     * Un jeton signé porte des points séparant ses segments. Le cookie doit
     * contenir un identifiant de session ordinaire : c'est lui qu'on supprime
     * pour suspendre un intervenant ou effacer un compte au titre du RGPD.
     */
    const cookies = await context.cookies();
    const session = cookies.find((cookie) =>
      cookie.name.endsWith("authjs.session-token"),
    );
    expect(session, "aucun cookie de session").toBeDefined();
    expect(session!.value).not.toContain(".");
  });

  test("refuse un mot de passe faux sans dire lequel des deux est en cause", async ({
    page,
  }) => {
    await page.goto("/connexion");

    await page.getByLabel("Votre adresse email").fill(COMPTE.email);
    await page.getByLabel("Votre mot de passe").fill("le chien dort ailleurs");
    await page.getByRole("button", { name: "Se connecter" }).click();

    const message = page.getByRole("alert");
    await expect(message).toBeVisible();
    /* Ni « adresse inconnue », ni « mot de passe incorrect ». */
    await expect(message).toContainText("ne correspondent à aucun compte");
  });

  test("refuse une adresse inconnue avec exactement le même message", async ({
    page,
  }) => {
    await page.goto("/connexion");

    await page.getByLabel("Votre adresse email").fill("personne@leoclean.test");
    await page.getByLabel("Votre mot de passe").fill(COMPTE.motDePasse);
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page.getByRole("alert")).toContainText(
      "ne correspondent à aucun compte",
    );
  });
});
