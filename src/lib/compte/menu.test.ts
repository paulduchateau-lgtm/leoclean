import { describe, expect, it } from "vitest";

import { type ContexteCompte, composerLeMenu, destinations } from "./menu";

const VIDE: ContexteCompte = {
  attestationsFiscales: false,
  abonnement: false,
  intervenant: false,
};

function libelles(contexte: ContexteCompte): string[] {
  return composerLeMenu(contexte).flatMap((groupe) =>
    groupe.entrees.map((entree) => entree.libelle),
  );
}

describe("composerLeMenu", () => {
  /*
   * La règle centrale : rien n'est affiché qui ne mène quelque part. Le corpus
   * de référence propose « Carte cadeau » et « Compte URSSAF » ; ni l'un ni
   * l'autre n'existe ici, et les recopier reviendrait à promettre le service
   * d'un autre.
   */
  it("ne propose aucune fonction que le produit n'a pas", () => {
    const tout = libelles({
      attestationsFiscales: true,
      abonnement: true,
      intervenant: true,
    }).join(" ");

    expect(tout).not.toMatch(/carte cadeau/i);
    expect(tout).not.toMatch(/urssaf/i);
    expect(tout).not.toMatch(/avance imm/i);
  });

  /*
   * `fiscal.ts` est le seul endroit où se décide ce que le site a le droit de
   * dire du crédit d'impôt. Tant que la déclaration n'est pas obtenue, le mot
   * lui-même ne doit pas apparaître.
   */
  it("tait les attestations fiscales tant que la déclaration n'est pas obtenue", () => {
    const sans = libelles(VIDE).join(" ");
    expect(sans).not.toMatch(/attestation/i);
    expect(sans).not.toMatch(/fiscal/i);

    const avec = libelles({ ...VIDE, attestationsFiscales: true }).join(" ");
    expect(avec).toMatch(/attestations fiscales/i);
  });

  it("ne montre l'abonnement qu'à qui en a un", () => {
    expect(libelles(VIDE).join(" ")).not.toMatch(/abonnement/i);
    expect(libelles({ ...VIDE, abonnement: true }).join(" ")).toMatch(
      /abonnement/i,
    );
  });

  it("ne propose jamais la console d'administration", () => {
    // « Mon compte » est un écran client. La console y figurait pour les
    // administrateurs, ce qui mélangeait deux métiers dans le même menu et
    // l'exposait au premier regard porté sur leur écran. Elle reste
    // atteignable par son adresse, gardée par `asPlatformAdmin()` — le menu
    // n'a jamais été ce qui protégeait quoi que ce soit.
    expect(destinations(composerLeMenu(VIDE))).not.toContain("/administration");
  });

  it("ne propose la cooptation qu'aux intervenants", () => {
    expect(destinations(composerLeMenu(VIDE))).not.toContain(
      "/intervenant/cooptation",
    );
    expect(
      destinations(composerLeMenu({ ...VIDE, intervenant: true })),
    ).toContain("/intervenant/cooptation");
  });

  /* Le socle est là pour tout le monde, même un compte tout neuf. */
  it("porte toujours les données personnelles et le contact", () => {
    const chemins = destinations(composerLeMenu(VIDE));
    expect(chemins).toContain("/mon-compte/mes-donnees");
    expect(chemins).toContain("/mon-compte/connexion");
    expect(chemins).toContain("/etre-rappele");
  });

  it("ne rend aucune destination en double", () => {
    const chemins = destinations(
      composerLeMenu({
        attestationsFiscales: true,
        abonnement: true,
        intervenant: true,
      }),
    );
    expect(new Set(chemins).size).toBe(chemins.length);
  });

  it("ne rend aucun groupe vide", () => {
    for (const contexte of [VIDE, { ...VIDE, intervenant: true }]) {
      for (const groupe of composerLeMenu(contexte)) {
        expect(groupe.entrees.length).toBeGreaterThan(0);
      }
    }
  });
});
