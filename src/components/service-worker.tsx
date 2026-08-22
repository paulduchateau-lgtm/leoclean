"use client";

import { useEffect } from "react";

/**
 * Enregistrement du service worker.
 *
 * Il n'a qu'un rôle — rendre l'application installable — et il ne met en cache
 * que ce qui est versionné par son nom. Voir `public/sw.js` : ni les créneaux
 * ni les prix n'y passent, un cache qui servirait une heure périmée ferait
 * réserver un rendez-vous qui n'existe plus.
 *
 * L'enregistrement attend le chargement complet plutôt que l'hydratation : il
 * n'apporte rien au premier affichage, et le faire pendant coûterait du temps
 * de fil principal au moment précis où l'on mesure le LCP.
 *
 * Il ne s'enregistre pas sur la vitrine statique : celle-ci est un double du
 * site, servi sous un chemin de dépôt, et un service worker y garderait en
 * mémoire des pages de démonstration.
 *
 * **Il ne s'enregistre pas non plus en développement**, et c'est la correction
 * d'un piège qui a coûté trois demi-journées. Son cache est sûr en production
 * parce qu'une URL de `/_next/static/` y désigne un contenu et un seul ; en
 * développement, ces URL sont **invariantes**, si bien que le service worker
 * continue de servir le module d'avant la modification. Le symptôme n'accuse
 * jamais le cache : une classe présente dans la source et sans effet à
 * l'écran, une erreur d'hydratation sur un composant qu'on vient de corriger,
 * un garde qui ne garde plus. Ni le rechargement, ni le redémarrage du
 * serveur, ni la purge de `.next` n'y touchent — le cache vit dans le
 * navigateur. `unregister()` retire aussi celui d'une session précédente,
 * faute de quoi le piège survivrait à sa propre correction.
 */
export function ServiceWorker({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (!enabled || process.env.NODE_ENV === "development") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((enregistrements) =>
          Promise.all(enregistrements.map((sw) => sw.unregister())),
        )
        /*
         * Le cache survit à l'enregistrement, et l'origine est la même qu'une
         * construction de production servie en local : un `leoclean-coque-v1`
         * rempli de modules de développement serait réadopté tel quel.
         */
        .then(() => caches.keys())
        .then((noms) => Promise.all(noms.map((nom) => caches.delete(nom))))
        .catch(() => {
          // Un navigateur qui refuse la lecture des enregistrements n'en a pas.
        });
      return;
    }

    function enregistrer() {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        // Un enregistrement refusé — mode privé, réglage d'entreprise — ne
        // retire rien au site : il retire seulement l'installation.
        console.warn("Service worker non enregistré", error);
      });
    }

    if (document.readyState === "complete") {
      enregistrer();
      return;
    }
    window.addEventListener("load", enregistrer);
    return () => window.removeEventListener("load", enregistrer);
  }, [enabled]);

  return null;
}
