import { z } from "zod";

import { ForbiddenError, UnauthenticatedError } from "@/lib/auth/permissions";

/**
 * Forme du résultat d'une Server Action, et traduction des erreurs.
 *
 * Ce module ne dépend ni d'Auth.js ni de la base : il ne fait que décrire ce
 * qu'une action renvoie et convertir une exception en quelque chose qu'un
 * formulaire sait afficher. Les constructeurs d'actions authentifiées vivent
 * dans `actions.ts`, qui s'appuie sur celui-ci.
 *
 * Les actions renvoient un résultat discriminé au lieu de lever : une erreur
 * de saisie n'est pas un incident, c'est un cas nominal de formulaire.
 */

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      /** Message affichable tel quel. */
      error: string;
      /** Erreurs par champ, pour les afficher à côté des saisies. */
      fieldErrors?: Record<string, string[]>;
      code: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "UNEXPECTED";
    };

/** Traduit une exception en résultat affichable. */
export function toResult(error: unknown): ActionResult<never> {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Certaines informations sont incorrectes.",
      fieldErrors: z.flattenError(error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  if (error instanceof UnauthenticatedError) {
    return { ok: false, code: "UNAUTHENTICATED", error: error.message };
  }

  if (error instanceof ForbiddenError) {
    return { ok: false, code: "FORBIDDEN", error: error.message };
  }

  // Une erreur inattendue est journalisée intégralement côté serveur, et
  // résumée côté client : le détail technique ne regarde pas l'utilisateur, et
  // peut révéler la structure interne.
  console.error("Échec d'une server action :", error);
  return {
    ok: false,
    code: "UNEXPECTED",
    error: "Une erreur est survenue. Réessayez dans un instant.",
  };
}

/** Action ouverte : validation de l'entrée, sans exigence de session. */
export function publicAction<TInput, TOutput>(
  schema: z.ZodType<TInput>,
  handler: (input: TInput) => Promise<TOutput>,
): (raw: unknown) => Promise<ActionResult<TOutput>> {
  return async (raw: unknown) => {
    try {
      return { ok: true, data: await handler(schema.parse(raw)) };
    } catch (error) {
      return toResult(error);
    }
  };
}
