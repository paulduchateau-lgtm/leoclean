import { chromium, devices } from "@playwright/test";

/**
 * Mesure des Core Web Vitals sur une construction de production.
 *
 * Usage : `npx next build && npx next start -p 3214`, puis `node
 * scripts/mesurer-vitals.mjs`.
 *
 * **Le débit réseau n'est pas simulé, et ne peut pas l'être ici.** Chrome
 * n'applique pas `Network.emulateNetworkConditions` au trafic de bouclage : ce
 * qui est mesuré est donc le temps de rendu, processeur bridé quatre fois,
 * réseau instantané. La part réseau se mesure sur le domaine déployé, une fois
 * `leoclean.fr` en production — le poids transféré par page, lui, est
 * relevé séparément et donne l'ordre de grandeur.
 *
 * Le décalage cumulé (CLS) est en revanche pleinement significatif : il ne
 * dépend pas du réseau.
 */

const BASE = "http://127.0.0.1:3214";
const navigateur = await chromium.launch();

/** Moto G Power en 4G simulée, la cible du brief. */
const contexte = await navigateur.newContext({ ...devices["Pixel 7"] });
const page = await contexte.newPage();
const client = await contexte.newCDPSession(page);
await client.send("Network.enable");
await client.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
});
await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });

/*
 * Le bandeau de reprise est le seul élément rendu après hydratation qui pousse
 * du contenu vers le bas : on mesure donc l'accueil deux fois, avec et sans
 * parcours enregistré. C'est là, et nulle part ailleurs, que le décalage
 * cumulé peut se dégrader.
 */
await page.addInitScript(() => {
  if (location.search.includes("avec-reprise")) {
    window.localStorage.setItem(
      "leoclean:booking:v1",
      JSON.stringify({
        savedAt: Date.now(),
        step: "rythme",
        communeSlug: "leognan",
        chosenSlot: null,
      }),
    );
  }
});

for (const chemin of [
  "/",
  "/?avec-reprise",
  "/menage-a-domicile/gradignan",
  "/tarifs",
  "/reserver",
]) {
  await page.goto(`${BASE}${chemin}`, { waitUntil: "load" });
  await page.waitForTimeout(3000);

  /*
   * Les entrées LCP et layout-shift ne sont pas rendues par
   * `getEntriesByType` : il faut un observateur, avec `buffered` pour
   * récupérer celles émises avant son installation.
   */
  const mesures = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let lcp = 0;
        let cls = 0;
        new PerformanceObserver((liste) => {
          for (const entree of liste.getEntries()) lcp = entree.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((liste) => {
          for (const entree of liste.getEntries()) {
            if (!entree.hadRecentInput) cls += entree.value;
          }
        }).observe({ type: "layout-shift", buffered: true });

        setTimeout(() => {
          const fcp = performance.getEntriesByName("first-contentful-paint")[0];
          const nav = performance.getEntriesByType("navigation")[0];
          resolve({
            ttfb: Math.round(nav.responseStart),
            fcp: Math.round(fcp?.startTime ?? 0),
            lcp: Math.round(lcp),
            cls: Number(cls.toFixed(4)),
          });
        }, 500);
      }),
  );

  console.log(
    `${chemin.padEnd(30)} TTFB ${String(mesures.ttfb).padStart(4)} ms · FCP ${String(mesures.fcp).padStart(4)} ms · LCP ${String(mesures.lcp).padStart(4)} ms · CLS ${mesures.cls}`,
  );
}

await navigateur.close();
