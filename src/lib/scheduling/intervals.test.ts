import { describe, expect, it } from "vitest";

import {
  type Interval,
  atLeast,
  clampTo,
  durationMinutes,
  expand,
  intersect,
  normalize,
  overlaps,
  subtract,
  totalMinutes,
  union,
} from "@/lib/scheduling/intervals";

/** Écriture lisible : `at(9)` vaut 9 h le 1er janvier 2026, en minutes UTC. */
const BASE = Date.UTC(2026, 0, 1);
const at = (hours: number, minutes = 0) =>
  BASE + hours * 3_600_000 + minutes * 60_000;
const range = (fromHour: number, toHour: number): Interval => ({
  start: at(fromHour),
  end: at(toHour),
});

describe("algèbre d'intervalles", () => {
  it("écarte les plages vides ou inversées", () => {
    expect(
      normalize([
        { start: at(10), end: at(10) },
        { start: at(12), end: at(11) },
        range(9, 10),
      ]),
    ).toEqual([range(9, 10)]);
  });

  it("fusionne les plages jointives", () => {
    // Sans cette fusion, une mission de 11 h à 13 h serait refusée alors
    // qu'elle tient entièrement dans les heures déclarées.
    expect(normalize([range(9, 12), range(12, 17)])).toEqual([range(9, 17)]);
  });

  it("fusionne les plages qui se chevauchent, dans le désordre", () => {
    expect(normalize([range(14, 18), range(9, 15)])).toEqual([range(9, 18)]);
  });

  it("ne fait pas se chevaucher deux plages qui se touchent", () => {
    // Convention `[start, end)` : une mission finissant à 12 h laisse 12 h
    // libre. Sans elle, chaque frontière produirait un conflit d'une
    // milliseconde.
    expect(overlaps(range(9, 12), range(12, 15))).toBe(false);
    expect(overlaps(range(9, 13), range(12, 15))).toBe(true);
  });

  it("coupe une plage en deux quand on retire son milieu", () => {
    expect(subtract([range(9, 18)], [range(12, 14)])).toEqual([
      range(9, 12),
      range(14, 18),
    ]);
  });

  it("supprime une plage entièrement recouverte", () => {
    expect(subtract([range(10, 12)], [range(9, 18)])).toEqual([]);
  });

  it("retire plusieurs trous d'affilée", () => {
    expect(
      subtract([range(8, 20)], [range(10, 11), range(13, 14), range(18, 19)]),
    ).toEqual([range(8, 10), range(11, 13), range(14, 18), range(19, 20)]);
  });

  it("intersecte deux listes de plages", () => {
    expect(
      intersect([range(9, 12), range(14, 18)], [range(11, 15), range(17, 20)]),
    ).toEqual([range(11, 12), range(14, 15), range(17, 18)]);
  });

  it("restreint à une fenêtre", () => {
    expect(clampTo([range(6, 22)], range(9, 18))).toEqual([range(9, 18)]);
  });

  it("élargit une plage des tampons de trajet", () => {
    expect(expand(range(10, 12), 15, 20)).toEqual({
      start: at(9, 45),
      end: at(12, 20),
    });
  });

  it("écarte les fragments trop courts pour une mission", () => {
    const fragments = [range(9, 10), range(11, 14)];
    expect(atLeast(fragments, 120)).toEqual([range(11, 14)]);
  });

  it("compte les minutes", () => {
    expect(durationMinutes(range(9, 12))).toBe(180);
    expect(totalMinutes([range(9, 12), range(14, 15)])).toBe(240);
    expect(union([range(9, 12)], [range(11, 15)])).toEqual([range(9, 15)]);
  });

  it("ne modifie pas les plages qu'on lui passe", () => {
    // `normalize` fusionne en mutant son accumulateur : il doit copier, sinon
    // un appel corromprait silencieusement les données de l'appelant.
    const source = [range(9, 12), range(11, 15)];
    const before = JSON.stringify(source);
    normalize(source);
    expect(JSON.stringify(source)).toBe(before);
  });
});
