import { describe, expect, it } from "vitest";

import {
  estDimanche,
  estFerie,
  estSamedi,
  feriesDeLAnnee,
  paques,
} from "./feries";

/**
 * Les tests s'exécutent en UTC. Les instants sont donc écrits en UTC, et
 * plusieurs cas portent précisément sur l'écart avec l'heure française — c'est
 * là que se logent les erreurs de majoration.
 */

describe("paques", () => {
  /*
   * Dates vérifiables dans n'importe quel calendrier. Trois fériés en
   * dépendent, et aucun ne tombe à date fixe : c'est ce qu'une table en dur ne
   * peut pas deviner passé sa dernière ligne.
   */
  it("retrouve les dimanches de Pâques connus", () => {
    expect(paques(2024)).toEqual({ mois: 3, jour: 31 });
    expect(paques(2025)).toEqual({ mois: 4, jour: 20 });
    expect(paques(2026)).toEqual({ mois: 4, jour: 5 });
    expect(paques(2027)).toEqual({ mois: 3, jour: 28 });
    expect(paques(2030)).toEqual({ mois: 4, jour: 21 });
  });

  it("reste dans les bornes de mars et avril, sur deux siècles", () => {
    for (let annee = 1900; annee <= 2100; annee += 1) {
      const { mois, jour } = paques(annee);
      expect([3, 4]).toContain(mois);
      if (mois === 3) expect(jour).toBeGreaterThanOrEqual(22);
      if (mois === 4) expect(jour).toBeLessThanOrEqual(25);
    }
  });
});

describe("feriesDeLAnnee", () => {
  it("en donne onze, sans doublon de date", () => {
    for (const annee of [2025, 2026, 2027]) {
      const feries = feriesDeLAnnee(annee);
      expect(feries).toHaveLength(11);
      const cles = feries.map((f) => `${f.mois}-${f.jour}`);
      expect(new Set(cles).size).toBe(11);
    }
  });

  it("place correctement les fériés mobiles de 2026", () => {
    const feries = feriesDeLAnnee(2026);
    const trouver = (nom: string) => feries.find((f) => f.nom === nom);

    // Pâques 2026 tombe le 5 avril.
    expect(trouver("Lundi de Pâques")).toMatchObject({ mois: 4, jour: 6 });
    expect(trouver("Ascension")).toMatchObject({ mois: 5, jour: 14 });
    expect(trouver("Lundi de Pentecôte")).toMatchObject({ mois: 5, jour: 25 });
  });

  /*
   * Onze et pas davantage : le territoire est la Gironde. Ajouter le Vendredi
   * saint ou l'abolition de l'esclavage ferait majorer des interventions qui ne
   * le doivent pas.
   */
  it("ignore les fériés propres à l'Alsace-Moselle et aux outre-mer", () => {
    const noms = feriesDeLAnnee(2026).map((f) => f.nom);
    expect(noms).not.toContain("Vendredi saint");
    expect(noms).not.toContain("Saint-Étienne");
  });
});

describe("estFerie", () => {
  it("reconnaît le 14 juillet en heure française", () => {
    expect(estFerie(new Date("2026-07-14T06:00:00Z"))?.nom).toBe(
      "Fête nationale",
    );
  });

  /*
   * Le cas qui compte. Une intervention le 1ᵉʳ mai à 8 h du matin est
   * enregistrée le 30 avril à 22 h UTC : raisonner sur l'instant brut la
   * ferait manquer, et le client paierait le tarif d'un jeudi ordinaire.
   */
  it("reconnaît un férié dont l'instant UTC tombe la veille", () => {
    const premierMaiHuitHeures = new Date("2026-04-30T22:00:00Z");
    expect(estFerie(premierMaiHuitHeures)?.nom).toBe("Fête du Travail");
  });

  /*
   * Le symétrique, tout aussi coûteux dans l'autre sens : le 30 avril à 23 h
   * française est déjà le 30 avril à 21 h UTC, et ce n'est pas férié.
   */
  it("ne déborde pas sur la veille en heure française", () => {
    expect(estFerie(new Date("2026-04-30T21:00:00Z"))).toBeNull();
  });

  it("rend null un jour ordinaire", () => {
    expect(estFerie(new Date("2026-08-19T10:00:00Z"))).toBeNull();
  });

  it("suit les fériés mobiles d'une année à l'autre", () => {
    // Ascension 2026 : 14 mai. Ascension 2027 : 6 mai.
    expect(estFerie(new Date("2026-05-14T08:00:00Z"))?.nom).toBe("Ascension");
    expect(estFerie(new Date("2027-05-14T08:00:00Z"))).toBeNull();
    expect(estFerie(new Date("2027-05-06T08:00:00Z"))?.nom).toBe("Ascension");
  });
});

describe("samedi et dimanche", () => {
  it("reconnaît un samedi", () => {
    // 22 août 2026 est un samedi.
    expect(estSamedi(new Date("2026-08-22T08:00:00Z"))).toBe(true);
    expect(estDimanche(new Date("2026-08-22T08:00:00Z"))).toBe(false);
  });

  it("reconnaît un dimanche", () => {
    expect(estDimanche(new Date("2026-08-23T08:00:00Z"))).toBe(true);
    expect(estSamedi(new Date("2026-08-23T08:00:00Z"))).toBe(false);
  });

  /*
   * Même piège que pour les fériés : un dimanche à 1 h du matin, heure
   * française, est encore samedi 23 h en UTC.
   */
  it("compte le jour en heure française, pas en UTC", () => {
    const dimancheUneHeure = new Date("2026-08-22T23:00:00Z");
    expect(estDimanche(dimancheUneHeure)).toBe(true);
    expect(estSamedi(dimancheUneHeure)).toBe(false);
  });

  it("ne voit ni samedi ni dimanche en semaine", () => {
    for (const jour of ["17", "18", "19", "20", "21"]) {
      const instant = new Date(`2026-08-${jour}T08:00:00Z`);
      expect(estSamedi(instant)).toBe(false);
      expect(estDimanche(instant)).toBe(false);
    }
  });
});
