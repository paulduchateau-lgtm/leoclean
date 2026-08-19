import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CHAMPS_INTERDITS,
  ETAPES_TUNNEL,
  type Evenement,
  NOMS_EVENEMENTS,
  decomposer,
  parcoursValide,
} from "./evenements";

describe("taxonomie", () => {
  it("nomme chaque événement objet puis verbe au passé", () => {
    for (const nom of NOMS_EVENEMENTS) {
      expect(nom, `« ${nom} » doit être en minuscules avec des tirets bas`).toMatch(
        /^[a-z]+(_[a-z]+)+$/,
      );
    }
  });

  it("ne comporte aucun doublon", () => {
    expect(new Set(NOMS_EVENEMENTS).size).toBe(NOMS_EVENEMENTS.length);
  });

  /*
   * `ETAPES_TUNNEL` est recopiée depuis `booking-funnel.tsx` plutôt
   * qu'importée : ce composant client pèse plusieurs milliers de lignes, et
   * l'importer depuis un module que le serveur charge tirerait tout le tunnel
   * dans le graphe. La duplication est donc assumée — et vérifiée ici, faute de
   * quoi elle serait subie.
   */
  it("suit les écrans réels du tunnel", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/booking-funnel.tsx"),
      "utf8",
    );

    const bloc = /const STEPS = \[([\s\S]*?)\] as const;/.exec(source);
    expect(bloc, "STEPS introuvable dans booking-funnel.tsx").not.toBeNull();

    const etapes = [...bloc![1]!.matchAll(/"([a-z]+)"/g)].map(
      (correspondance) => correspondance[1],
    );

    expect(etapes).toEqual([...ETAPES_TUNNEL]);
  });
});

describe("décomposer", () => {
  it("sépare le nom des propriétés", () => {
    const { nom, proprietes } = decomposer({
      nom: "tunnel_etape_completee",
      etape: "logement",
      duree_ms: 4200,
    });

    expect(nom).toBe("tunnel_etape_completee");
    expect(proprietes).toEqual({ etape: "logement", duree_ms: 4200 });
  });

  it("laisse des propriétés vides quand l'événement n'en porte pas", () => {
    const { proprietes } = decomposer({
      nom: "tunnel_etape_vue",
      etape: "commune",
    });
    expect(Object.keys(proprietes)).toEqual(["etape"]);
  });
});

describe("aucune donnée personnelle", () => {
  /*
   * Le contrôle porte sur la définition elle-même : le type est effacé à
   * l'exécution, mais le texte du module ne l'est pas. Un champ `email` ajouté
   * à un événement fait donc échouer ce test avant d'atteindre la base — où il
   * échapperait à la purge des comptes et deviendrait le dernier endroit où une
   * identité survit.
   */
  it("n'autorise aucun champ interdit dans la définition des événements", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/analytics/evenements.ts"),
      "utf8",
    );

    const union = /export type Evenement =([\s\S]*?)\n\nexport type NomEvenement/.exec(
      source,
    );
    expect(union, "union des événements introuvable").not.toBeNull();

    /*
     * Le discriminant s'appelle `nom` et porte toujours un littéral — il est
     * écarté du balayage, sans quoi il déclencherait l'alerte prévue pour un
     * nom de personne. C'est exactement pourquoi `nom` reste dans la liste
     * interdite : le mot est ambigu, et c'est l'ambiguïté qui est dangereuse.
     */
    const champs = [...union![1]!.matchAll(/^\s{6}([a-z_]+)[?]?:\s*([^\n]+)/gm)]
      .filter((correspondance) => !/^"/.test(correspondance[2]!.trim()))
      .map((correspondance) => correspondance[1]!);

    expect(champs.length, "aucun champ balayé : la regex ne mord plus").toBeGreaterThan(5);

    for (const champ of champs) {
      expect(
        CHAMPS_INTERDITS as readonly string[],
        `le champ « ${champ} » ne peut pas être mesuré`,
      ).not.toContain(champ);
    }
  });

  it("liste les champs qu'un événement ne portera jamais", () => {
    expect(CHAMPS_INTERDITS).toContain("email");
    expect(CHAMPS_INTERDITS).toContain("telephone");
    expect(CHAMPS_INTERDITS).toContain("adresse");
    expect(CHAMPS_INTERDITS).toContain("ip");
  });

  /*
   * La commune est mesurée, la position ne l'est pas. La distinction n'est pas
   * cosmétique : seize communes forment un ensemble trop grossier pour désigner
   * quelqu'un, un couple de coordonnées désigne un domicile.
   */
  it("mesure la commune mais jamais les coordonnées", () => {
    const evenement: Evenement = {
      nom: "creneaux_cherches",
      commune_insee: "33234",
      resultats: 0,
    };
    const { proprietes } = decomposer(evenement);
    expect(proprietes).toHaveProperty("commune_insee");
    expect(proprietes).not.toHaveProperty("lat");
    expect(proprietes).not.toHaveProperty("lng");
  });
});

describe("parcoursValide", () => {
  it("accepte un identifiant opaque de longueur raisonnable", () => {
    expect(parcoursValide("k3f9d0a1b2c3e4f5")).toBe(true);
  });

  it("refuse ce qui est trop court pour être aléatoire", () => {
    expect(parcoursValide("abc123")).toBe(false);
  });

  /*
   * Refuser une valeur volumineuse n'est pas une coquetterie : un identifiant
   * long est le moyen le plus simple de glisser une donnée dans un champ qui
   * n'est pas fait pour ça.
   */
  it("refuse une valeur trop longue", () => {
    expect(parcoursValide("a".repeat(64))).toBe(false);
  });

  it("refuse tout ce qui n'est pas alphanumérique minuscule", () => {
    expect(parcoursValide("marc.dupont@exemple.fr")).toBe(false);
    expect(parcoursValide("K3F9D0A1B2C3E4F5")).toBe(false);
  });
});
