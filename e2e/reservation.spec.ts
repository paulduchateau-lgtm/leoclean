import { expect, test } from "@playwright/test";

/**
 * Tunnel de réservation.
 *
 * Le parcours complet est exercé de bout en bout, jusqu'à l'écriture en base :
 * c'est le seul moyen de vérifier que le devis affiché, le créneau proposé et
 * la réservation enregistrée sont bien la même chose.
 *
 * L'ordre des écrans est ce que ces tests protègent en premier : **l'adresse,
 * la durée, le rythme, le créneau, les coordonnées, le récapitulatif.**
 * L'adresse ouvre le tunnel — elle a remplacé l'écran de choix de commune, et
 * elle n'est plus demandée qu'une fois. Ce qui reste tenu, et qui compte
 * autant : **le prix est affiché avant la moindre donnée d'identité.** Un test
 * qui verrait un nom ou un email réclamés avant le tarif signalerait la
 * régression la plus coûteuse du parcours.
 *
 * Le chemin emprunté pour l'adresse est celui de la **saisie manuelle**,
 * délibérément. La complétion dépend de la Base Adresse Nationale, un service
 * public qui limite son débit et renvoie parfois 503 : un test qui en dépend
 * échoue pour des raisons étrangères au code. C'est de toute façon le chemin
 * qu'il faut le plus sûrement protéger — celui que prendra un client le jour
 * où la BAN sera indisponible.
 */

type Page = import("@playwright/test").Page;

/**
 * Écran 1 : l'adresse, en saisie manuelle.
 *
 * C'est le chemin qui ne dépend d'aucun tiers, et c'est aussi celui que
 * prendra un client le jour où la Base Adresse Nationale sera indisponible.
 */
async function saisirAdresseManuelle(
  page: Page,
  commune = "leognan",
  rue = "12 rue des Vignes",
) {
  await page
    .getByRole("button", { name: "Saisir mon adresse manuellement" })
    .click();
  await page.fill("#manual-street", rue);
  await page.selectOption("#manual-commune", commune);
  await page.getByRole("button", { name: "Valider mon adresse" }).click();
}

/** Écran 5 : les coordonnées, une fois le prix et le créneau connus. */
async function saisirCoordonnees(page: Page, email: string) {
  await page.fill("#firstName", "Camille");
  await page.fill("#lastName", "Durand");
  await page.fill("#phone", "06 12 34 56 78");
  await page.fill("#email", email);
  await page.getByRole("button", { name: "Voir mon récapitulatif" }).click();
}

test.describe("réservation", () => {
  // Le parcours complet enchaîne plusieurs allers-retours serveur, dont une
  // recherche de créneaux sur trois semaines : il dépasse le budget par défaut.
  test.setTimeout(120_000);

  test("mène de l'adresse à la confirmation", async ({ page, isMobile }) => {
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

    // 1. Adresse. Le prix d'appel est annoncé avant même la première frappe :
    // la barre basse n'est jamais vide.
    await expect(
      page.getByRole("heading", { name: /À quelle adresse/ }),
    ).toBeVisible();
    /*
     * Le prix figure à deux endroits depuis que le récapitulatif accompagne le
     * tunnel : la barre basse et le récapitulatif. On vise le premier, faute de
     * quoi le sélecteur résout sur deux éléments et échoue — ce que le test
     * lisait comme une absence de prix alors qu'il y en avait deux.
     */
    await expect(page.getByText(/À partir de 28/).first()).toBeVisible();
    await saisirAdresseManuelle(page);

    // 2. Durée — un nombre d'heures, pas une surface à estimer.
    await expect(
      page.getByRole("heading", { name: /De combien de temps/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "3 h" }).click();

    // 3. Rythme — c'est ici que le prix apparaît, avant toute donnée
    // d'identité. Chaque formule porte le sien, calculé par le serveur :
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

    // 6. Récapitulatif, dont chaque ligne est modifiable — l'adresse comprise,
    // qui renvoie à son écran plutôt que d'ouvrir une seconde recherche.
    await expect(
      page.getByRole("heading", { name: /Vérifions votre réservation/ }),
    ).toBeVisible();
    await expect(page.getByText("12 rue des Vignes")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Modifier le créneau" }),
    ).toBeVisible();

    // Les précisions d'accès sont repliées : elles n'encombrent pas l'écran
    // le plus décisif, mais restent atteignables.
    await page
      .getByRole("button", { name: /Ajouter l'accès au logement/ })
      .click();
    await page.fill("#accessNotes", "Digicode 1234, portail vert");

    /*
     * Le montant du récapitulatif est relevé **avant** de confirmer, et
     * comparé à celui de la confirmation. C'est l'invariant qui compte : le
     * client paie ce qu'on lui a montré.
     *
     * Un montant écrit en dur ne le vérifiait pas et se cassait tout seul —
     * une majoration de dernière minute s'applique dès que le premier créneau
     * libre est proche, si bien que le test passait ou échouait selon le jour
     * et l'état du planning.
     */
    const recapitulatif = (await page.locator("main").innerText()).replace(
      /\s+/g,
      " ",
    );
    const devis = /(\d[\d ]*,\d{2} €)/.exec(recapitulatif)?.[1];
    expect(devis, "aucun montant sur le récapitulatif").toBeTruthy();

    await page.getByRole("button", { name: /^Réserver / }).click();

    await expect(page.getByText("C'est réservé.")).toBeVisible({
      timeout: 30_000,
    });
    // Les montants portent une espace fine insécable avant l'euro : on
    // normalise toutes les espaces Unicode plutôt que d'en énumérer deux.
    const main = await page.locator("main").innerText();
    expect(main.replace(/\s+/g, " ")).toContain(devis!);
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

  test("montre le prix avant de demander la moindre donnée d'identité", async ({
    page,
  }) => {
    // L'adresse ouvre désormais le tunnel : ce qui reste tenu, et qui décide
    // de l'abandon, est que le prix arrive avant qu'on demande qui vous êtes.
    await page.goto("/reserver");
    await saisirAdresseManuelle(page);
    await page.getByRole("button", { name: "3 h" }).click();

    await expect(
      page.getByRole("button", { name: /Tous les quinze jours/ }),
    ).toContainText("84,00", { timeout: 20_000 });

    // Aucun champ d'identité n'a été rencontré en chemin.
    await expect(page.locator("#firstName")).toHaveCount(0);
    await expect(page.locator("#email")).toHaveCount(0);
    await expect(page.locator("#phone")).toHaveCount(0);
  });

  test("ne demande l'adresse qu'une seule fois", async ({ page }) => {
    // C'est le gain du déplacement : le tunnel demandait la commune au premier
    // écran puis l'adresse complète au dernier, c'est-à-dire deux fois le même
    // renseignement. Après le premier écran, plus aucun champ d'adresse.
    await page.goto("/reserver");
    await saisirAdresseManuelle(page);

    await page.getByRole("button", { name: "3 h" }).click();
    await expect(page.locator("#address")).toHaveCount(0);
    await expect(page.locator("#manual-street")).toHaveCount(0);
  });

  test("garde la saisie quand on revient en arrière", async ({ page }) => {
    // Revenir changer un choix ne doit rien détruire : c'est le retour le plus
    // probable du parcours, et il vidait les six champs déjà remplis.
    await page.goto("/reserver");
    await saisirAdresseManuelle(page);
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
    await saisirAdresseManuelle(page);
    await page.getByRole("button", { name: "4 h" }).click();

    // Retour par une URL nue — le chemin de quelqu'un qui revient par
    // l'accueil ou par un favori, et non en rechargeant l'onglet ouvert.
    await page.goto("/reserver");

    await expect(page.getByText(/Reprendre ma réservation/)).toBeVisible();
    await page.getByRole("button", { name: /Reprendre où j'en étais/ }).click();

    /*
     * L'adresse n'est jamais enregistrée — c'est une donnée personnelle, et le
     * stockage local n'en garde aucune. Une reprise repasse donc par le
     * premier écran, puis rejoint directement l'écran où l'on en était, sans
     * refaire la durée ni le rythme.
     */
    await expect(
      page.getByRole("heading", { name: /À quelle adresse/ }),
    ).toBeVisible();
    await saisirAdresseManuelle(page);

    await expect(
      page.getByRole("heading", { name: /À quel rythme/ }),
    ).toBeVisible();
    // La durée choisie avant l'interruption est bien celle qui est chiffrée :
    // 4 h à 28 €/h en formule régulière.
    await expect(
      page.getByRole("button", { name: /Tous les quinze jours/ }),
    ).toContainText("112,00", { timeout: 20_000 });
  });

  test("annonce la reprise dès l'accueil", async ({ page }) => {
    // Un parcours interrompu ne se retrouve pas tout seul : la personne revient
    // par l'accueil, et sans bandeau elle recommence de zéro.
    await page.goto("/reserver");
    await saisirAdresseManuelle(page, "cadaujac");
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
    await saisirAdresseManuelle(page);
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
    await saisirAdresseManuelle(page, "gradignan");
    await page.getByRole("button", { name: "2 h" }).click();

    const url = new URL(page.url());
    // La commune n'est plus choisie : elle est déduite du code INSEE de
    // l'adresse. C'est elle, et jamais la rue, qui a le droit d'être dans une
    // barre d'adresse.
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
    await saisirAdresseManuelle(page);

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
    /*
     * La garde a suivi l'adresse en tête du tunnel. Elle s'exerce à deux
     * endroits, et c'est le second que ce test vérifie : la complétion marque
     * « Hors zone » et désactive tout résultat non desservi, la saisie
     * manuelle ne propose que notre référentiel. Dans les deux cas il est
     * structurellement impossible d'engager un parcours hors zone.
     */
    await page.goto("/reserver");
    await page
      .getByRole("button", { name: "Saisir mon adresse manuellement" })
      .click();

    const communes = await page
      .locator("#manual-commune option")
      .allInnerTexts();
    expect(communes).toHaveLength(16);
    expect(communes.join(" ")).toContain("Léognan");
    expect(communes.join(" ")).not.toContain("Bordeaux");
  });

  test("rouvre le tunnel là où un lien partagé s'est arrêté", async ({
    page,
  }) => {
    /*
     * Ce que l'URL sait, elle le rend — sauf l'adresse, qui n'y voyage jamais.
     * Un lien partagé rouvre donc sur l'adresse, puis saute directement à
     * l'écran où il s'était arrêté : les écrans déjà remplis ne sont pas
     * refaits.
     */
    await page.goto("/reserver?commune=cestas&surface=100&step=rythme");

    await expect(
      page.getByRole("heading", { name: /À quelle adresse/ }),
    ).toBeVisible();
    await saisirAdresseManuelle(page, "cestas");

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
    await saisirAdresseManuelle(page, "cestas");

    await expect(
      page.getByRole("heading", { name: /De combien de temps/ }),
    ).toBeVisible();
  });

  test("demande l'adresse même quand la commune est connue", async ({
    page,
  }) => {
    /*
     * Le lien des pages locales transmet la commune, mais une commune n'est
     * pas une adresse : la sauter mènerait à la redemander plus loin, ce que
     * le déplacement de l'écran sert précisément à supprimer. Elle sert en
     * revanche de repère — la saisie manuelle s'ouvre déjà sur la bonne.
     */
    await page.goto("/reserver?commune=gradignan");

    await expect(
      page.getByRole("heading", { name: /À quelle adresse/ }),
    ).toBeVisible();
    await expect(
      page.getByText("Étape 1 sur 6", { exact: true }),
    ).toBeVisible();

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

    // La sortie fonctionne, et elle fait avancer le tunnel : une complétion en
    // panne ne doit pas arrêter une réservation au premier écran.
    await saisirAdresseManuelle(page);
    await expect(
      page.getByRole("heading", { name: /De combien de temps/ }),
    ).toBeVisible();
  });

  test("offre une sortie vers quelqu'un à chaque écran", async ({ page }) => {
    await page.goto("/reserver");
    await expect(
      page.getByRole("button", { name: "Vous préférez en parler ?" }),
    ).toBeVisible();

    await saisirAdresseManuelle(page);
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
