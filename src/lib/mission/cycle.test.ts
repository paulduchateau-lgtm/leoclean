import { describe, expect, it } from "vitest";

import {
  AVANCE_MAXIMALE_MINUTES,
  PHOTOS_MINIMALES_PAR_PHASE,
  TOLERANCE_METRES,
  TYPES_ANOMALIE,
  distanceMetres,
  dureeReelleMinutes,
  ecartDuree,
  methodePointage,
  peutProposerUnAjustement,
  rapportComplet,
  verifierPointage,
} from "./cycle";

const DEBUT = new Date("2026-09-10T08:00:00Z");
const LOGEMENT = { lat: 44.7264, lng: -0.5983 };

function etat(overrides: Partial<Parameters<typeof verifierPointage>[1]> = {}) {
  return {
    affectee: true,
    arriveeA: null,
    departA: null,
    debutPrevu: DEBUT,
    ...overrides,
  };
}

describe("verifierPointage", () => {
  it("accepte une arrivée à l'heure", () => {
    expect(verifierPointage("ARRIVEE", etat(), DEBUT)).toBeNull();
  });

  it("accepte une arrivée en retard", () => {
    const tard = new Date(DEBUT.getTime() + 45 * 60_000);
    expect(verifierPointage("ARRIVEE", etat(), tard)).toBeNull();
  });

  it("accepte une arrivée une heure en avance", () => {
    const avance = new Date(DEBUT.getTime() - AVANCE_MAXIMALE_MINUTES * 60_000);
    expect(verifierPointage("ARRIVEE", etat(), avance)).toBeNull();
  });

  /*
   * Pointer trois heures avant n'est pas une arrivée en avance : c'est une
   * erreur de manipulation, ou un pointage depuis chez soi — ce que la
   * tolérance de position n'attrape pas si la position est refusée.
   */
  it("refuse une arrivée trop en avance", () => {
    const trop = new Date(DEBUT.getTime() - 3 * 3_600_000);
    expect(verifierPointage("ARRIVEE", etat(), trop)).toBe("TROP_TOT");
  });

  it("refuse un second pointage d'arrivée", () => {
    expect(verifierPointage("ARRIVEE", etat({ arriveeA: DEBUT }), DEBUT)).toBe(
      "DEJA_ARRIVE",
    );
  });

  it("refuse un départ sans arrivée", () => {
    expect(verifierPointage("DEPART", etat(), DEBUT)).toBe("PAS_ENCORE_ARRIVE");
  });

  it("accepte un départ après une arrivée", () => {
    expect(
      verifierPointage("DEPART", etat({ arriveeA: DEBUT }), DEBUT),
    ).toBeNull();
  });

  it("refuse tout pointage sur une mission déjà terminée", () => {
    const termine = etat({ arriveeA: DEBUT, departA: DEBUT });
    expect(verifierPointage("ARRIVEE", termine, DEBUT)).toBe("DEJA_TERMINE");
    expect(verifierPointage("DEPART", termine, DEBUT)).toBe("DEJA_TERMINE");
  });

  it("refuse quiconque n'a pas la mission", () => {
    expect(verifierPointage("ARRIVEE", etat({ affectee: false }), DEBUT)).toBe(
      "MISSION_NON_ACCEPTEE",
    );
  });
});

describe("distanceMetres", () => {
  it("rend zéro pour le même point", () => {
    expect(distanceMetres(LOGEMENT, LOGEMENT)).toBe(0);
  });

  it("mesure une centaine de mètres avec une précision suffisante", () => {
    // 0,001° de latitude ≈ 111 m.
    const voisin = { lat: LOGEMENT.lat + 0.001, lng: LOGEMENT.lng };
    expect(distanceMetres(LOGEMENT, voisin)).toBeGreaterThan(105);
    expect(distanceMetres(LOGEMENT, voisin)).toBeLessThan(118);
  });

  it("est symétrique", () => {
    const autre = { lat: 44.73, lng: -0.6 };
    expect(distanceMetres(LOGEMENT, autre)).toBeCloseTo(
      distanceMetres(autre, LOGEMENT),
      6,
    );
  });
});

describe("methodePointage", () => {
  it("retient la position quand elle est proche", () => {
    const resultat = methodePointage({
      position: { lat: LOGEMENT.lat + 0.0005, lng: LOGEMENT.lng },
      logement: LOGEMENT,
      codeClientFourni: false,
      horsLigne: false,
    });
    expect(resultat.methode).toBe("POSITION");
    expect(resultat.distanceMetres).toBeLessThan(TOLERANCE_METRES);
  });

  /*
   * Hors tolérance, le pointage est **assumé**, jamais refusé : un sous-sol ou
   * un immeuble mal géocodé ne doit pas empêcher de travailler.
   */
  it("bascule en manuel hors tolérance, sans refuser", () => {
    const resultat = methodePointage({
      position: { lat: LOGEMENT.lat + 0.02, lng: LOGEMENT.lng },
      logement: LOGEMENT,
      codeClientFourni: false,
      horsLigne: false,
    });
    expect(resultat.methode).toBe("MANUEL");
    expect(resultat.distanceMetres).toBeGreaterThan(TOLERANCE_METRES);
  });

  it("retient le code du client quand la position est refusée", () => {
    expect(
      methodePointage({
        position: null,
        logement: LOGEMENT,
        codeClientFourni: true,
        horsLigne: false,
      }).methode,
    ).toBe("CODE_CLIENT");
  });

  it("retient le manuel sans position ni code", () => {
    expect(
      methodePointage({
        position: null,
        logement: LOGEMENT,
        codeClientFourni: false,
        horsLigne: false,
      }).methode,
    ).toBe("MANUEL");
  });

  it("marque un pointage hors ligne comme tel, position ou non", () => {
    expect(
      methodePointage({
        position: LOGEMENT,
        logement: LOGEMENT,
        codeClientFourni: false,
        horsLigne: true,
      }).methode,
    ).toBe("HORS_LIGNE");
  });
});

describe("durée réelle", () => {
  it("compte les minutes écoulées", () => {
    const arrivee = new Date("2026-09-10T08:05:00Z");
    const depart = new Date("2026-09-10T10:35:00Z");
    expect(dureeReelleMinutes(arrivee, depart)).toBe(150);
  });

  /*
   * Arrondi vers le bas : compter une minute entamée comme faite gonflerait
   * mécaniquement toutes les durées, et c'est sur cette grandeur que se lisent
   * les écarts d'estimation.
   */
  it("arrondit à la minute inférieure", () => {
    const arrivee = new Date("2026-09-10T08:00:00Z");
    const depart = new Date("2026-09-10T08:01:59Z");
    expect(dureeReelleMinutes(arrivee, depart)).toBe(1);
  });

  it("ne descend jamais sous zéro", () => {
    const arrivee = new Date("2026-09-10T10:00:00Z");
    const depart = new Date("2026-09-10T08:00:00Z");
    expect(dureeReelleMinutes(arrivee, depart)).toBe(0);
  });

  it("dit l'écart dans les deux sens", () => {
    expect(ecartDuree(150, 170)).toBe(20);
    expect(ecartDuree(150, 130)).toBe(-20);
    expect(ecartDuree(150, 150)).toBe(0);
  });
});

describe("rapportComplet", () => {
  it("exige deux photos de chaque côté", () => {
    expect(rapportComplet({ avant: 2, apres: 2 })).toBe(true);
    expect(rapportComplet({ avant: 2, apres: 1 })).toBe(false);
    expect(rapportComplet({ avant: 0, apres: 4 })).toBe(false);
  });

  it("garde un minimum modeste", () => {
    expect(PHOTOS_MINIMALES_PAR_PHASE).toBeLessThanOrEqual(2);
  });
});

describe("anomalies", () => {
  it("en propose six, sans doublon", () => {
    expect(TYPES_ANOMALIE).toHaveLength(6);
    expect(new Set(TYPES_ANOMALIE).size).toBe(6);
  });

  /*
   * Une seule anomalie peut proposer un ajustement, et la proposition ne
   * facture rien : un supplément appliqué unilatéralement par celui qui en
   * bénéficie n'est pas un ajustement, c'est une facture non consentie.
   */
  it("n'autorise l'ajustement de durée que sur un logement très sale", () => {
    for (const type of TYPES_ANOMALIE) {
      expect(peutProposerUnAjustement(type)).toBe(
        type === "LOGEMENT_TRES_SALE",
      );
    }
  });
});
