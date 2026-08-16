import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  },
  projects: [
    /*
     * Le parcours complet réserve réellement, et consomme donc un créneau à
     * chaque exécution. Sans nettoyage préalable, la suite cesse d'être
     * répétable au bout d'une dizaine de passages. Voir
     * `e2e/nettoyage.setup.ts`.
     */
    { name: "nettoyage", testMatch: /nettoyage\.setup\.ts/ },
    // Mobile d'abord : c'est là que se prennent les réservations.
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      dependencies: ["nettoyage"],
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["nettoyage"],
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npm run start -- --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
