import { expect, test } from "@playwright/test";

/**
 * Coque applicative.
 *
 * Ce qui se vérifie ici n'est pas l'apparence mais trois règles qui, prises à
 * l'envers, coûtent des réservations : la navigation du pouce n'apparaît que
 * là où elle aide, elle ne recouvre jamais ce qu'elle est censée servir, et le
 * geste de retour arrière ne fait pas sortir d'un parcours à moitié rempli.
 *
 * La barre de rappel n'est jamais démontée — la retirer et la remettre ferait
 * sauter la mise en page. Elle est donc masquée en glissant hors de l'écran,
 * ce qui se constate avec `toBeInViewport` et non avec `toBeHidden`.
 */

const TAB_BAR = "body > nav[aria-label='Navigation principale']";
const RECALL_BAR = "[data-sticky-cta]";

test.describe("barre d'onglets", () => {
  test("est là sur mobile, absente en desktop", async ({ page, isMobile }) => {
    await page.goto("/");
    const bar = page.locator(TAB_BAR);

    if (isMobile) {
      await expect(bar).toBeVisible();
      for (const label of ["Accueil", "Tarifs", "Réserver", "Aide"]) {
        await expect(bar.getByText(label, { exact: true })).toBeVisible();
      }
    } else {
      // La navigation horizontale de l'en-tête reste seule maîtresse.
      await expect(bar).toBeHidden();
    }
  });

  test("disparaît dans le tunnel", async ({ page }) => {
    // Pendant une réservation, un seul modèle de navigation : la progression
    // et le bouton d'étape. Le reste ne sert qu'à sortir du parcours.
    await page.goto("/reserver");
    await expect(page.locator(TAB_BAR)).toHaveCount(0);
  });

  test("désigne l'onglet de la page en cours", async ({ page, isMobile }) => {
    test.skip(!isMobile, "La barre n'existe pas en desktop.");

    await page.goto("/tarifs");
    const current = page.locator(`${TAB_BAR} [aria-current='page']`);
    await expect(current).toHaveCount(1);
    await expect(current).toContainText("Tarifs");
  });

  test("ne recouvre pas la fin du pied de page", async ({ page, isMobile }) => {
    test.skip(!isMobile, "La barre n'existe pas en desktop.");

    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const footerBox = await page.locator("footer").boundingBox();
    const barBox = await page.locator(TAB_BAR).boundingBox();

    // Le pied de page porte les mentions légales et le téléphone : sa dernière
    // ligne doit rester lisible au-dessus de la barre.
    expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(barBox!.y + 2);
  });
});

test.describe("panneau d'aide", () => {
  test("ouvre les trois canaux et se ferme par Échap", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "La barre n'existe pas en desktop.");

    await page.goto("/");
    await page.locator(TAB_BAR).getByRole("button", { name: "Aide" }).click();

    // Le panneau tire son nom accessible de son titre, posé par Base UI.
    const sheet = page.getByRole("dialog", {
      name: /Une question avant de réserver/,
    });
    await expect(sheet).toBeVisible();

    // Par ordre d'engagement décroissant, celui du reste du produit.
    await expect(sheet.getByRole("link", { name: /^Appeler/ })).toHaveAttribute(
      "href",
      "tel:+33684363862",
    );
    await expect(
      sheet.getByRole("link", { name: "Écrire sur WhatsApp" }),
    ).toBeVisible();
    await expect(
      sheet.getByRole("link", { name: "Envoyer un email" }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });
});

test.describe("barre de rappel", () => {
  test("se montre à la lecture et s'efface devant le vrai bouton", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "La barre n'existe pas en desktop.");

    await page.goto("/menage-a-domicile/gradignan");
    const recall = page.locator(RECALL_BAR);

    // En haut de page, le héros dit déjà tout : rien à rappeler.
    await expect(recall).not.toBeInViewport();

    await page
      .getByRole("heading", { name: /Questions fréquentes/ })
      .scrollIntoViewIfNeeded();
    await expect(recall).toBeInViewport();
    await expect(recall).toContainText("À partir de");

    // Devant le bouton de la page, elle s'efface : deux appels à l'action
    // concurrents demanderaient de choisir lequel compte.
    await page.locator("[data-booking-cta]").first().scrollIntoViewIfNeeded();
    await expect(recall).not.toBeInViewport();
  });

  test("emmène le tunnel sur la commune de la page", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "La barre n'existe pas en desktop.");

    await page.goto("/menage-a-domicile/cestas");
    // Tant qu'elle est hors champ, la barre est `inert` : ses liens ne sont
    // pas dans l'arbre d'accessibilité, et c'est voulu.
    await page
      .getByRole("heading", { name: /Questions fréquentes/ })
      .scrollIntoViewIfNeeded();

    await expect(
      page.locator(RECALL_BAR).getByRole("link", { name: "Réserver" }),
    ).toHaveAttribute("href", "/reserver?commune=cestas");
  });

  test("n'existe pas en desktop", async ({ page, isMobile }) => {
    test.skip(isMobile, "Vérification propre au desktop.");

    await page.goto("/menage-a-domicile/gradignan");
    await page
      .getByRole("heading", { name: /Questions fréquentes/ })
      .scrollIntoViewIfNeeded();
    await expect(page.locator(RECALL_BAR)).toBeHidden();
  });
});

test.describe("retour arrière dans le tunnel", () => {
  test("revient d'un écran au lieu de quitter la réservation", async ({
    page,
  }) => {
    // Le lien d'une page commune répond déjà au premier écran : le tunnel
    // s'ouvre sur le logement.
    await page.goto("/menage-a-domicile/leognan");
    await page.getByRole("link", { name: /Voir les créneaux/ }).click();

    await expect(page.getByText("Étape 2 sur 6")).toBeVisible();
    await page.getByRole("button", { name: /Studio ou T2/ }).click();
    await expect(page.getByText("Étape 3 sur 6")).toBeVisible();

    await page.goBack();
    await expect(page.getByText("Étape 2 sur 6")).toBeVisible();
    // Toujours dans le tunnel, pas revenu sur la page commune.
    expect(new URL(page.url()).pathname).toBe("/reserver");

    // Une entrée de plus en arrière, et là seulement on sort.
    await page.goBack();
    expect(new URL(page.url()).pathname).toBe("/menage-a-domicile/leognan");
  });

  test("la flèche de l'écran et le retour du navigateur défont la même chose", async ({
    page,
  }) => {
    await page.goto("/reserver");
    await page.getByRole("button", { name: /^Léognan/ }).click();
    await expect(page.getByText("Étape 2 sur 6")).toBeVisible();

    // La flèche recule d'une entrée d'historique : sans cela, elle en
    // empilerait une de plus et le retour du navigateur ferait du surplace.
    await page
      .getByRole("button", { name: "Revenir à l'écran précédent" })
      .click();
    await expect(page.getByText("Étape 1 sur 6")).toBeVisible();

    await page.goForward();
    await expect(page.getByText("Étape 2 sur 6")).toBeVisible();
  });
});
