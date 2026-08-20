import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";
import { PUBLISHED_COMMUNE_SLUGS } from "@/lib/communes-content";
import { FACTS } from "@/lib/facts";
import { SITE } from "@/lib/site";
import { COMMUNES } from "@/lib/territory";

/**
 * Contrat de la page d'accueil.
 *
 * La refonte narrative déplace des blocs, et un déplacement se paie en liens
 * perdus si personne ne compte. Ces tests verrouillent ce qui ne doit pas
 * bouger : le maillage interne, l'absence de chiffre inventé, et la frontière
 * fiscale. Ils portent sur le HTML réellement rendu, pas sur les constantes —
 * une donnée juste qui n'atteint pas la page ne vaut rien.
 */
const html = renderToStaticMarkup(<Home />);
/*
 * Le rendu échappe les apostrophes en `&#x27;` : sans ce retour en arrière,
 * une assertion sur une phrase française ne trouve jamais rien, et le test
 * passe pour de mauvaises raisons dès qu'il est écrit en négatif.
 */
const text = html
  .replace(/<[^>]*>/g, " ")
  .replace(/&#x27;/g, "'")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/\s+/g, " ");

/** Toutes les destinations de la page, dans l'ordre du document. */
const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]!);

describe("accueil — maillage interne", () => {
  it("garde un lien vers chacune des seize pages commune", () => {
    // C'est le risque central de la refonte : les seize liens quittaient le
    // héros, et rien n'obligeait à les retrouver plus bas. Aucun lien interne
    // ne doit être perdu par rapport à la version précédente.
    for (const slug of PUBLISHED_COMMUNE_SLUGS) {
      expect(hrefs).toContain(`/menage-a-domicile/${slug}`);
    }
    expect(PUBLISHED_COMMUNE_SLUGS).toHaveLength(COMMUNES.length);
  });

  it("ne demande plus de choisir sa commune avant d'avoir donné une raison", () => {
    // L'ancienne page ouvrait sur seize liens, c'est-à-dire un effort de
    // sélection réclamé à quelqu'un qui n'avait encore rien reçu. Le critère
    // vérifiable est l'ordre : la première commune apparaît après la thèse,
    // ses preuves et ses conséquences.
    const firstCommuneLink = html.indexOf("/menage-a-domicile/");
    const consequences = html.indexOf("Ce que ça change chez vous");

    expect(consequences).toBeGreaterThan(-1);
    expect(firstCommuneLink).toBeGreaterThan(consequences);
  });

  it("envoie toute réservation sur /reserver, sans paramètre", () => {
    const bookingLinks = hrefs.filter((href) => href.startsWith("/reserver"));

    expect(bookingLinks.length).toBeGreaterThan(0);
    for (const href of bookingLinks) {
      expect(href).toBe("/reserver");
    }
  });
});

describe("accueil — rien d'inventé", () => {
  it("n'affiche aucune métrique d'activité", () => {
    // Un nombre suivi de « clients », « avis » ou « interventions » est la
    // forme que prend toujours une preuve sociale fabriquée. Le bloc
    // d'engagement parle bien d'avis — pour dire qu'il n'y en a pas encore,
    // ce qui est l'inverse d'en inventer.
    expect(text).not.toMatch(
      /\d[\d\s]*(clients?|avis|interventions?|logements?\s+nettoyés)/i,
    );
    expect(text).not.toMatch(/clients? satisfaits?/i);
    expect(text).not.toMatch(/note moyenne/i);
  });

  it("annonce le trajet maximal réel, pas un chiffre rond", () => {
    expect(text).toContain(`${FACTS.maxDriveMinutes} min`);
  });
});

describe("accueil — ce que la page publie du fondateur", () => {
  it("ne met pas son nom sur la page qui porte l'adresse du siège", () => {
    /*
     * Le siège est le domicile du fondateur. La NAP a sa place — pied de page,
     * mentions légales, JSON-LD — mais publier « Prénom Nom, <rue> à <ville> »
     * dans le corps de l'accueil associait une identité à une adresse
     * d'habitation pour appuyer un argument qui n'en a pas besoin : ce qui rend
     * une promesse vérifiable est un SIRET, une assurance et un numéro où
     * quelqu'un décroche.
     *
     * Le test porte sur le texte rendu, pas sur un composant : c'est la page
     * entière qui doit rester propre, quelle que soit celle qui le réintroduit.
     */
    if (SITE.founder === null) return;

    expect(text).not.toContain(SITE.founder);
    for (const partie of SITE.founder.split(" ")) {
      expect(text).not.toMatch(new RegExp(`\\b${partie}\\b`));
    }
  });
});

describe("accueil — la promesse tenue", () => {
  it("dit qu'on s'occupe du reste, pas qu'on garantit la même personne", () => {
    // La promesse centrale n'est pas la continuité d'intervenant — c'est un
    // moyen, et il reste écrit plus bas comme tel. Ce que quelqu'un achète,
    // c'est de ne plus avoir à s'en occuper.
    expect(text).toContain("s'occupe du reste");
    expect(text).not.toMatch(/seule promesse qui compte/i);
  });

  it("n'annonce jamais un rendez-vous immédiat", () => {
    // Le déroulé s'arrête sur « vous profitez de votre maison » : sans le
    // délai, cela se lirait comme une confirmation acquise à la seconde, et se
    // découvrirait à la première réservation.
    expect(text).toMatch(/prévenu sous 24 h/);
  });
});

describe("accueil — frontière fiscale", () => {
  it("n'affiche aucun prix après réduction d'impôt", () => {
    // Tant que la déclaration n'est pas obtenue, le prix mis en avant est le
    // prix brut, partout. Une mention en carte de prestation promettrait un
    // droit que les prestations n'ouvrent pas encore.
    expect(text).not.toMatch(/après réduction d'impôt/i);
    expect(text).not.toMatch(/crédit d'impôt/i);
  });

  it("dit la déclaration en cours, sans numéro ni « agréé »", () => {
    expect(text).toContain("Déclaration SAP en cours");
    expect(text.toLowerCase()).not.toContain("agréé");
  });
});
