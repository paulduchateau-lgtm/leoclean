import { FACTS } from "@/lib/facts";

/**
 * Avis clients.
 *
 * Le composant est en place et ne rend rien : Léo Clean n'a pas encore d'avis
 * publiables, et en fabriquer serait une pratique commerciale trompeuse au
 * sens de l'article L121-2 du code de la consommation. Le bloc d'engagement
 * qui le précède tient ce rôle en attendant — dire ce sur quoi on s'engage est
 * vérifiable, contrairement à un témoignage écrit par nous.
 *
 * Le jour où des avis réels existent : lever `FACTS.hasReviews`, alimenter ce
 * composant, et n'oublier ni le `aggregateRating` du JSON-LD — qui est gardé
 * par le même drapeau — ni le fait qu'une note agrégée déclarée sans avis
 * derrière est un motif de sanction manuelle.
 */
export function Avis() {
  if (!FACTS.hasReviews) return null;

  throw new Error(
    "FACTS.hasReviews est levé mais aucun avis n'est encore rendu : brancher la source avant d'activer le drapeau.",
  );
}
