import { describe, expect, it } from "vitest";

import {
  FENETRE_APRES_HEURES,
  FENETRE_AVANT_HEURES,
  chiffrer,
  dansLaFenetre,
  dechiffrer,
  deriverClef,
} from "./chiffrement";

const CLEF = deriverClef("un-secret-de-test-suffisamment-long-pour-passer");

describe("chiffrer et déchiffrer", () => {
  it("rend exactement ce qui a été chiffré", () => {
    const clair = "Digicode 4521B, portail à gauche.";
    expect(dechiffrer(chiffrer(clair, CLEF), CLEF)).toBe(clair);
  });

  it("supporte les accents et les emojis", () => {
    const clair = "Clé chez la voisine — 3ᵉ étage 🔑";
    expect(dechiffrer(chiffrer(clair, CLEF), CLEF)).toBe(clair);
  });

  it("supporte une consigne vide", () => {
    expect(dechiffrer(chiffrer("", CLEF), CLEF)).toBe("");
  });

  /*
   * Le point qui compte : deux fois le même code doivent donner deux textes
   * chiffrés différents. Sans cela, comparer deux colonnes suffirait à savoir
   * que deux clients d'un même immeuble ont le même digicode.
   */
  it("ne produit jamais deux fois le même chiffré", () => {
    const clair = "0000";
    const paquets = new Set(
      Array.from({ length: 50 }, () => chiffrer(clair, CLEF).toString("hex")),
    );
    expect(paquets.size).toBe(50);
  });

  /*
   * GCM refuse un texte modifié plutôt que de rendre des octets douteux. Sur
   * une donnée qui commande une serrure, on préfère l'échec au doute.
   */
  it("refuse un paquet altéré", () => {
    const paquet = chiffrer("Digicode 1234", CLEF);
    paquet[paquet.length - 1] = (paquet[paquet.length - 1]! ^ 0xff) & 0xff;
    expect(() => dechiffrer(paquet, CLEF)).toThrow();
  });

  it("refuse un paquet chiffré avec une autre clé", () => {
    const autre = deriverClef("une-autre-clef-de-test-tout-aussi-longue-ok");
    expect(() => dechiffrer(chiffrer("secret", CLEF), autre)).toThrow();
  });

  it("refuse un paquet tronqué", () => {
    expect(() => dechiffrer(Buffer.alloc(8), CLEF)).toThrow(/trop court/);
  });

  it("refuse une clé trop courte", () => {
    expect(() => deriverClef("trop-court")).toThrow(/32 caractères/);
  });

  /*
   * Le clair ne doit apparaître nulle part dans le paquet : c'est la
   * vérification la plus bête et la plus utile, celle qui attrape un jour où
   * quelqu'un remplacerait le chiffrement par un encodage.
   */
  it("ne laisse pas le clair lisible dans le paquet", () => {
    const paquet = chiffrer("DIGICODE-SECRET", CLEF);
    expect(paquet.toString("latin1")).not.toContain("DIGICODE");
    expect(paquet.toString("utf8")).not.toContain("SECRET");
  });
});

describe("dansLaFenetre", () => {
  const mission = {
    debut: new Date("2026-09-10T08:00:00Z"),
    fin: new Date("2026-09-10T11:00:00Z"),
  };

  it("ouvre vingt-quatre heures avant", () => {
    expect(dansLaFenetre(mission, new Date("2026-09-09T08:00:00Z"))).toBe(true);
  });

  it("reste fermée une minute plus tôt", () => {
    expect(dansLaFenetre(mission, new Date("2026-09-09T07:59:00Z"))).toBe(
      false,
    );
  });

  it("est ouverte pendant la mission", () => {
    expect(dansLaFenetre(mission, new Date("2026-09-10T09:30:00Z"))).toBe(true);
  });

  it("reste ouverte deux heures après la fin", () => {
    expect(dansLaFenetre(mission, new Date("2026-09-10T13:00:00Z"))).toBe(true);
  });

  it("se ferme au-delà", () => {
    expect(dansLaFenetre(mission, new Date("2026-09-10T13:01:00Z"))).toBe(
      false,
    );
  });

  /*
   * Un compte compromis hors fenêtre ne donne accès à aucun domicile : c'est
   * tout l'intérêt, et c'est ce que ce test protège.
   */
  it("reste fermée des semaines avant et après", () => {
    expect(dansLaFenetre(mission, new Date("2026-08-01T08:00:00Z"))).toBe(
      false,
    );
    expect(dansLaFenetre(mission, new Date("2026-10-01T08:00:00Z"))).toBe(
      false,
    );
  });

  it("annonce une fenêtre étroite, pas confortable", () => {
    expect(FENETRE_AVANT_HEURES).toBeLessThanOrEqual(24);
    expect(FENETRE_APRES_HEURES).toBeLessThanOrEqual(4);
  });
});
