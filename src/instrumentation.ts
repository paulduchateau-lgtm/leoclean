/**
 * Point d'entrée exécuté une fois au démarrage du serveur Next.js.
 *
 * On y force la validation des variables d'environnement : une configuration
 * incomplète doit faire échouer le démarrage avec un message lisible, pas
 * produire une erreur obscure au premier appel d'API en production.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertServerEnv } = await import("@/lib/env");
    assertServerEnv();
  }
}
