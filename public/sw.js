/*
 * Service worker minimal.
 *
 * Il n'existe que pour une raison : sans lui, aucun navigateur ne propose
 * d'installer l'application. Il ne cherche pas à rendre le site utilisable
 * hors ligne, et c'est délibéré.
 *
 * **Rien de ce qui change n'est mis en cache.** Ni les créneaux, ni les prix,
 * ni une page de réservation : servir un créneau périmé depuis un cache
 * conduirait quelqu'un à réserver une heure qui n'existe plus, et le site
 * paraîtrait fautif là où il ne ferait que se souvenir. Seules les ressources
 * versionnées par leur nom — celles de `/_next/static/`, dont le nom change à
 * chaque contenu — peuvent être servies depuis le cache sans risque, parce
 * qu'une URL y désigne un contenu et un seul.
 *
 * La page hors ligne n'est pas un site : c'est un numéro de téléphone. Quand
 * le réseau manque, ce qu'il faut à quelqu'un qui voulait réserver, c'est
 * pouvoir appeler.
 */

const CACHE = "leoclean-coque-v1";
const HORS_LIGNE = "/hors-ligne";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([HORS_LIGNE]))
      // Le nouveau service worker prend la main sans attendre la fermeture de
      // tous les onglets : une version qui traîne est une version qui ment.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((noms) =>
        Promise.all(
          noms.filter((nom) => nom !== CACHE).map((nom) => caches.delete(nom)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const requete = event.request;
  if (requete.method !== "GET") return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  /*
   * Ressources versionnées par leur nom : le cache d'abord, sans réseau. Une
   * URL de `/_next/static/` désigne un contenu et un seul, pour toujours.
   */
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(requete).then(
        (cachee) =>
          cachee ??
          fetch(requete).then((reponse) => {
            const copie = reponse.clone();
            void caches.open(CACHE).then((cache) => cache.put(requete, copie));
            return reponse;
          }),
      ),
    );
    return;
  }

  /*
   * Tout le reste va au réseau, toujours. En cas d'échec sur une navigation,
   * on montre la page hors ligne — jamais une ancienne version de la page
   * demandée, qui donnerait des prix et des créneaux périmés pour du présent.
   */
  if (requete.mode === "navigate") {
    event.respondWith(
      fetch(requete).catch(() => caches.match(HORS_LIGNE).then((r) => r ?? Response.error())),
    );
  }
});
