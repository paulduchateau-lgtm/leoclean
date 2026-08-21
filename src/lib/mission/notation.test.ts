import { describe, expect, it } from "vitest";

import {
  DELAI_NOTATION_JOURS,
  SEUIL_TICKET_QUALITE,
  TAGS_AVIS,
  estPubliable,
  ouvreUnTicketQualite,
  verifierAvis,
} from "./notation";

const TERMINEE_LE = new Date("2026-09-10T12:00:00Z");
const MAINTENANT = new Date("2026-09-11T09:00:00Z");

function base(overrides: Partial<Parameters<typeof verifierAvis>[0]> = {}) {
  return {
    terminee: true,
    termineeLe: TERMINEE_LE,
    dejaNotee: false,
    etoiles: 5,
    maintenant: MAINTENANT,
    ...overrides,
  };
}

describe("verifierAvis", () => {
  it("accepte un avis le lendemain", () => {
    expect(verifierAvis(base())).toBeNull();
  });

  it("refuse une mission non terminée", () => {
    expect(verifierAvis(base({ terminee: false }))).toBe(
      "MISSION_NON_TERMINEE",
    );
    expect(verifierAvis(base({ termineeLe: null }))).toBe(
      "MISSION_NON_TERMINEE",
    );
  });

  it("refuse un second avis", () => {
    expect(verifierAvis(base({ dejaNotee: true }))).toBe("DEJA_NOTEE");
  });

  it("refuse une note hors des cinq étoiles", () => {
    for (const etoiles of [0, 6, -1, 2.5]) {
      expect(verifierAvis(base({ etoiles }))).toBe("NOTE_INVALIDE");
    }
  });

  it("accepte les cinq valeurs légitimes", () => {
    for (const etoiles of [1, 2, 3, 4, 5]) {
      expect(verifierAvis(base({ etoiles }))).toBeNull();
    }
  });

  /*
   * Au-delà de trente jours le souvenir est reconstruit, et la note dit surtout
   * l'humeur du moment. Laisser la porte ouverte ferait remonter des avis
   * qu'aucune action ne peut plus rattraper.
   */
  it("refuse au-delà du délai", () => {
    const tard = new Date(
      TERMINEE_LE.getTime() + (DELAI_NOTATION_JOURS + 1) * 86_400_000,
    );
    expect(verifierAvis(base({ maintenant: tard }))).toBe("TROP_TARD");
  });

  it("accepte le dernier jour du délai", () => {
    const limite = new Date(
      TERMINEE_LE.getTime() + DELAI_NOTATION_JOURS * 86_400_000,
    );
    expect(verifierAvis(base({ maintenant: limite }))).toBeNull();
  });

  /*
   * L'ordre des contrôles compte : une mission non terminée doit s'entendre
   * dire qu'elle n'est pas terminée, pas que la note est invalide.
   */
  it("signale d'abord l'état de la mission", () => {
    expect(verifierAvis(base({ terminee: false, etoiles: 99 }))).toBe(
      "MISSION_NON_TERMINEE",
    );
  });
});

describe("ticket qualité", () => {
  it("s'ouvre à trois étoiles ou moins", () => {
    expect(ouvreUnTicketQualite(1)).toBe(true);
    expect(ouvreUnTicketQualite(3)).toBe(true);
    expect(ouvreUnTicketQualite(4)).toBe(false);
    expect(ouvreUnTicketQualite(5)).toBe(false);
  });

  it("garde un seuil qui appelle vraiment quelqu'un", () => {
    expect(SEUIL_TICKET_QUALITE).toBeGreaterThanOrEqual(3);
  });
});

describe("publication", () => {
  it("ne publie pas une étoile nue", () => {
    expect(estPubliable(5, null)).toBe(false);
    expect(estPubliable(5, "   ")).toBe(false);
  });

  it("publie un bon avis commenté", () => {
    expect(estPubliable(5, "Impeccable, Sonia est adorable.")).toBe(true);
  });

  /*
   * Rien sous trois étoiles — non pour cacher, mais parce qu'un avis négatif se
   * traite avant de s'afficher : le publier pendant qu'on le traite mettrait
   * l'intervenant en cause avant toute vérification.
   */
  it("ne publie jamais un avis qui ouvre un ticket", () => {
    for (const etoiles of [1, 2, 3]) {
      expect(estPubliable(etoiles, "Décevant.")).toBe(false);
    }
  });
});

describe("tags", () => {
  it("en propose cinq, sans doublon", () => {
    expect(TAGS_AVIS).toHaveLength(5);
    expect(new Set(TAGS_AVIS).size).toBe(5);
  });
});
