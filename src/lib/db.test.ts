import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { GLOBAL_MODELS, TENANT_MODELS } from "./db";

/**
 * Garde-fou du cloisonnement, exécuté sans base de données.
 *
 * Il ne vérifie pas le comportement — c'est le rôle de `tenancy.integration.
 * test.ts` — mais l'exhaustivité : aucun modèle ne peut échapper au périmètre
 * multi-tenant sans que quelqu'un ait écrit pourquoi.
 */
describe("périmètre multi-tenant", () => {
  const allModels = Prisma.dmmf.datamodel.models.map((model) => model.name);

  it("classe chaque modèle du schéma, sans exception implicite", () => {
    const unclassified = allModels.filter(
      (name) => !TENANT_MODELS.has(name) && !(name in GLOBAL_MODELS),
    );

    expect(
      unclassified,
      `Ces modèles n'ont pas d'organizationId et ne sont pas justifiés dans ` +
        `GLOBAL_MODELS. Soit ils sont métier et doivent être cloisonnés, soit ` +
        `l'exception doit être écrite et motivée : ${unclassified.join(", ")}`,
    ).toEqual([]);
  });

  it("ne déclare pas globale une table qui porte pourtant une organisation", () => {
    const contradictory = Object.keys(GLOBAL_MODELS).filter((name) =>
      TENANT_MODELS.has(name),
    );

    expect(contradictory).toEqual([]);
  });

  it("ne référence pas de modèle disparu du schéma", () => {
    const stale = Object.keys(GLOBAL_MODELS).filter(
      (name) => !allModels.includes(name),
    );

    expect(stale).toEqual([]);
  });

  it("cloisonne les tables qui portent des données personnelles", () => {
    // Adresses, notes d'accès, avis, messages, demandes de rappel : autant de
    // données qu'une organisation ne doit jamais voir chez une autre.
    for (const model of [
      "Address",
      "ClientProfile",
      "CleanerProfile",
      "Booking",
      "Review",
      "Message",
      "Lead",
      "ExternalBusyBlock",
      "CalendarConnection",
    ]) {
      expect(TENANT_MODELS.has(model), `${model} doit être cloisonné`).toBe(
        true,
      );
    }
  });

  it("laisse hors périmètre le cache de temps de trajet, qui est un fait géographique", () => {
    expect(TENANT_MODELS.has("TravelTimeCache")).toBe(false);
    expect(GLOBAL_MODELS.TravelTimeCache).toBeDefined();
  });
});
