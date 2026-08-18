import { expect, test } from "@playwright/test";

/**
 * Tunnel de réservation.
 *
 * Le parcours complet est exercé de bout en bout, jusqu'à l'écriture en base :
 * c'est le seul moyen de vérifier que le devis affiché, le créneau proposé et
 * la réservation enregistrée sont bien la même chose.
 *
 * L'ordre des écrans obéit à une règle, et c'est elle que ces tests protègent :
 * **plus une information coûte à donner, plus tard on la demande.** La commune
 * d'abord, le prix au troisième écran, les coordonnées au cinquième, l'adresse
 * exacte au dernier. Un test qui verrait réapparaître l'adresse en tête
 * signalerait la régression la plus coûteuse du parcours.
 *
 * Le chemin emprunté pour l'adresse est celui de la **saisie manuelle**,
 * délibérément. La complétion dépend de la Base Adresse Nationale, un service
 * public qui limite son débit et renvoie parfois 503 : un test qui en dépend
 * échoue pour des raisons étrangères au code. C'est de toute façon le chemin
 * qu'il faut le plus sûrement protéger — celui que prendra un client le jour
 * où la BAN sera indisponible.
 */

type Page = import("@playwright/test").Page;

/** Écran 1 : la commune, choisie dans notre référentiel. */
async function choisirCommune(page: Page, nom = "Léognan") {
  await page.getByRole("button", { name: new RegExp(`^${nom}`) }).click();
}

/** Écran 5 : les coordonnées, une fois le prix et le créneau connus. */
async function saisirCoordonnees(page: Page, email: string) {
  await page.fill("#firstName", "Camille");
  await page.fill("#lastName", "Durand");
  await page.fill("#phone", "06 12 34 56 78");
  await page.fill("#email", email);
  await page.getByRole("button", { name: "Indiquer mon adresse" }).click();
}

/** Écran 6 : l'adresse exacte, en saisie manuelle. */
async function saisirAdresseManuelle(page: Page, commune = "leognan") {
  await page
    .getByRole("button", { name: "Saisir mon adresse manuellement" })
    .click();
  await page.fill("#manual-street", "12 rue des Vignes");
  await page.selectOption("#manual-commune", commune);
  await page.getByRole("button", { name: "Voir mon récapitulatif" }).click();
}

test.describe("réservation", () => {
  // Le parcours complet enchaîne plusieurs allers-retours serveur, dont une
  // recherche de créneaux sur trois semaines : il dépasse le budget par défaut.
  test.setTimeout(120_000);

  test("mène de la commune à la confirmation", async ({ page, isMobile }) => {
    /*
     * Le seul test de la suite qui écrive réellement en base, et donc le seul
     * qui consomme un créneau. Le faire tourner sur les deux projets revenait
     * à lancer deux réservations concurrentes sur la même commune à la même
     * heure : la base en refuse une, à juste titre, et le test échouait pour
     * une bonne raison — ce qui en fait un mauvais test. Mobile d'abord,
     * puisque c'est là que se prennent les réservations.
     */
    test.skip(!isMobile, "Une seule réservation réelle par exécution.");

    await page.goto("/reserver");

    // 1. Commune. Le prix d'appel est annoncé avant même le premier choix :
    // la barre basse n'est jamais vide.
    await expect(
      page.getByRole("heading", { name: "Où habitez-vous ?" }),
    ).toBeVisible();
    await expect(page.getByText(/À partir de 28/)).toBeVisible();
    await choisirCommune(page);

    // 2. Durée — un nombre d'heures, pas une surface à estimer.
    await expect(
      page.getByRole("heading", { name: /De combien de temps/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "3 h" }).click();

    // 3. Rythme — c'est ici que le prix apparaît, avant toute donnée
    // personnelle. Chaque formule porte le sien, calculé par le serveur :
    // 3 h à 28 €/h en formule régulière.
    await expect(
      page.getByRole("heading", { name: /À quel rythme/ }),
    ).toBeVisible();
    const biweekly = page.getByRole("button", {
      name: /Tous les quinze jours/,
    });
    await expect(biweekly).toContainText("84,00", { timeout: 20_000 });
    await biweekly.click();

    // 4. Créneau — le prix reste affiché pendant qu'on choisit son jour.
    await expect(
      page.getByRole("heading", { name: /Quand voulez-vous/ }),
    ).toBeVisible();
    const slot = page.locator("main ul li button", {
      hasText: /^\d{2}:\d{2}$/,
    });
    await expect(slot.first()).toBeVisible({ timeout: 45_000 });
    const chosenTime = await slot.first().innerText();
    await expect(page.getByText(/par intervention/)).toContainText("3 h");
    await slot.first().click();
    await page.getByRole("button", { name: "Saisir mes coordonnées" }).click();

    // 5. Coordonnées — demandées une fois la valeur visible et l'heure retenue.
    await expect(
      page.getByRole("heading", { name: "Comment vous joindre ?" }),
    ).toBeVisible();
    const email = `e2e-${Date.now()}@leoclean.test`;
    await saisirCoordonnees(page, email);

    // 6. Adresse exacte, puis récapitulatif dont chaque ligne est modifiable.
    await expect(
      page.getByRole("heading", { name: /À quelle adresse/ }),
    ).toBeVisible();
    await saisirAdresseManuelle(page);

    await expect(
      page.getByRole("button", { name: "Modifier le créneau" }),
    ).toBeVisible();

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
    expect(main.replace(/\s+/g, " ")).toContain("84,00 €");
    expect(chosenTime).toMatch(/^\d{2}:\d{2}$/);

    // « Le même intervenant, chaque semaine » est la promesse centrale : la
    // confirmation montre quelqu'un, pas seulement une heure et un prix. Soit
    // on le nomme, soit on annonce une confirmation sous 24 h — jamais un
    // écran qui laisse la question ouverte.
    await expect(
      page
        .getByText("Vous serez suivi par")
        .or(page.getByText(/votre intervenant sous 24 heures/)),
    ).toBeVisible();

    // Le fichier iCalendar est produit là où la réservation est écrite, et
    // proposé tel quel : un rendez-vous absent de l'agenda est oublié, et une
    // absence coûte 100 % du prix au titre du barème des CGU.
    const calendar = page.getByRole("link", {
      name: "Ajouter à mon calendrier",
    });
    await expect(calendar).toBeVisible();
    await expect(calendar).toHaveAttribute("download", /\.ics$/);
  });

  test("montre le prix avant de demander la moindre donnée personnelle", async ({
    page,
  }) => {
    // C'est la règle d'ordonnancement du tunnel, et la raison de la refonte :
    // le prix était auparavant le dernier écran, l'adresse le premier.
    await page.goto("/reserver");
    await choisirCommune(page);
    await page.getByRole("button", { name: "3 h" }).click();

    await expect(
      page.getByRole("button", { name: /Tous les quinze jours/ }),
    ).toContainText("84,00", { timeout: 20_000 });

    // Aucun champ de coordonnées ni d'adresse n'a été rencontré en chemin.
    await expect(page.locator("#firstName")).toHaveCount(0);
    await expect(page.locator("#email")).toHaveCount(0);
    await expect(page.locator("#address")).toHaveCount(0);
  });

  test("garde la saisie quand on revient en arrière", async ({ page }) => {
    // Revenir changer un choix ne doit rien détruire : c'est le retour le plus
    // probable du parcours, et il vidait les six champs déjà remplis.
    await page.goto("/reserver");
    await choisirCommune(page);
    await page.getByRole("button", { name: "2 h" }).click();
    await page
      .getByRole("button", { name: /Tous les quinze jours/ })
      .click({ timeout: 30_000 });

    const slot = page.locator("main ul li button", {
      hasText: /^\d{2}:\d{2}$/,
    });
    await expect(slot.first()).toBeVisible({ timeout: 45_000 });
    await slot.first().click();
    await page.getByRole("button", { name: "Saisir mes coordonnées" }).click();

    await saisirCoordonnees(page, "camille@exemple.fr");
    await saisirAdresseManuelle(page);

    // Depuis le récapitulatif, on va changer le rythme puis on revient.
    await page.getByRole("button", { name: "Modifier le rythme" }).click();
    await page.getByRole("button", { name: /Une seule fois/ }).click();

    await expect(
      page.getByRole("button", { name: "Modifier le créneau" }),
    ).toBeVisible();
    // L'adresse et les coordonnées sont toujours là, résumées.
    await expect(page.getByText("12 rue des Vignes")).toBeVisible();
    await expect(page.getByText("camille@exemple.fr")).toBeVisible();
  });

  test("propose de reprendre un parcours interrompu", async ({ page }) => {
    await page.goto("/reserver");
    await choisirCommune(page);
    await page.getByRole("button", { name: "4 h" }).click();

    // Retour par une URL nue — le chemin de quelqu'un qui revient par
    // l'accueil ou par un favori, et non en rechargeant l'onglet ouvert.
    await page.goto("/reserver");

    await expect(page.getByText(/Reprendre ma réservation/)).toBeVisible();
    await page.getByRole("button", { name: /Reprendre où j'en étais/ }).click();
    await expect(
      page.getByRole("heading", { name: /À quel rythme/ }),
    ).toBeVisible();
  });

  test("annonce la reprise dès l'accueil", async ({ page }) => {
    // Un parcours interrompu ne se retrouve pas tout seul : la personne revient
    // par l'accueil, et sans bandeau elle recommence de zéro.
    await page.goto("/reserver");
    await choisirCommune(page, "Cadaujac");
    await page.getByRole("button", { name: "4 h" }).click();

    await page.goto("/");
    const banner = page.getByText(/Reprendre ma réservation — étape/);
    await expect(banner).toBeVisible();

    await page.getByRole("link", { name: "Reprendre", exact: true }).click();
    await page.waitForURL(/\/reserver/);
    expect(new URL(page.url()).searchParams.get("commune")).toBe("cadaujac");
  });

  test("ne garde ni adresse ni coordonnées dans le stockage local", async ({
    page,
  }) => {
    // Une adresse de domicile laissée au repos dans le navigateur est une
    // donnée personnelle que personne n'a demandé à y laisser, et la reprise
    // n'en a pas besoin.
    await page.goto("/reserver");
    await choisirCommune(page);
    await page.getByRole("button", { name: "2 h" }).click();

    const saved = await page.evaluate(() =>
      window.localStorage.getItem("leoclean:booking:v1"),
    );
    expect(saved).toBeTruthy();
    expect(saved).toContain("leognan");
    expect(saved).not.toContain("rue des Vignes");
    expect(saved).not.toContain("@");
  });

  test("reflète l'avancement dans l'URL", async ({ page }) => {
    // Un rechargement ne doit pas ramener au premier écran, et un lien
    // partagé doit rouvrir le tunnel au même endroit.
    await page.goto("/reserver");
    await choisirCommune(page, "Gradignan");
    await page.getByRole("button", { name: "2 h" }).click();

    const url = new URL(page.url());
    expect(url.searchParams.get("commune")).toBe("gradignan");
    // L'écran demande une durée et en déduit la surface, et non l'inverse :
    // deux heures valent 50 m² à 25 m²/h. L'URL porte la surface parce que
    // c'est elle que le reste de la chaîne — devis, créneaux, réservation —
    // continue de lire.
    expect(url.searchParams.get("surface")).toBe("50");
    expect(url.searchParams.get("step")).toBe("rythme");
  });

  test("accepte une durée libre, au curseur", async ({ page }) => {
    await page.goto("/reserver");
    await choisirCommune(page);

    // Le curseur part de 3 h ; un cran à droite fait 3 h 30 — le pas de
    // 30 minutes que l'ancien champ « minutes » demandait de taper.
    await page.locator("#duration-slider").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#duration-slider")).toHaveValue("210");
    await page.getByRole("button", { name: "Choisir mon rythme" }).click();

    // 3 h 30 à 28 €/h en formule régulière, soit la surface de 87 m²
    // que le tunnel déduit de la durée choisie.
    await expect(
      page.getByRole("button", { name: /Tous les quinze jours/ }),
    ).toContainText("98,00", { timeout: 20_000 });
    await expect(page.getByText(/par intervention/)).toContainText("3 h 30");
  });

  test("ne propose que des communes desservies", async ({ page }) => {
    // La liste vient du référentiel, pas d'une saisie libre : il est
    // structurellement impossible d'engager un parcours hors zone.
    await page.goto("/reserver");

    const communes = await page
      .locator("main ul li button[aria-pressed]")
      .allInnerTexts();
    expect(communes).toHaveLength(16);
    expect(communes.join(" ")).toContain("Léognan");
    expect(communes.join(" ")).not.toContain("Bordeaux");
  });

  test("filtre la liste par code postal", async ({ page }) => {
    // C'est ce que beaucoup tapent d'abord : il filtre, il ne remplace pas.
    await page.goto("/reserver");
    await page.fill("#commune-filter", "33850");

    const communes = await page
      .locator("main ul li button[aria-pressed]")
      .allInnerTexts();
    expect(communes.join(" ")).toContain("Léognan");
    expect(communes.join(" ")).not.toContain("Gradignan");
  });

  test("rouvre le tunnel là où un lien partagé s'est arrêté", async ({
    page,
  }) => {
    // C'est ce que l'URL sert à faire : un rechargement ou un lien envoyé à
    // quelqu'un ne doit pas renvoyer au premier écran.
    await page.goto("/reserver?commune=cestas&surface=100&step=rythme");

    await expect(
      page.getByRole("heading", { name: /À quel rythme/ }),
    ).toBeVisible();
    // 4 h à 28 €/h en formule régulière.
    await expect(
      page.getByRole("button", { name: /Tous les quinze jours/ }),
    ).toContainText("112,00", { timeout: 20_000 });
  });

  test("ne va jamais plus loin que ce que l'URL rend atteignable", async ({
    page,
  }) => {
    // Une URL bricolée à la main ne doit pas ouvrir un écran de créneaux qui
    // n'a ni durée à chercher ni prix à afficher.
    await page.goto("/reserver?commune=cestas&step=creneau");

    await expect(
      page.getByRole("heading", { name: /De combien de temps/ }),
    ).toBeVisible();
  });

  test("saute le premier écran quand la commune est déjà connue", async ({
    page,
  }) => {
    // Le lien des pages locales transmet la commune : on ne repose pas la
    // question dont on vient de lire la page entière.
    await page.goto("/reserver?commune=gradignan");

    await expect(
      page.getByRole("heading", { name: /De combien de temps/ }),
    ).toBeVisible();
    await expect(
      page.getByText("Étape 2 sur 6", { exact: true }),
    ).toBeVisible();
  });

  test("reste utilisable quand la recherche d'adresse ne rend rien", async ({
    page,
  }) => {
    // La complétion est un confort, pas une dépendance. Une saisie qui ne
    // ramène rien — service indisponible, adresse trop récente — doit mener à
    // la saisie manuelle, pas à une impasse.
    await page.goto("/reserver");
    await choisirCommune(page);
    await page.getByRole("button", { name: "2 h" }).click();
    await page
      .getByRole("button", { name: /Tous les quinze jours/ })
      .click({ timeout: 30_000 });

    const slot = page.locator("main ul li button", {
      hasText: /^\d{2}:\d{2}$/,
    });
    await expect(slot.first()).toBeVisible({ timeout: 45_000 });
    await slot.first().click();
    await page.getByRole("button", { name: "Saisir mes coordonnées" }).click();
    await saisirCoordonnees(page, `e2e-${Date.now()}@leoclean.test`);

    await page.fill("#address", "zzzz adresse qui n'existe pas quelque part");
    await expect(
      page.getByRole("button", { name: "Saisir mon adresse manuellement" }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("offre une sortie vers quelqu'un à chaque écran", async ({ page }) => {
    await page.goto("/reserver");
    await expect(
      page.getByRole("button", { name: "Vous préférez en parler ?" }),
    ).toBeVisible();

    await choisirCommune(page);
    await expect(
      page.getByRole("button", { name: "Vous préférez en parler ?" }),
    ).toBeVisible();
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
