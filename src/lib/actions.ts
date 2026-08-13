import "server-only";

import type { z } from "zod";

import { type ActionResult, toResult } from "@/lib/action-result";
import type { Permission } from "@/lib/auth/permissions";
import {
  type AuthenticatedUser,
  type OrganizationContext,
  requireOrganization,
  requireUser,
} from "@/lib/auth/session";

/**
 * Constructeurs de Server Actions.
 *
 * Trois choses doivent arriver à chaque mutation, et aucune ne doit dépendre
 * de la mémoire du développeur : valider l'entrée avec Zod, vérifier
 * l'autorisation, et convertir les erreurs en un résultat exploitable par le
 * formulaire plutôt qu'en trace d'exécution.
 */

export { publicAction } from "@/lib/action-result";
export type { ActionResult } from "@/lib/action-result";

/** Action exigeant une session valide. */
export function authedAction<TInput, TOutput>(
  schema: z.ZodType<TInput>,
  handler: (input: TInput, user: AuthenticatedUser) => Promise<TOutput>,
): (raw: unknown) => Promise<ActionResult<TOutput>> {
  return async (raw: unknown) => {
    try {
      const user = await requireUser();
      return { ok: true, data: await handler(schema.parse(raw), user) };
    } catch (error) {
      return toResult(error);
    }
  };
}

/**
 * Action opérant dans une organisation.
 *
 * L'identifiant d'organisation fait partie de l'entrée validée, et
 * l'appartenance est vérifiée avant que le gestionnaire ne s'exécute. Celui-ci
 * reçoit un client Prisma déjà cloisonné : il n'a pas les moyens d'interroger
 * une autre organisation.
 */
export function organizationAction<
  TInput extends { organizationId: string },
  TOutput,
>(
  schema: z.ZodType<TInput>,
  permission: Permission,
  handler: (input: TInput, context: OrganizationContext) => Promise<TOutput>,
): (raw: unknown) => Promise<ActionResult<TOutput>> {
  return async (raw: unknown) => {
    try {
      const input = schema.parse(raw);
      const context = await requireOrganization(
        input.organizationId,
        permission,
      );
      return { ok: true, data: await handler(input, context) };
    } catch (error) {
      return toResult(error);
    }
  };
}
