import { describe, expect, it } from "vitest";

import {
  AUTORISATION_VALIDITE_JOURS,
  ECHECS_AVANT_SUSPENSION,
  PREAUTORISATION_HEURES_AVANT,
  PRELEVEMENT_HEURES_APRES,
  autorisationTiendra,
  instantDePrelevement,
  instantDePreautorisation,
  prochaineEtapePaiement,
  prochaineRelance,
  prochainReversement,
} from "./calendrier";

const DEBUT = new Date("2026-09-10T08:00:00Z");
const FIN = new Date("2026-09-10T11:00:00Z");

function etat(
  overrides: Partial<Parameters<typeof prochaineEtapePaiement>[0]> = {},
) {
  return {
    statutReservation: "CONFIRMED",
    autorisee: false,
    capturee: false,
    debutMission: DEBUT,
    finMission: FIN,
    termineeA: null,
    ...overrides,
  };
}

describe("instants", () => {
  it("préautorise vingt-quatre heures avant", () => {
    expect(instantDePreautorisation(DEBUT).toISOString()).toBe(
      "2026-09-09T08:00:00.000Z",
    );
  });

  it("prélève vingt-quatre heures après la fin", () => {
    expect(instantDePrelevement(FIN).toISOString()).toBe(
      "2026-09-11T11:00:00.000Z",
    );
  });
});

describe("fenêtre d'autorisation", () => {
  /*
   * Une autorisation bancaire expire au bout de sept jours. La poser à la
   * réservation — parfois trois semaines à l'avance — la rendrait caduque avant
   * la mission, et le prélèvement échouerait sur toutes les réservations prises
   * à l'avance, c'est-à-dire sur les meilleures.
   */
  it("tient largement pour une mission ordinaire", () => {
    expect(autorisationTiendra({ debut: DEBUT, fin: FIN })).toBe(true);
  });

  it("tient encore pour une mission de six heures", () => {
    const finLongue = new Date(DEBUT.getTime() + 6 * 3_600_000);
    expect(autorisationTiendra({ debut: DEBUT, fin: finLongue })).toBe(true);
  });

  /*
   * Le garde-fou : le jour où quelqu'un allongera l'un des deux délais, il
   * l'apprendra ici plutôt qu'au moment du débit, quand la prestation est déjà
   * faite.
   */
  it("laisse une marge d'au moins quatre jours sur la limite bancaire", () => {
    const heuresUtilisees =
      PREAUTORISATION_HEURES_AVANT + 6 + PRELEVEMENT_HEURES_APRES;
    expect(heuresUtilisees / 24).toBeLessThan(AUTORISATION_VALIDITE_JOURS - 3);
  });

  it("refuse un calendrier qui dépasserait la fenêtre", () => {
    const finImpossible = new Date(DEBUT.getTime() + 10 * 86_400_000);
    expect(autorisationTiendra({ debut: DEBUT, fin: finImpossible })).toBe(
      false,
    );
  });
});

describe("prochaineEtapePaiement", () => {
  it("attend tant que H-24 n'est pas atteint", () => {
    expect(
      prochaineEtapePaiement(etat(), new Date("2026-09-08T08:00:00Z")),
    ).toBe("ATTENDRE");
  });

  it("préautorise à H-24 pile", () => {
    expect(
      prochaineEtapePaiement(etat(), new Date("2026-09-09T08:00:00Z")),
    ).toBe("PREAUTORISER");
  });

  it("n'autorise pas deux fois", () => {
    expect(
      prochaineEtapePaiement(
        etat({ autorisee: true }),
        new Date("2026-09-09T12:00:00Z"),
      ),
    ).toBe("ATTENDRE");
  });

  /*
   * Le point le plus important du module. Sans la condition de clôture, une
   * mission que personne n'a faite serait encaissée vingt-quatre heures après
   * l'heure prévue — et le client découvrirait le débit avant de découvrir
   * l'absence.
   */
  it("ne prélève jamais une mission qui n'est pas terminée", () => {
    for (const statut of ["CONFIRMED", "ASSIGNED", "IN_PROGRESS"]) {
      expect(
        prochaineEtapePaiement(
          etat({ autorisee: true, statutReservation: statut }),
          new Date("2026-09-20T08:00:00Z"),
        ),
      ).toBe("ATTENDRE");
    }
  });

  it("ne prélève pas une mission terminée sans instant de clôture", () => {
    expect(
      prochaineEtapePaiement(
        etat({ autorisee: true, statutReservation: "COMPLETED" }),
        new Date("2026-09-20T08:00:00Z"),
      ),
    ).toBe("ATTENDRE");
  });

  it("prélève vingt-quatre heures après la clôture réelle", () => {
    const termineeA = new Date("2026-09-10T11:30:00Z");
    const juste = prochaineEtapePaiement(
      etat({ autorisee: true, statutReservation: "COMPLETED", termineeA }),
      new Date("2026-09-11T11:30:00Z"),
    );
    expect(juste).toBe("PRELEVER");
  });

  it("compte depuis la clôture réelle, pas depuis l'heure prévue", () => {
    // Terminée trois heures en retard : le prélèvement décale d'autant.
    const termineeA = new Date("2026-09-10T14:00:00Z");
    expect(
      prochaineEtapePaiement(
        etat({ autorisee: true, statutReservation: "COMPLETED", termineeA }),
        new Date("2026-09-11T12:00:00Z"),
      ),
    ).toBe("ATTENDRE");
  });

  /*
   * Une autorisation posée sur une mission annulée immobilise le plafond de la
   * carte pendant sept jours. C'est le genre de détail dont on se souvient au
   * moment de choisir un prestataire.
   */
  it("libère l'autorisation d'une mission annulée", () => {
    for (const statut of [
      "CANCELLED_BY_CLIENT",
      "CANCELLED_BY_CLEANER",
      "NO_SHOW",
    ]) {
      expect(
        prochaineEtapePaiement(
          etat({ autorisee: true, statutReservation: statut }),
          new Date("2026-09-09T12:00:00Z"),
        ),
      ).toBe("LIBERER");
    }
  });

  it("n'a rien à libérer si rien n'a été autorisé", () => {
    expect(
      prochaineEtapePaiement(
        etat({ statutReservation: "CANCELLED_BY_CLIENT" }),
        new Date("2026-09-09T12:00:00Z"),
      ),
    ).toBe("ATTENDRE");
  });

  it("ne fait plus rien une fois capturé", () => {
    expect(
      prochaineEtapePaiement(
        etat({
          autorisee: true,
          capturee: true,
          statutReservation: "COMPLETED",
        }),
        new Date("2026-09-30T08:00:00Z"),
      ),
    ).toBe("ATTENDRE");
  });
});

describe("reversement", () => {
  it("tombe un vendredi", () => {
    const jour = prochainReversement(new Date("2026-09-08T12:00:00Z"));
    expect(jour.getUTCDay()).toBe(5);
  });

  it("laisse au moins huit jours", () => {
    const terminee = new Date("2026-09-08T12:00:00Z");
    const jour = prochainReversement(terminee);
    expect(
      (jour.getTime() - terminee.getTime()) / 86_400_000,
    ).toBeGreaterThanOrEqual(8);
  });

  it("reste un vendredi quel que soit le jour de clôture", () => {
    for (let decalage = 0; decalage < 14; decalage += 1) {
      const terminee = new Date(
        new Date("2026-09-01T12:00:00Z").getTime() + decalage * 86_400_000,
      );
      expect(prochainReversement(terminee).getUTCDay()).toBe(5);
    }
  });
});

describe("relances d'échec", () => {
  const premier = new Date("2026-09-12T08:00:00Z");

  it("relance à J+1, J+3 puis J+7", () => {
    expect(prochaineRelance(premier, 1)?.toISOString()).toBe(
      "2026-09-13T08:00:00.000Z",
    );
    expect(prochaineRelance(premier, 2)?.toISOString()).toBe(
      "2026-09-15T08:00:00.000Z",
    );
    expect(prochaineRelance(premier, 3)?.toISOString()).toBe(
      "2026-09-19T08:00:00.000Z",
    );
  });

  it("s'arrête après la troisième", () => {
    expect(prochaineRelance(premier, 4)).toBeNull();
  });

  it("suspend au troisième échec, jamais avant", () => {
    expect(ECHECS_AVANT_SUSPENSION).toBe(3);
  });
});
