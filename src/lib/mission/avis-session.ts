import "server-only";

import { espaceClient } from "@/lib/auth/espaces";
import { DELAI_NOTATION_JOURS } from "@/lib/mission/notation";
import {
  type InterventionANoter,
  interventionsANoter,
} from "@/lib/mission/avis";

/**
 * Les interventions que ce client doit encore noter, depuis sa session.
 *
 * Même dessin que `client-bookings-session.ts` : l'organisation et le profil
 * sont résolus côté serveur, jamais reçus du navigateur, et l'appelant n'a
 * donc pas l'occasion de désigner le profil qu'il lit.
 *
 * Rend une liste vide plutôt que de lever quand l'espace n'est pas ouvert : la
 * notation est un rappel posé sur une page qui a autre chose à montrer, et une
 * exception y ferait tomber tout l'écran pour un encart.
 */
export async function chargerLesInterventionsANoter(): Promise<
  InterventionANoter[]
> {
  const espace = await espaceClient();
  if (!espace.ouvert) return [];

  return interventionsANoter(
    espace.db,
    espace.profil.id,
    new Date(),
    DELAI_NOTATION_JOURS,
  );
}
