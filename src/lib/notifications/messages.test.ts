import { describe, expect, it } from "vitest";

import { PREMIER_LOT_HEURES } from "@/lib/assignments/diffusion";
import {
  type Evenement,
  type Intervention,
  composer,
} from "@/lib/notifications/messages";

/**
 * Ce qu'un message n'a pas le droit de dire.
 *
 * Le contenu d'un email est du texte, donc l'endroit où une promesse se glisse
 * le plus facilement — et le seul que le destinataire garde. Ces tests tiennent
 * les règles que le reste du produit tient déjà à l'écran : ne pas confirmer ce
 * qui n'est pas acquis, ne pas nommer qui n'a pas accepté, ne pas s'excuser
 * auprès de quelqu'un qui n'a rien fait de mal.
 */

const INTERVENTION: Intervention = {
  quand: "mardi 13 janvier à 10:00",
  durationMinutes: 180,
  adresse: "12 rue des Vignes, Léognan",
  grossAmountCents: 8400,
};

const TOUS: Evenement[] = [
  { type: "demande-recue", prenom: "Camille", intervention: INTERVENTION },
  {
    type: "mission-proposee",
    prenom: "Ambre",
    intervention: INTERVENTION,
    remunerationCents: 6900,
    lienEspace: "https://leoclean.fr/intervenant",
  },
  {
    type: "intervenant-trouve",
    prenom: "Camille",
    intervenant: "Ambre",
    intervention: INTERVENTION,
  },
  { type: "mission-prise", prenom: "Micheline", intervention: INTERVENTION },
  { type: "recherche-elargie", prenom: "Camille", intervention: INTERVENTION },
  {
    type: "alternatives-disponibles",
    prenom: "Camille",
    nombre: 2,
    lienEspace: "https://leoclean.fr/mon-espace",
  },
  {
    type: "recherche-interrompue",
    prenom: "Camille",
    telephone: "06 84 36 38 62",
    alternatives: 0,
    lienEspace: "https://leoclean.fr/mon-espace",
  },
  {
    type: "rappel-veille",
    pour: "client",
    prenom: "Camille",
    intervention: INTERVENTION,
  },
];

const texteDe = (evenement: Evenement) => {
  const message = composer(evenement);
  return [message.objet, message.apercu, ...message.paragraphes].join(" ");
};

describe("messages transactionnels", () => {
  it("porte un objet, un aperçu et un corps, quel que soit l'évènement", () => {
    for (const evenement of TOUS) {
      const message = composer(evenement);
      expect(message.objet.length, evenement.type).toBeGreaterThan(10);
      expect(message.apercu.length, evenement.type).toBeGreaterThan(5);
      expect(message.paragraphes.length, evenement.type).toBeGreaterThan(1);
    }
  });

  it("ne confirme rien tant que personne n'a accepté", () => {
    /*
     * La règle la plus coûteuse du lot. Le tunnel ne vend plus un rendez-vous
     * ferme : écrire « c'est confirmé » à l'enregistrement de la demande serait
     * la promesse qu'on découvre fausse le jour du ménage.
     */
    const enRecherche = texteDe(TOUS[0]!).toLowerCase();
    expect(enRecherche).not.toContain("confirmé");
    expect(enRecherche).not.toContain("réservé");
    expect(enRecherche).toContain("cherch");
  });

  it("ne nomme personne avant l'acceptation, et le nomme après", () => {
    expect(texteDe(TOUS[0]!)).not.toContain("Ambre");
    expect(texteDe(TOUS[2]!)).toContain("Ambre");
  });

  it("dit à l'intervenant que d'autres ont reçu la même mission", () => {
    // Le taire transformerait la course en mauvaise surprise pour celui qui
    // répond le second.
    const propose = texteDe(TOUS[1]!).toLowerCase();
    expect(propose).toContain("plusieurs intervenants");
    expect(propose).toContain(`${PREMIER_LOT_HEURES} heures`);
  });

  it("annonce la rémunération, pas le prix client, à l'intervenant", () => {
    const propose = texteDe(TOUS[1]!);
    expect(propose).toContain("69,00");
    expect(propose).not.toContain("84,00");
  });

  it("ne s'excuse pas auprès de qui a perdu la course", () => {
    // La personne a répondu de bonne foi. Un « désolé » lui ferait porter une
    // faute qu'elle n'a pas commise, et son taux d'acceptation n'en souffre pas.
    const perdu = texteDe(TOUS[3]!).toLowerCase();
    expect(perdu).not.toContain("désolé");
    expect(perdu).not.toContain("malheureusement");
    expect(perdu).toContain("n'affecte en rien");
  });

  it("présente les deux options à égalité quand une alternative existe", () => {
    // Pousser vers l'alternative ferait payer au client la difficulté qu'on a
    // à couvrir son créneau.
    const alternatives = texteDe(TOUS[5]!).toLowerCase();
    expect(alternatives).toContain("accepter");
    expect(alternatives).toContain("continuer à chercher");
  });

  it("donne un numéro quand la recherche s'arrête sans alternative", () => {
    expect(texteDe(TOUS[6]!)).toContain("06 84 36 38 62");
  });

  it("écrit deux rappels différents, selon qui les lit", () => {
    const client = composer({
      type: "rappel-veille",
      pour: "client",
      prenom: "Camille",
      intervention: INTERVENTION,
    });
    const intervenant = composer({
      type: "rappel-veille",
      pour: "intervenant",
      prenom: "Ambre",
      intervention: INTERVENTION,
    });

    // Le client peut annuler et paie un barème ; l'intervenant doit prévenir
    // pour qu'on cherche un remplaçant. Les deux ne lisent pas la même chose.
    expect(client.paragraphes.join(" ")).toContain("barème");
    expect(intervenant.paragraphes.join(" ")).toContain("remplaçant");
  });

  it("n'ouvre jamais un message sans saluer", () => {
    for (const evenement of TOUS) {
      expect(composer(evenement).paragraphes[0], evenement.type).toMatch(
        /^Bonjour/,
      );
    }
  });
});

describe("fin d'intervention — ce que le mail dit et ne dit pas", () => {
  const BASE = {
    type: "intervention-terminee" as const,
    prenom: "Camille",
    intervention: INTERVENTION,
    dureeReelleMinutes: 165,
    rapportDisponible: true,
    prelevementLe: "vendredi 22 août",
    creditImpotCents: null,
    prochaineIntervention: null,
    lienEspace: "https://leoclean.fr/mon-espace",
    lienNotation: "https://leoclean.fr/mon-espace/noter?booking=b1",
  };

  it("annonce le prélèvement au futur, jamais comme un débit déjà fait", () => {
    // Le débit part à H+24 et le message à la clôture : écrire « nous avons
    // prélevé » ferait chercher sur un relevé une ligne qui n'y est pas — et
    // douter du reste du message.
    const texte = texteDe(BASE);

    expect(texte).toContain("Nous prélèverons");
    expect(texte).not.toMatch(/avons prélevé|a été prélevé|débité/i);
  });

  it("n'écrit pas un mot du crédit d'impôt tant qu'il est interdit", () => {
    // Même frontière que partout : tant que la déclaration SAP n'est pas
    // obtenue, rien de l'avantage fiscal ne s'affiche, pas même le mot.
    const texte = texteDe(BASE).toLowerCase();

    expect(texte).not.toContain("crédit d'impôt");
    expect(texte).not.toContain("après réduction");
  });

  it("l'écrit dès que l'appelant l'y autorise", () => {
    // Le composeur ne décide de rien : `fiscal.ts` tranche, il compose. Le
    // jour de la déclaration, ce mail change sans qu'on y retouche.
    const texte = texteDe({ ...BASE, creditImpotCents: 4200 });

    expect(texte).toContain("crédit d'impôt");
    // Espace fine insécable avant l'euro : `formatEuros` suit la typographie
    // française, une comparaison littérale échouerait sur l'espace.
    expect(texte).toMatch(/42,00\s?€/);
  });

  it("dit la durée réelle sans en tirer un autre montant", () => {
    // Le dépôt a tranché : la durée réelle ne refacture rien. Un second
    // montant dans ce mail se lirait comme un ajustement.
    const message = composer(BASE);
    const texte = texteDe(BASE);
    const montants = texte.match(/\d+,\d{2}\s?€/g) ?? [];

    expect(texte).toContain("2 h 45");
    expect(texte).toContain("ne change pas");
    // Un seul montant, répété : celui qui a été annoncé.
    expect(new Set(montants).size).toBe(1);
    expect(message.action?.url).toBe(BASE.lienNotation);
  });

  it("ne parle du rapport photo que s'il existe", () => {
    // Le rapport n'est jamais bloquant : l'annoncer quand il est vide enverrait
    // le client chercher des photos qui n'ont pas été prises.
    expect(texteDe(BASE)).toContain("photos");
    expect(texteDe({ ...BASE, rapportDisponible: false })).not.toContain(
      "photos",
    );
  });

  it("n'annonce un prochain passage que s'il est réellement pris", () => {
    expect(texteDe(BASE)).not.toContain("Prochain passage");
    expect(
      texteDe({ ...BASE, prochaineIntervention: "mardi 2 septembre à 09:00" }),
    ).toContain("Prochain passage");
  });
});
