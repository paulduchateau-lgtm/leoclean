import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  QUOTAS,
  consommer,
  empreinteSource,
  purger,
} from "@/lib/securite/limitation";

/**
 * Limitation de débit.
 *
 * Un compteur ne se teste pas en le lisant : il se teste en le martelant. Le
 * cas qui compte est celui de la concurrence, puisque l'abus qu'on cherche à
 * arrêter est concurrent par nature.
 */

const MAINTENANT = new Date("2026-08-16T10:15:00Z");

describe("compteur", () => {
  it("laisse passer jusqu'au quota, puis refuse", async () => {
    const quota = QUOTAS.reservation.max;

    for (let appel = 1; appel <= quota; appel += 1) {
      const verdict = await consommer("reservation", "203.0.113.7", MAINTENANT);
      expect(verdict.autorise).toBe(true);
      expect(verdict.restants).toBe(quota - appel);
    }

    const refus = await consommer("reservation", "203.0.113.7", MAINTENANT);
    expect(refus.autorise).toBe(false);
    expect(refus.restants).toBe(0);
  });

  it("compte chaque source séparément", async () => {
    for (let appel = 0; appel < QUOTAS.reservation.max; appel += 1) {
      await consommer("reservation", "203.0.113.7", MAINTENANT);
    }
    expect(
      (await consommer("reservation", "203.0.113.7", MAINTENANT)).autorise,
    ).toBe(false);
    // Une source épuisée ne doit pas fermer la porte à tout le monde : c'est
    // la différence entre une limitation et une panne.
    expect(
      (await consommer("reservation", "198.51.100.4", MAINTENANT)).autorise,
    ).toBe(true);
  });

  it("compte chaque action séparément", async () => {
    for (let appel = 0; appel < QUOTAS.reservation.max; appel += 1) {
      await consommer("reservation", "203.0.113.7", MAINTENANT);
    }
    expect(
      (await consommer("reservation", "203.0.113.7", MAINTENANT)).autorise,
    ).toBe(false);
    expect(
      (await consommer("rappel", "203.0.113.7", MAINTENANT)).autorise,
    ).toBe(true);
  });

  it("repart à zéro à la fenêtre suivante", async () => {
    for (let appel = 0; appel < QUOTAS.reservation.max + 3; appel += 1) {
      await consommer("reservation", "203.0.113.7", MAINTENANT);
    }
    expect(
      (await consommer("reservation", "203.0.113.7", MAINTENANT)).autorise,
    ).toBe(false);

    const heureSuivante = new Date(
      MAINTENANT.getTime() + QUOTAS.reservation.fenetreMs,
    );
    const verdict = await consommer(
      "reservation",
      "203.0.113.7",
      heureSuivante,
    );
    expect(verdict.autorise).toBe(true);
    expect(verdict.restants).toBe(QUOTAS.reservation.max - 1);
  });

  it("ne perd aucun appel lancé simultanément", async () => {
    /*
     * Le cœur du sujet. Lire puis incrémenter en deux temps laisserait deux
     * requêtes concurrentes écrire la même valeur, et le compteur avancerait
     * d'un au lieu de deux — précisément quand la limitation doit tenir.
     */
    const appels = await Promise.all(
      Array.from({ length: 12 }, () =>
        consommer("creneaux", "203.0.113.9", MAINTENANT),
      ),
    );

    expect(appels.every((verdict) => verdict.autorise)).toBe(true);
    const restants = appels
      .map((verdict) => verdict.restants)
      .sort((a, b) => a - b);
    // Douze appels, douze valeurs distinctes : aucun incrément perdu.
    expect(new Set(restants).size).toBe(12);
  });
});

describe("condensat de la source", () => {
  it("ne laisse pas l'adresse en clair", async () => {
    const empreinte = empreinteSource("203.0.113.7");
    expect(empreinte).not.toContain("203.0.113.7");
    expect(empreinte).toHaveLength(32);

    await consommer("rappel", "203.0.113.7", MAINTENANT);
    const lignes = await prisma.rateLimit.findMany({ select: { key: true } });
    expect(lignes).toHaveLength(1);
    // Une donnée personnelle n'a pas à être stockée pour compter.
    expect(lignes[0]!.key).not.toContain("203.0.113.7");
  });

  it("range la même source au même endroit", async () => {
    expect(empreinteSource("203.0.113.7")).toBe(empreinteSource("203.0.113.7"));
    expect(empreinteSource("203.0.113.7")).not.toBe(
      empreinteSource("203.0.113.8"),
    );
  });
});

describe("purge", () => {
  it("retire les fenêtres périmées et garde les vivantes", async () => {
    await consommer("reservation", "203.0.113.7", MAINTENANT);
    expect(await prisma.rateLimit.count()).toBe(1);

    // Une fenêtre de l'heure courante n'a pas à disparaître.
    expect(await purger(MAINTENANT)).toBe(0);

    const bienPlusTard = new Date(MAINTENANT.getTime() + 10 * 3_600_000);
    expect(await purger(bienPlusTard)).toBe(1);
    expect(await prisma.rateLimit.count()).toBe(0);
  });
});
