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
 */
export function ServiceWorker({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    if (!("serviceWorker" in navigator)) return;

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
