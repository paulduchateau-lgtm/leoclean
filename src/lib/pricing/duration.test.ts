import { describe, expect, it } from "vitest";

import {
  MAX_DURATION_MINUTES,
  SLOT_GRANULARITY_MINUTES,
  estimateDuration,
  suggestedSurfaceFor,
  surfaceForDuration,
  wholeHourChoices,
} from "@/lib/pricing/duration";

describe("durée choisie, surface déduite", () => {
  const service = { sqmPerHour: 25, minDurationMinutes: 120 };

  it("retombe exactement sur la durée demandée", () => {
    // C'est la seule propriété qui compte : le tunnel affiche une durée, le
    // serveur reçoit une surface, et le moteur doit rendre la durée affichée.
    // Un écart facturerait autre chose que ce qui a été montré.
    for (
      let minutes = service.minDurationMinutes;
      minutes <= MAX_DURATION_MINUTES;
      minutes += SLOT_GRANULARITY_MINUTES
    ) {
      const surface = surfaceForDuration(minutes, service);
      const estimate = estimateDuration({ surfaceSqm: surface, service });
      expect(estimate.durationMinutes).toBe(minutes);
    }
  });

  it("suggère une surface lisible, jamais celle du calcul", () => {
    // 3 h 30 vaut 87,5 m² : on montre 88, on envoie 87. L'écart ne change ni
    // la durée ni le prix, qui ne dépendent que de la durée retenue.
    expect(suggestedSurfaceFor(180, service)).toBe(75);
    expect(suggestedSurfaceFor(210, service)).toBe(88);
    expect(surfaceForDuration(210, service)).toBe(87);
  });

  it("propose les heures pleines du plancher au plafond", () => {
    expect(wholeHourChoices(service)).toEqual([120, 180, 240, 300, 360]);
  });

  it("refuse une durée nulle ou négative", () => {
    expect(() => surfaceForDuration(0, service)).toThrow();
    expect(() => surfaceForDuration(-30, service)).toThrow();
  });
});
