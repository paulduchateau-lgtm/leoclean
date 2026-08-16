import { describe, expect, it } from "vitest";

import { decideCancellation, refusalMessage } from "@/lib/booking/cancel";

const START = new Date("2026-09-10T09:00:00Z");
const GROSS = 8700;

function at(hoursBefore: number): Date {
  return new Date(START.getTime() - hoursBefore * 3_600_000);
}

describe("annulation par le client", () => {
  it("autorise et chiffre une annulation bien à l'avance", () => {
    const decision = decideCancellation({
      status: "CONFIRMED",
      grossAmountCents: GROSS,
      scheduledStart: START,
      now: at(72),
    });

    expect(decision.allowed).toBe(true);
    expect(decision.refusal).toBeNull();
    expect(decision.outcome.feeCents).toBe(0);
  });

  it("autorise encore une annulation tardive, mais elle coûte", () => {
    // Le barème s'applique ; ce qui compte est que le client le voie avant de
    // confirmer, pas qu'on lui interdise de décider.
    const decision = decideCancellation({
      status: "CONFIRMED",
      grossAmountCents: GROSS,
      scheduledStart: START,
      now: at(3),
    });

    expect(decision.allowed).toBe(true);
    expect(decision.outcome.feeCents).toBeGreaterThan(0);
  });

  it("chiffre le coût même quand elle refuse", () => {
    // L'écran doit pouvoir afficher un montant dans tous les cas : découvrir
    // des frais après avoir cliqué est exactement ce qu'on reproche aux
    // services qu'on remplace.
    const decision = decideCancellation({
      status: "COMPLETED",
      grossAmountCents: GROSS,
      scheduledStart: START,
      now: at(48),
    });

    expect(decision.allowed).toBe(false);
    expect(decision.outcome).toBeDefined();
  });

  it("refuse une intervention commencée", () => {
    const decision = decideCancellation({
      status: "CONFIRMED",
      grossAmountCents: GROSS,
      scheduledStart: START,
      now: new Date(START.getTime() + 60_000),
    });

    expect(decision.allowed).toBe(false);
    expect(decision.refusal).toBe("INTERVENTION_COMMENCEE");
  });

  it("laisse annuler à l'heure pile", () => {
    // L'intervenant n'est pas encore entré : le doute profite au client, comme
    // dans le barème lui-même, dont les intervalles sont fermés à gauche.
    const decision = decideCancellation({
      status: "CONFIRMED",
      grossAmountCents: GROSS,
      scheduledStart: START,
      now: START,
    });

    expect(decision.allowed).toBe(true);
  });

  it("refuse ce qui n'est plus un rendez-vous", () => {
    for (const status of [
      "CANCELLED_BY_CLIENT",
      "CANCELLED_BY_CLEANER",
      "IN_PROGRESS",
      "COMPLETED",
      "NO_SHOW",
      "DISPUTED",
      "DRAFT",
    ] as const) {
      const decision = decideCancellation({
        status,
        grossAmountCents: GROSS,
        scheduledStart: START,
        now: at(48),
      });
      expect(decision.allowed).toBe(false);
      expect(decision.refusal).toBe("STATUT_NON_ANNULABLE");
    }
  });

  it("autorise les trois statuts d'un rendez-vous à venir", () => {
    for (const status of [
      "PENDING_ASSIGNMENT",
      "ASSIGNED",
      "CONFIRMED",
    ] as const) {
      expect(
        decideCancellation({
          status,
          grossAmountCents: GROSS,
          scheduledStart: START,
          now: at(48),
        }).allowed,
      ).toBe(true);
    }
  });

  it("donne un motif lisible plutôt qu'un code", () => {
    // Le message part vers l'écran tel quel : un identifiant technique
    // affiché à un client est une panne de plus, pas une explication.
    expect(refusalMessage("INTERVENTION_COMMENCEE")).toContain("Appelez-nous");
    expect(refusalMessage("STATUT_NON_ANNULABLE")).toContain("Appelez-nous");
  });
});
