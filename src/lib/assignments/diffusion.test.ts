import { describe, expect, it } from "vitest";

import {
  CONTRE_PROPOSITION_JOURS,
  type EtatDiffusion,
  PREMIER_LOT_HEURES,
  PREMIER_LOT_TAILLE,
  RECHERCHE_JOURS,
  composerLots,
  echeanceDuLot,
  finDeRecherche,
  prochaineEtape,
  validiteContreProposition,
} from "@/lib/assignments/diffusion";

const HEURE = 3_600_000;
const JOUR = 24 * HEURE;

/** Demande passée à midi UTC, pour que les calculs se lisent. */
const DEMANDE = new Date("2026-09-01T12:00:00.000Z");

function etat(overrides: Partial<EtatDiffusion> = {}): EtatDiffusion {
  return {
    demandeeA: DEMANDE,
    lotEnCours: 1,
    lotEmisA: DEMANDE,
    contrePropositionsVivantes: 0,
    ...overrides,
  };
}

describe("composition des lots", () => {
  const classes = ["a", "b", "c", "d", "e", "f", "g"];

  it("sollicite les mieux classés d'abord, sans rien reclasser", () => {
    const lots = composerLots(classes);
    expect(lots.premier).toEqual(["a", "b", "c", "d", "e"]);
    expect(lots.second).toEqual(["f", "g"]);
  });

  it("n'invente personne quand le vivier est plus petit que le lot", () => {
    const lots = composerLots(["a", "b"]);
    expect(lots.premier).toEqual(["a", "b"]);
    expect(lots.second).toEqual([]);
  });

  it("rend deux lots vides sur un vivier vide", () => {
    // Le cas se produit hors zone, ou sur un créneau que personne ne peut
    // tenir : l'appelant doit pouvoir le traiter sans exception.
    expect(composerLots([])).toEqual({ premier: [], second: [] });
  });

  it("laisse la taille du lot paramétrable, sans changer le défaut", () => {
    expect(PREMIER_LOT_TAILLE).toBe(5);
    expect(composerLots(classes, 2).premier).toEqual(["a", "b"]);
  });
});

describe("échéances", () => {
  it("laisse un jour au premier lot", () => {
    expect(echeanceDuLot(1, DEMANDE, DEMANDE).toISOString()).toBe(
      "2026-09-02T12:00:00.000Z",
    );
  });

  it("cesse de chercher au bout d'une semaine", () => {
    expect(finDeRecherche(DEMANDE).toISOString()).toBe(
      "2026-09-08T12:00:00.000Z",
    );
  });

  it("le second lot émis dans la continuité s'achève avec la recherche", () => {
    // 24 h + 6 jours = la semaine, exactement.
    const emis = new Date(DEMANDE.getTime() + PREMIER_LOT_HEURES * HEURE);
    expect(echeanceDuLot(2, emis, DEMANDE)).toEqual(finDeRecherche(DEMANDE));
  });

  it("borne le second lot à la fin de la recherche quand il est émis tard", () => {
    /*
     * Le client a délibéré trois jours sur des alternatives avant de demander
     * qu'on continue. Six jours pleins mèneraient au neuvième, alors qu'une
     * semaine a été promise.
     */
    const emisTard = new Date(DEMANDE.getTime() + 3 * JOUR);
    expect(echeanceDuLot(2, emisTard, DEMANDE)).toEqual(
      finDeRecherche(DEMANDE),
    );
  });
});

describe("validité d'une contre-proposition", () => {
  it("vaut deux semaines, le double de la recherche", () => {
    expect(CONTRE_PROPOSITION_JOURS).toBe(2 * RECHERCHE_JOURS);
    const creneauLointain = new Date(DEMANDE.getTime() + 30 * JOUR);
    expect(
      validiteContreProposition(DEMANDE, creneauLointain).toISOString(),
    ).toBe("2026-09-15T12:00:00.000Z");
  });

  it("ne survit jamais au créneau qu'elle propose", () => {
    // Quinze jours de validité sur un créneau situé dans trois jours laisserait
    // accepter, le dixième jour, une heure passée depuis une semaine.
    const creneauProche = new Date(DEMANDE.getTime() + 3 * JOUR);
    expect(validiteContreProposition(DEMANDE, creneauProche)).toEqual(
      creneauProche,
    );
  });
});

describe("prochaine étape d'une demande sans intervenant", () => {
  it("attend tant que le premier lot a du temps devant lui", () => {
    const etape = prochaineEtape(
      etat(),
      new Date(DEMANDE.getTime() + 23 * HEURE),
    );
    expect(etape).toEqual({
      type: "attendre",
      jusqua: new Date(DEMANDE.getTime() + 24 * HEURE),
    });
  });

  it("élargit au secteur dès l'échéance atteinte, à la milliseconde", () => {
    const echeance = new Date(DEMANDE.getTime() + 24 * HEURE);
    expect(prochaineEtape(etat(), new Date(echeance.getTime() - 1)).type).toBe(
      "attendre",
    );
    expect(prochaineEtape(etat(), echeance)).toEqual({
      type: "diffuser",
      lot: 2,
      echeance: finDeRecherche(DEMANDE),
    });
  });

  it("rend la main au client plutôt que d'élargir, s'il a des alternatives", () => {
    /*
     * Élargir sans lui demander mobiliserait tout un vivier pour chercher son
     * heure exacte, alors qu'il aurait peut-être pris l'alternative
     * sur-le-champ.
     */
    const etape = prochaineEtape(
      etat({ contrePropositionsVivantes: 2 }),
      new Date(DEMANDE.getTime() + 25 * HEURE),
    );
    expect(etape).toEqual({ type: "soumettre-alternatives" });
  });

  it("cesse de chercher quand le second lot s'achève", () => {
    const emis = new Date(DEMANDE.getTime() + 24 * HEURE);
    const etape = prochaineEtape(
      etat({ lotEnCours: 2, lotEmisA: emis }),
      new Date(DEMANDE.getTime() + 7 * JOUR),
    );
    expect(etape).toEqual({ type: "cesser-la-recherche" });
  });

  it("la fin de recherche l'emporte sur tout le reste", () => {
    /*
     * Un lot émis tardivement peut avoir du temps devant lui alors que la
     * semaine est écoulée. La promesse faite au client passe devant la
     * mécanique interne des lots — et devant des alternatives en attente de
     * réponse, qui ne meurent pas pour autant.
     */
    const huitiemeJour = new Date(DEMANDE.getTime() + 8 * JOUR);
    for (const surcharge of [
      { lotEnCours: 1 as const, lotEmisA: huitiemeJour },
      { lotEnCours: 2 as const, contrePropositionsVivantes: 3 },
    ]) {
      expect(prochaineEtape(etat(surcharge), huitiemeJour)).toEqual({
        type: "cesser-la-recherche",
      });
    }
  });
});
