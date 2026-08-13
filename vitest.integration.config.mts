import { defineConfig } from "vitest/config";

/**
 * Tests d'intégration : ils s'exécutent contre une vraie base PostgreSQL avec
 * PostGIS, parce que ce qu'ils vérifient — cloisonnement multi-tenant,
 * contrainte d'exclusion anti-double-réservation, colonne géographique générée
 * — vit dans la base et ne peut pas être simulé.
 *
 * Ils sont séparés des tests unitaires pour que `npm run check` reste
 * exécutable sans infrastructure.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` n'a pas d'implémentation exécutable : c'est une garde de
      // compilation. Sous Vitest, on la neutralise pour pouvoir tester
      // directement les modules serveur.
      "server-only": new URL("./test/server-only.stub.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["./test/integration.setup.ts"],
    globalSetup: ["./test/integration.global-setup.ts"],
    // Les tests partagent une base : les faire tourner en série évite qu'un
    // nettoyage de table n'emporte les données d'un autre fichier.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
