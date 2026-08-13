import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    // Environnement Node par défaut : la majeure partie du code testé est du
    // domaine pur (tarification, disponibilité, trajets). Un fichier de test de
    // composant déclare `// @vitest-environment jsdom` en tête.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // Les tests de bout en bout appartiennent à Playwright, et ceux qui
    // exigent une vraie base à `npm run test:integration` : cette suite doit
    // rester exécutable sans aucune infrastructure.
    exclude: ["e2e/**", "node_modules/**", "src/**/*.integration.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts"],
    },
  },
});
