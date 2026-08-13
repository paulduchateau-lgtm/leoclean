import { describe, expect, it, vi } from "vitest";

import { publicAction } from "./action-result";
import { z } from "zod";

/**
 * Enveloppe des Server Actions.
 *
 * C'est la frontière que traverse chaque mutation : elle doit valider,
 * autoriser, et ne jamais laisser fuir une trace technique vers le client.
 */

const schema = z.object({
  email: z.email("Adresse email invalide."),
  surface: z.number().int().positive(),
});

describe("validation", () => {
  it("renvoie les erreurs champ par champ, prêtes à afficher", async () => {
    const action = publicAction(schema, async () => "jamais atteint");

    const result = await action({ email: "pas-une-adresse", surface: -3 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION");
    expect(result.fieldErrors?.email?.[0]).toBe("Adresse email invalide.");
    expect(result.fieldErrors?.surface).toBeDefined();
  });

  it("n'exécute pas le gestionnaire si l'entrée est invalide", async () => {
    const handler = vi.fn();
    const action = publicAction(schema, handler);

    await action({ email: "x" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("transmet l'entrée validée et typée", async () => {
    const action = publicAction(schema, async (input) => input.surface * 2);

    const result = await action({
      email: "  Claire@Exemple.FR  ".trim(),
      surface: 60,
    });

    expect(result).toEqual({ ok: true, data: 120 });
  });
});

describe("erreurs inattendues", () => {
  it("ne laisse pas fuir le détail technique vers le client", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const action = publicAction(schema, async () => {
      throw new Error("relation « Booking » : colonne inconnue tarif_horaire");
    });

    const result = await action({ email: "claire@exemple.fr", surface: 60 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("UNEXPECTED");
    expect(result.error).not.toContain("Booking");
    // Le détail reste disponible côté serveur pour le diagnostic.
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
