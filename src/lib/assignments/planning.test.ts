import { describe, expect, it } from "vitest";

import {
  type EtapeJournee,
  analyserInsertion,
  etapesDuJour,
  voieSansNumero,
} from "@/lib/assignments/planning";
import { parisWallClockToUtc } from "@/lib/time";

/**
 * Lecture d'une journée d'intervenant.
 *
 * Les instants sont construits en heure locale française puis convertis, comme
 * partout ailleurs : un test écrit en UTC passerait toute l'année sauf les deux
 * semaines où il compte vraiment.
 */

/** Heures décimales acceptées : 11.5 vaut 11 h 30. */
const paris = (day: number, hour: number) =>
  parisWallClockToUtc({
    year: 2026,
    month: 8,
    day,
    hour: Math.floor(hour),
    minute: Math.round((hour - Math.floor(hour)) * 60),
  });

/**
 * Fabrique une étape. `trajet` est symétrique et déborde le créneau des deux
 * côtés, comme le fait la contrainte d'exclusion en base.
 */
function etape(
  id: string,
  jour: number,
  debutHeure: number,
  finHeure: number,
  { trajet = 15, commune = "Léognan" } = {},
): EtapeJournee {
  const debut = paris(jour, debutHeure);
  const fin = paris(jour, finHeure);
  return {
    assignmentId: id,
    debut,
    fin,
    blocDebut: new Date(debut.getTime() - trajet * 60_000),
    blocFin: new Date(fin.getTime() + trajet * 60_000),
    trajetAvantMinutes: trajet,
    trajetApresMinutes: trajet,
    communeName: commune,
  };
}

describe("étapes du jour", () => {
  it("ne retient que la journée civile française, et les trie", () => {
    const etapes = [
      etape("c", 18, 14, 16),
      etape("a", 18, 9, 11),
      etape("z", 19, 9, 11),
    ];

    expect(
      etapesDuJour(etapes, paris(18, 12)).map((e) => e.assignmentId),
    ).toEqual(["a", "c"]);
  });

  it("range une mission de fin de soirée dans le bon jour local", () => {
    // 23 h 30 heure de Paris en août, c'est 21 h 30 UTC : une comparaison faite
    // en UTC la classerait au bon jour ici, mais pas à 1 h du matin.
    const tardive = etape("tard", 18, 22, 23);
    expect(etapesDuJour([tardive], paris(18, 9))).toHaveLength(1);
    expect(etapesDuJour([tardive], paris(19, 9))).toHaveLength(0);
  });
});

describe("insertion d'une proposition", () => {
  it("signale une mission isolée", () => {
    const proposition = etape("prop", 18, 9, 12);
    const insertion = analyserInsertion(proposition, []);

    expect(insertion.estIsolee).toBe(true);
    expect(insertion.precedente).toBeNull();
    expect(insertion.suivante).toBeNull();
    expect(insertion.tempsMortMinutes).toBe(0);
  });

  it("situe la proposition entre deux missions acceptées", () => {
    const avant = etape("avant", 18, 9, 11, { commune: "Léognan" });
    const proposition = etape("prop", 18, 13, 15, { commune: "Cadaujac" });
    const apres = etape("apres", 18, 17, 18, { commune: "La Brède" });

    const insertion = analyserInsertion(proposition, [avant, apres]);

    expect(insertion.estIsolee).toBe(false);
    expect(insertion.precedente?.assignmentId).toBe("avant");
    expect(insertion.suivante?.assignmentId).toBe("apres");
    // 11 h + 15 min de route = 11 h 15 ; la proposition bloque dès 12 h 45.
    expect(insertion.battementAvantMinutes).toBe(90);
    // 15 h + 15 min = 15 h 15 ; la suivante bloque dès 16 h 45.
    expect(insertion.battementApresMinutes).toBe(90);
    expect(insertion.estSerree).toBe(false);
    expect(insertion.tempsMortMinutes).toBe(180);
  });

  it("signale une insertion serrée quand les tampons se touchent", () => {
    const avant = etape("avant", 18, 9, 11);
    // Le bloc précédent finit à 11 h 15 ; celle-ci commence à bloquer à 11 h 15.
    const proposition = etape("prop", 18, 11.5, 13.5);

    const insertion = analyserInsertion(proposition, [avant]);

    expect(insertion.battementAvantMinutes).toBe(0);
    expect(insertion.estSerree).toBe(true);
    expect(insertion.tempsMortMinutes).toBe(0);
  });

  it("ignore les missions des autres jours", () => {
    const veille = etape("veille", 17, 16, 18);
    const lendemain = etape("lendemain", 19, 8, 10);
    const proposition = etape("prop", 18, 9, 12);

    const insertion = analyserInsertion(proposition, [veille, lendemain]);

    // Sans cette borne, on calculerait un battement entre deux journées que
    // personne n'enchaîne — et un trajet entre deux adresses qui ne se suivent
    // pas.
    expect(insertion.estIsolee).toBe(true);
    expect(insertion.precedente).toBeNull();
    expect(insertion.suivante).toBeNull();
  });

  it("ne se compte pas elle-même si elle figure déjà dans la journée", () => {
    const proposition = etape("prop", 18, 9, 12);
    const insertion = analyserInsertion(proposition, [proposition]);

    expect(insertion.estIsolee).toBe(true);
    expect(insertion.chevauche).toBe(false);
  });

  it("signale un chevauchement plutôt que de le taire", () => {
    // La base l'interdit ; si la donnée arrive quand même incohérente, l'écran
    // doit le dire.
    const acceptee = etape("acceptee", 18, 9, 12);
    const proposition = etape("prop", 18, 10, 13);

    expect(analyserInsertion(proposition, [acceptee]).chevauche).toBe(true);
  });
});

describe("voie sans numéro", () => {
  it.each([
    ["12 rue des Vignes", "rue des Vignes"],
    ["2 ter rue Camille Desmoulins", "rue Camille Desmoulins"],
    ["8 bis avenue de la Brède", "avenue de la Brède"],
    ["1, place Joane", "place Joane"],
    ["24 Quater chemin de Rouillac", "chemin de Rouillac"],
  ])("retire le numéro de « %s »", (saisie, attendu) => {
    expect(voieSansNumero(saisie)).toBe(attendu);
  });

  it("laisse intacte une voie sans numéro", () => {
    expect(voieSansNumero("lieu-dit Le Barp")).toBe("lieu-dit Le Barp");
    expect(voieSansNumero("  place Joane  ")).toBe("place Joane");
  });

  it("ne rend jamais une chaîne vide", () => {
    // Mieux vaut afficher « 12 » que rien : une ligne vide à l'écran ne se
    // comprend pas, et laisse croire à une donnée manquante.
    expect(voieSansNumero("12")).toBe("12");
  });
});
