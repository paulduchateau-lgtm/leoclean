import { describe, expect, it } from "vitest";

import {
  LONGUEUR_MAXIMALE,
  LONGUEUR_MINIMALE,
  aReencoder,
  empreinteFactice,
  hacher,
  verifier,
  verifierMotDePasse,
} from "./mot-de-passe";

describe("verifierMotDePasse", () => {
  it("accepte une phrase ordinaire", () => {
    expect(verifierMotDePasse("le chat dort sur le radiateur")).toBeNull();
  });

  it("refuse en deçà de la longueur minimale", () => {
    expect(verifierMotDePasse("a".repeat(LONGUEUR_MINIMALE - 1))).toBe(
      "TROP_COURT",
    );
  });

  it("borne la longueur, pour ne pas faire travailler la dérivation pour rien", () => {
    expect(verifierMotDePasse("x".repeat(LONGUEUR_MAXIMALE + 1))).toBe(
      "TROP_LONG",
    );
  });

  /*
   * La règle qui compte : aucune composition n'est exigée. Un mot de passe
   * long et entièrement en minuscules doit passer, sinon on pousse les gens
   * vers `Motdepasse1!`.
   */
  it("n'exige ni majuscule, ni chiffre, ni caractère spécial", () => {
    expect(verifierMotDePasse("quatremotsdanslordre")).toBeNull();
  });

  it("refuse les mots de passe les plus employés", () => {
    expect(verifierMotDePasse("motdepasse")).toBe("TROP_COURANT");
    expect(verifierMotDePasse("azertyuiop")).toBe("TROP_COURANT");
  });

  it("voit à travers les substitutions naïves", () => {
    /* `M0td3p@sse` n'est pas plus dur à deviner que `motdepasse`. */
    expect(verifierMotDePasse("M0td3p@sse")).toBe("TROP_COURANT");
  });

  it("refuse une suite d'un seul caractère répété", () => {
    expect(verifierMotDePasse("aaaaaaaaaaaa")).toBe("TROP_COURANT");
    expect(verifierMotDePasse("ababababab")).toBe("TROP_COURANT");
  });

  it("refuse un mot de passe qui contient l'adresse", () => {
    expect(
      verifierMotDePasse("marion et son chat", { email: "marion@exemple.fr" }),
    ).toBe("CONTIENT_IDENTITE");
  });

  it("voit à travers l'adressage plus", () => {
    expect(
      verifierMotDePasse("ambre et le radiateur", {
        email: "paul+ambre@gmail.com",
      }),
    ).toBe("CONTIENT_IDENTITE");
  });

  it("refuse un mot de passe qui contient le nom", () => {
    expect(
      verifierMotDePasse("duchateau et le chat", { nom: "Paul Duchateau" }),
    ).toBe("CONTIENT_IDENTITE");
  });

  /*
   * En deçà de quatre lettres, la coïncidence l'emporte sur l'indice : refuser
   * tout mot de passe contenant « an » parce que la personne s'appelle Ana
   * rendrait la règle absurde.
   */
  it("ignore les fragments d'identité trop courts", () => {
    expect(
      verifierMotDePasse("le chat dort au soleil", { nom: "Ana Li" }),
    ).toBeNull();
  });
});

describe("hacher et verifier", () => {
  it("reconnaît le bon mot de passe", async () => {
    const empreinte = await hacher("le chat dort sur le radiateur");
    await expect(
      verifier("le chat dort sur le radiateur", empreinte),
    ).resolves.toBe(true);
  });

  it("refuse un mot de passe différent d'un seul caractère", async () => {
    const empreinte = await hacher("le chat dort sur le radiateur");
    await expect(
      verifier("le chat dort sur le radiateuR", empreinte),
    ).resolves.toBe(false);
  });

  /* Deux empreintes du même mot de passe diffèrent : le sel fait son travail. */
  it("sale chaque empreinte", async () => {
    const [une, autre] = await Promise.all([
      hacher("le chat dort sur le radiateur"),
      hacher("le chat dort sur le radiateur"),
    ]);
    expect(une).not.toBe(autre);
  });

  it("porte ses paramètres dans l'empreinte", async () => {
    const empreinte = await hacher("le chat dort sur le radiateur");
    expect(empreinte.startsWith("scrypt$32768$8$1$")).toBe(true);
    expect(empreinte.split("$")).toHaveLength(6);
  });

  /*
   * Deux formes Unicode du même texte doivent ouvrir le même compte : un
   * clavier macOS produit « é » décomposé, un clavier Windows le produit
   * composé, et la personne a tapé la même chose.
   */
  it("normalise les formes Unicode", async () => {
    const compose = "un été à Léognan";
    const decompose = compose.normalize("NFD");
    expect(compose).not.toBe(decompose);

    const empreinte = await hacher(compose);
    await expect(verifier(decompose, empreinte)).resolves.toBe(true);
  });

  /*
   * Une empreinte illisible rend faux, elle ne lève pas : lever ferait
   * remonter une erreur serveur là où la réponse correcte est un refus.
   */
  it("ne lève jamais sur une empreinte corrompue", async () => {
    for (const corrompue of [
      "",
      "bcrypt$1$2$3$4$5",
      "scrypt$pas-un-nombre$8$1$AAAA$BBBB",
      "scrypt$32768$8$1$",
      "n'importe quoi",
    ]) {
      await expect(verifier("le chat dort", corrompue)).resolves.toBe(false);
    }
  });
});

describe("aReencoder", () => {
  it("laisse tranquille une empreinte aux paramètres du jour", async () => {
    expect(aReencoder(await hacher("le chat dort sur le radiateur"))).toBe(
      false,
    );
  });

  it("désigne une empreinte moins coûteuse à réencoder", () => {
    expect(aReencoder("scrypt$16384$8$1$AAAA$BBBB")).toBe(true);
  });

  it("désigne un algorithme abandonné", () => {
    expect(aReencoder("bcrypt$10$AAAA")).toBe(true);
  });
});

describe("empreinteFactice", () => {
  it("est stable dans le processus, pour ne pas doubler le coût", async () => {
    const [une, autre] = await Promise.all([
      empreinteFactice(),
      empreinteFactice(),
    ]);
    expect(une).toBe(autre);
  });

  /* Elle ne doit ouvrir aucun compte, même avec un mot de passe vide. */
  it("ne correspond à rien", async () => {
    const factice = await empreinteFactice();
    await expect(verifier("", factice)).resolves.toBe(false);
    await expect(verifier("motdepasse", factice)).resolves.toBe(false);
  });
});
