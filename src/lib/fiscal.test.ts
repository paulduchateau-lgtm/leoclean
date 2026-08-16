import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FISCAL,
  afterTaxCreditCents,
  canShowTaxCredit,
  creditImpotConditions,
} from "@/lib/fiscal";

/**
 * Recharge le module avec un environnement et une identité donnés.
 *
 * Le statut est dérivé au chargement — c'est ce qui garantit qu'aucune page ne
 * décide seule d'afficher une mention fiscale. Le tester suppose donc de
 * réimporter, pas de muter.
 */
async function loadFiscal({
  declaredFlag,
  declarationNumber,
}: {
  declaredFlag: boolean;
  declarationNumber: string | null;
}) {
  vi.resetModules();

  vi.doMock("@/lib/env", () => ({
    clientEnv: { NEXT_PUBLIC_SAP_DECLARED: declaredFlag },
  }));
  vi.doMock("@/lib/site", () => ({
    SITE: { sapDeclarationNumber: declarationNumber },
  }));

  return import("@/lib/fiscal");
}

afterEach(() => {
  vi.doUnmock("@/lib/env");
  vi.doUnmock("@/lib/site");
  vi.resetModules();
});

describe("régime fiscal", () => {
  it("n'affirme rien tant que la déclaration n'est pas obtenue", () => {
    // État du dépôt aujourd'hui : dossier déposé, non instruit. Le site le dit
    // et s'arrête là — pas de numéro, pas de « agréé », pas de prix après
    // réduction.
    expect(FISCAL.sap.status).toBe("pending");
    expect(FISCAL.sap.number).toBeNull();
    expect(FISCAL.sap.label).toBe("Déclaration SAP en cours");
    expect(canShowTaxCredit()).toBe(false);
  });

  it("n'écrit jamais « agréé »", () => {
    // L'entretien de la maison relève de la déclaration ; l'agrément est
    // réservé aux activités auprès de publics fragiles. Employer le mauvais
    // terme revendique un régime qu'on n'a pas.
    expect(FISCAL.sap.label.toLowerCase()).not.toContain("agré");
  });

  it("bascule sur le drapeau d'environnement et le numéro, ensemble", async () => {
    const fiscal = await loadFiscal({
      declaredFlag: true,
      declarationNumber: "SAP898228705",
    });

    expect(fiscal.FISCAL.sap.status).toBe("declared");
    expect(fiscal.FISCAL.sap.number).toBe("SAP898228705");
    expect(fiscal.FISCAL.sap.label).toBe("Déclaration SAP n° SAP898228705");
    expect(fiscal.canShowTaxCredit()).toBe(true);
  });

  it("refuse de basculer sur le drapeau seul, sans numéro", async () => {
    // Un statut « déclaré » sans numéro afficherait une mention invérifiable,
    // ce qui est exactement ce que la mention sert à éviter. La direction sûre
    // est celle qui n'affirme rien : le drapeau ne suffit pas.
    const fiscal = await loadFiscal({
      declaredFlag: true,
      declarationNumber: null,
    });

    expect(fiscal.FISCAL.sap.status).toBe("pending");
    expect(fiscal.canShowTaxCredit()).toBe(false);
  });

  it("ne bascule pas sur le numéro seul, sans le drapeau", async () => {
    const fiscal = await loadFiscal({
      declaredFlag: false,
      declarationNumber: "SAP898228705",
    });

    expect(fiscal.FISCAL.sap.status).toBe("pending");
    expect(fiscal.FISCAL.sap.number).toBeNull();
    expect(fiscal.canShowTaxCredit()).toBe(false);
  });

  it("calcule le reste à charge même quand il n'est pas affichable", () => {
    // Le dépôt calcule et stocke toujours le crédit d'impôt : seul l'affichage
    // est conditionné. Une fonction qui refuserait de calculer en attendant la
    // déclaration ferait diverger le site de la base.
    expect(afterTaxCreditCents(2900)).toBe(1450);
    expect(afterTaxCreditCents(3300)).toBe(1650);
  });

  it("ne perd pas de centime sur un montant impair", () => {
    // La moitié de 2 901 centimes n'est pas un entier. L'arrondi part du
    // montant retenu, jamais des deux parts calculées séparément, faute de quoi
    // la somme ne retomberait pas juste.
    const gross = 2901;
    const net = afterTaxCreditCents(gross);
    expect(net + Math.round((gross * FISCAL.creditImpot.rateBp) / 10_000)).toBe(
      gross,
    );
  });

  it("énonce les conditions sans promettre l'avance immédiate", () => {
    // L'avance immédiate suppose l'adhésion au service Urssaf et un circuit de
    // paiement raccordé : être déclaré ne suffit pas à la promettre, d'où son
    // interrupteur distinct.
    expect(FISCAL.creditImpot.aiciEnabled).toBe(false);

    // `Intl` sépare les milliers par une espace fine insécable, conformément à
    // la typographie française : on normalise avant de comparer plutôt que de
    // recopier un caractère invisible dans l'attendu.
    const conditions = creditImpotConditions().replace(/\s/g, " ");
    expect(conditions).toContain("50 %");
    expect(conditions).toContain("12 000 €");
    expect(conditions).not.toContain("avance immédiate");
  });
});
