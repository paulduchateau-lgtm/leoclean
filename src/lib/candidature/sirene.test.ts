import { describe, expect, it } from "vitest";

import { APE_ATTENDUS, nomsConcordent, verifierSiret } from "./sirene";

/** SIRET valide au sens de Luhn : celui de l'INSEE elle-même. */
const SIRET_VALIDE = "18004301400000";
const MAINTENANT = new Date("2026-09-01T09:00:00Z");

function reponse(corps: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(corps), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
}

function etablissement(overrides: Record<string, unknown> = {}) {
  return {
    etablissement: {
      siret: SIRET_VALIDE,
      dateCreationEtablissement: "2019-04-01",
      uniteLegale: {
        nomUniteLegale: "DIALLO",
        prenom1UniteLegale: "Fatou",
        activitePrincipaleUniteLegale: "81.21Z",
        etatAdministratifUniteLegale: "A",
      },
      periodesEtablissement: [
        {
          etatAdministratifEtablissement: "A",
          activitePrincipaleEtablissement: "81.21Z",
        },
      ],
      ...overrides,
    },
  };
}

describe("verifierSiret", () => {
  /*
   * Le contrôle de Luhn s'exécute avant tout appel : une faute de frappe se
   * détecte sans interroger personne, et c'est la vérification la plus rentable
   * du formulaire.
   */
  it("refuse une clé invalide sans appeler l'INSEE", async () => {
    let appele = false;
    const resultat = await verifierSiret("18004301400001", {
      jeton: "x",
      fetcher: (async () => {
        appele = true;
        return new Response("{}");
      }) as unknown as typeof fetch,
    });

    expect(resultat).toEqual({ ok: false, refus: "CLE_INVALIDE" });
    expect(appele).toBe(false);
  });

  it("refuse une longueur incorrecte", async () => {
    const resultat = await verifierSiret("123", { jeton: "x" });
    expect(resultat).toEqual({ ok: false, refus: "LONGUEUR" });
  });

  it("accepte un établissement actif et en tire les informations", async () => {
    const resultat = await verifierSiret(SIRET_VALIDE, {
      jeton: "x",
      maintenant: MAINTENANT,
      fetcher: reponse(etablissement()),
    });

    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;
    expect(resultat.etablissement.siren).toBe("180043014");
    expect(resultat.etablissement.raisonSociale).toBe("Fatou DIALLO");
    expect(resultat.etablissement.codeApe).toBe("81.21Z");
    expect(resultat.etablissement.signaux).toEqual([]);
  });

  it("refuse un établissement cessé", async () => {
    const resultat = await verifierSiret(SIRET_VALIDE, {
      jeton: "x",
      fetcher: reponse(
        etablissement({
          periodesEtablissement: [{ etatAdministratifEtablissement: "F" }],
        }),
      ),
    });
    expect(resultat).toEqual({ ok: false, refus: "CESSE" });
  });

  it("refuse un SIRET introuvable", async () => {
    const resultat = await verifierSiret(SIRET_VALIDE, {
      jeton: "x",
      fetcher: reponse({}, 404),
    });
    expect(resultat).toEqual({ ok: false, refus: "INTROUVABLE" });
  });

  /*
   * Le point qui compte : confondre une panne de l'INSEE avec un SIRET
   * introuvable ferait perdre tous les candidats d'une matinée
   * d'indisponibilité. Le premier laisse continuer, le second arrête.
   */
  it("distingue une panne d'un SIRET introuvable", async () => {
    const panne = await verifierSiret(SIRET_VALIDE, {
      jeton: "x",
      fetcher: reponse({}, 503),
    });
    expect(panne).toEqual({ ok: false, refus: "SERVICE_INDISPONIBLE" });

    const reseau = await verifierSiret(SIRET_VALIDE, {
      jeton: "x",
      fetcher: (async () => {
        throw new Error("réseau");
      }) as unknown as typeof fetch,
    });
    expect(reseau).toEqual({ ok: false, refus: "SERVICE_INDISPONIBLE" });
  });

  it("ne prétend pas avoir vérifié sans jeton", async () => {
    const resultat = await verifierSiret(SIRET_VALIDE, {});
    expect(resultat).toEqual({ ok: false, refus: "SERVICE_INDISPONIBLE" });
  });

  it("se protège d'une réponse inattendue", async () => {
    const resultat = await verifierSiret(SIRET_VALIDE, {
      jeton: "x",
      fetcher: reponse({ surprise: true }),
    });
    expect(resultat).toEqual({ ok: false, refus: "SERVICE_INDISPONIBLE" });
  });
});

describe("signaux d'attention", () => {
  /*
   * Un code APE inattendu n'est pas un refus : un auto-entrepreneur cumule
   * souvent plusieurs activités, et le code principal n'est pas toujours celui
   * qu'il exerce le plus.
   */
  it("signale un APE inattendu sans refuser", async () => {
    const resultat = await verifierSiret(SIRET_VALIDE, {
      jeton: "x",
      maintenant: MAINTENANT,
      fetcher: reponse(
        etablissement({
          periodesEtablissement: [
            {
              etatAdministratifEtablissement: "A",
              activitePrincipaleEtablissement: "62.01Z",
            },
          ],
        }),
      ),
    });

    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;
    expect(resultat.etablissement.signaux).toContain("APE_INATTENDU");
  });

  /*
   * La moitié du vivier vient précisément de créer son auto-entreprise, souvent
   * pour nous : c'est un rappel de vérifier les autres pièces, pas un rejet.
   */
  it("signale un établissement récent sans refuser", async () => {
    const resultat = await verifierSiret(SIRET_VALIDE, {
      jeton: "x",
      maintenant: MAINTENANT,
      fetcher: reponse(
        etablissement({ dateCreationEtablissement: "2026-08-15" }),
      ),
    });

    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;
    expect(resultat.etablissement.signaux).toContain("SIRET_RECENT");
  });

  it("reconnaît les codes APE du nettoyage", () => {
    expect(APE_ATTENDUS).toContain("8121Z");
    expect(APE_ATTENDUS).toContain("9700Z");
  });
});

describe("nomsConcordent", () => {
  /*
   * Refuser « Marie-Claire DUPONT » face à « Dupont Marie Claire » ferait
   * échouer des dossiers parfaitement réguliers, pour un signal qui n'est même
   * pas bloquant.
   */
  it("ignore la casse, les accents, les tirets et l'ordre", () => {
    expect(nomsConcordent("Marie-Claire DUPONT", "Dupont Marie Claire")).toBe(
      true,
    );
    expect(nomsConcordent("Fatou Diallo", "DIALLO Fatou")).toBe(true);
    expect(nomsConcordent("Hélène Rê", "Helene Re")).toBe(true);
  });

  it("distingue deux personnes différentes", () => {
    expect(nomsConcordent("Fatou Diallo", "Marc Dupont")).toBe(false);
    expect(nomsConcordent("Fatou Diallo", "Fatou Diallo Sarl")).toBe(false);
  });
});
