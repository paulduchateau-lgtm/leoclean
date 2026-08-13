import { handlers } from "@/lib/auth/config";

/**
 * Points d'entrée Auth.js.
 *
 * L'un des rares Route Handlers du projet : les mutations passent par des
 * Server Actions, mais le protocole OAuth et la vérification des liens de
 * connexion imposent de vraies routes HTTP.
 */
export const { GET, POST } = handlers;
