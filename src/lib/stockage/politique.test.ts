import { describe, expect, it } from "vitest";

import {
  type Coffre,
  DUREE_URL_SIGNEE_SECONDES,
  TAILLE_MAXIMALE,
  cheminDeFichier,
  nettoyer,
  nettoyerJpeg,
  nettoyerPng,
  typeReel,
  verifierFichier,
} from "./politique";

/** Petit JPEG : SOI, un segment, puis SOS et des données. */
function jpeg(segments: { marqueur: number; charge: number[] }[]): Uint8Array {
  const octets: number[] = [0xff, 0xd8];
  for (const segment of segments) {
    const longueur = segment.charge.length + 2;
    octets.push(0xff, segment.marqueur, longueur >> 8, longueur & 0xff);
    octets.push(...segment.charge);
  }
  // SOS suivi de données compressées, puis EOI.
  octets.push(0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0x33, 0xff, 0xd9);
  return new Uint8Array(octets);
}

function png(blocs: { nom: string; charge: number[] }[]): Uint8Array {
  const octets: number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (const bloc of blocs) {
    const longueur = bloc.charge.length;
    octets.push(
      (longueur >>> 24) & 0xff,
      (longueur >>> 16) & 0xff,
      (longueur >>> 8) & 0xff,
      longueur & 0xff,
    );
    for (const caractere of bloc.nom) octets.push(caractere.charCodeAt(0));
    octets.push(...bloc.charge);
    octets.push(0, 0, 0, 0); // CRC, non vérifié ici.
  }
  return new Uint8Array(octets);
}

describe("typeReel", () => {
  it("reconnaît un JPEG", () => {
    expect(typeReel(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  });

  it("reconnaît un PNG", () => {
    expect(
      typeReel(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image/png");
  });

  it("reconnaît un WebP malgré les quatre octets de taille variables", () => {
    const octets = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x2a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(typeReel(octets)).toBe("image/webp");
  });

  it("reconnaît un PDF", () => {
    expect(typeReel(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe(
      "application/pdf",
    );
  });

  it("ne reconnaît rien dans du texte", () => {
    expect(typeReel(new TextEncoder().encode("<?php system($_GET[0]); ?>"))).toBeNull();
  });
});

describe("verifierFichier", () => {
  /*
   * Le cœur du lot : le type annoncé par le navigateur n'engage que celui qui
   * le lit. Un script renommé en `.jpg` doit échouer sur ses octets, jamais sur
   * son extension.
   */
  it("refuse un fichier déguisé en image", () => {
    const resultat = verifierFichier(
      new TextEncoder().encode("#!/bin/sh\nrm -rf /"),
      "missions",
    );
    expect(resultat).toEqual({ refus: "type-inconnu" });
  });

  it("accepte une photo dans le coffre des missions", () => {
    expect(verifierFichier(jpeg([]), "missions")).toEqual({ type: "image/jpeg" });
  });

  /*
   * Les deux coffres n'ont pas la même politique, et c'est voulu : un PDF est
   * une pièce justificative acceptable, jamais une preuve de ménage.
   */
  it("refuse un PDF parmi les photos de mission", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    expect(verifierFichier(pdf, "missions")).toEqual({ refus: "type-refuse" });
    expect(verifierFichier(pdf, "kyc")).toEqual({ type: "application/pdf" });
  });

  it("refuse un fichier vide", () => {
    expect(verifierFichier(new Uint8Array(), "kyc")).toEqual({ refus: "vide" });
  });

  it("refuse au-delà de la taille du coffre", () => {
    const trop = new Uint8Array(TAILLE_MAXIMALE.missions + 1);
    trop.set([0xff, 0xd8, 0xff]);
    expect(verifierFichier(trop, "missions")).toEqual({ refus: "trop-gros" });
  });

  it("laisse aux pièces justificatives une marge plus large qu'aux photos", () => {
    expect(TAILLE_MAXIMALE.kyc).toBeGreaterThan(TAILLE_MAXIMALE.missions);
  });
});

describe("nettoyerJpeg", () => {
  it("retire le segment EXIF", () => {
    const avec = jpeg([
      { marqueur: 0xe1, charge: [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x11] },
    ]);
    const nettoye = nettoyerJpeg(avec);

    expect(nettoye.length).toBeLessThan(avec.length);
    expect(Array.from(nettoye).join(",")).not.toContain("69,102"); // « if » d'Exif
    // L'en-tête reste un JPEG valide.
    expect(typeReel(nettoye)).toBe("image/jpeg");
  });

  it("retire aussi les commentaires", () => {
    const avec = jpeg([{ marqueur: 0xfe, charge: [0x41, 0x42, 0x43] }]);
    expect(nettoyerJpeg(avec).length).toBeLessThan(avec.length);
  });

  /*
   * `APP0` ne porte que la densité de pixels, et certains décodeurs anciens
   * l'attendent : le retirer casserait des images sans rien protéger.
   */
  it("conserve le segment JFIF", () => {
    const avec = jpeg([
      { marqueur: 0xe0, charge: [0x4a, 0x46, 0x49, 0x46, 0x00] },
    ]);
    expect(nettoyerJpeg(avec).length).toBe(avec.length);
  });

  it("conserve les données d'image intactes", () => {
    const avec = jpeg([
      { marqueur: 0xe1, charge: [0x45, 0x78, 0x69, 0x66, 0x00] },
    ]);
    const nettoye = nettoyerJpeg(avec);
    const queue = Array.from(nettoye.subarray(nettoye.length - 9));
    expect(queue).toEqual([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0x33, 0xff, 0xd9]);
  });

  it("laisse tranquille ce qui n'est pas un JPEG", () => {
    const texte = new TextEncoder().encode("bonjour");
    expect(nettoyerJpeg(texte)).toEqual(texte);
  });

  it("n'entre pas en boucle sur un fichier tronqué", () => {
    const tronque = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]);
    expect(() => nettoyerJpeg(tronque)).not.toThrow();
  });
});

describe("nettoyerPng", () => {
  it("retire les blocs de métadonnées", () => {
    const avec = png([
      { nom: "IHDR", charge: [1, 2, 3] },
      { nom: "eXIf", charge: [9, 9, 9, 9] },
      { nom: "tEXt", charge: [7, 7] },
      { nom: "IDAT", charge: [4, 5] },
      { nom: "IEND", charge: [] },
    ]);
    const nettoye = nettoyerPng(avec);

    expect(nettoye.length).toBeLessThan(avec.length);
    expect(typeReel(nettoye)).toBe("image/png");

    const texte = new TextDecoder("latin1").decode(nettoye);
    expect(texte).not.toContain("eXIf");
    expect(texte).not.toContain("tEXt");
    expect(texte).toContain("IHDR");
    expect(texte).toContain("IDAT");
    expect(texte).toContain("IEND");
  });
});

describe("nettoyer", () => {
  it("applique le traitement du type reconnu", () => {
    const avecExif = jpeg([
      { marqueur: 0xe1, charge: [0x45, 0x78, 0x69, 0x66, 0x00] },
    ]);
    expect(nettoyer(avecExif, "image/jpeg").length).toBeLessThan(avecExif.length);
  });

  /*
   * Le PDF est conservé tel quel, et c'est écrit plutôt que caché : le traiter
   * demanderait une bibliothèque, et ce n'est pas par là qu'une photo de salon
   * arrive avec sa position.
   */
  it("laisse un PDF intact", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    expect(nettoyer(pdf, "application/pdf")).toEqual(pdf);
  });
});

describe("cheminDeFichier", () => {
  it("compose un chemin sans rien du nom d'origine", () => {
    expect(
      cheminDeFichier("kyc", "clx123abc", "piece1", "application/pdf"),
    ).toBe("kyc/clx123abc/piece1.pdf");
  });

  /*
   * Un chemin composé à partir d'une saisie se traverse. La vérification n'est
   * pas une coquetterie : `../` dans un identifiant ferait écrire ailleurs.
   */
  it("refuse un identifiant qui pourrait remonter l'arborescence", () => {
    expect(() =>
      cheminDeFichier("kyc", "../../secrets", "x", "image/png"),
    ).toThrow();
    expect(() => cheminDeFichier("kyc", "abc", "../x", "image/png")).toThrow();
  });

  it("refuse un identifiant vide", () => {
    expect(() => cheminDeFichier("missions", "", "x", "image/png")).toThrow();
  });

  it("sépare les deux coffres", () => {
    const coffres: Coffre[] = ["missions", "kyc"];
    const chemins = coffres.map((coffre) =>
      cheminDeFichier(coffre, "abc", "def", "image/jpeg"),
    );
    expect(chemins[0]).toMatch(/^missions\//);
    expect(chemins[1]).toMatch(/^kyc\//);
  });
});

describe("URL signée", () => {
  it("ne vit pas assez longtemps pour être partagée", () => {
    expect(DUREE_URL_SIGNEE_SECONDES).toBeLessThanOrEqual(60);
  });
});

describe("stockage en mémoire", () => {
  it("applique la politique, nettoie, et range dans le bon coffre", async () => {
    const { stockageEnMemoire } = await import("./index");
    const stockage = stockageEnMemoire();

    const avecExif = jpeg([
      { marqueur: 0xe1, charge: [0x45, 0x78, 0x69, 0x66, 0x00, 0x2a] },
    ]);

    const depose = await stockage.deposer({
      coffre: "missions",
      proprietaireId: "clx1",
      identifiant: "avant1",
      octets: avecExif,
    });

    expect(depose.chemin).toBe("missions/clx1/avant1.jpg");
    expect(depose.taille).toBeLessThan(avecExif.length);
    expect(stockage.chemins()).toEqual(["missions/clx1/avant1.jpg"]);
  });

  it("refuse au dépôt ce que la politique refuse", async () => {
    const { stockageEnMemoire, FichierRefuseError } = await import("./index");
    const stockage = stockageEnMemoire();

    await expect(
      stockage.deposer({
        coffre: "missions",
        proprietaireId: "clx1",
        identifiant: "x",
        octets: new TextEncoder().encode("pas une image"),
      }),
    ).rejects.toBeInstanceOf(FichierRefuseError);
  });

  /*
   * La direction inverse de `TRAVEL_TIME_PROVIDER` : demander un fournisseur
   * absent échoue tout de suite et nomme ce qui manque, au lieu de dégrader en
   * silence.
   */
  it("échoue bruyamment quand aucun fournisseur distant n'est configuré", async () => {
    const { stockageDistantIndisponible } = await import("./index");
    expect(() => stockageDistantIndisponible()).toThrow(/Aucun stockage distant/);
  });
});
