"use client";

import { useEffect, useRef } from "react";

import type { BookingBackend } from "@/lib/booking/backend";

/**
 * Mesure du tunnel de réservation.
 *
 * Le seul émetteur du dépôt qui a besoin d'un aller-retour vers le serveur :
 * un changement d'écran se produit dans React et ne passe par aucune server
 * action. Tout le reste — demande de rappel, acceptation de mission, absence
 * posée — s'écrit là où l'événement se produit déjà, côté serveur.
 *
 * L'émission passe par `BookingBackend` et non par un import direct de la
 * server action : la vitrine statique écarte `reserver/actions.ts`, et un
 * composant qui importerait un fichier absent ferait échouer le typage, pas
 * l'export — donc silencieusement, à la construction suivante.
 *
 * **Aucun cookie, aucun suivi d'un site à l'autre.** L'identifiant de parcours
 * est aléatoire, vit dans le stockage de session — donc meurt avec l'onglet —
 * et ne sert qu'à relier les écrans d'un même parcours. Sans lui, un taux
 * d'abandon par étape n'est pas calculable ; avec lui, on ne sait toujours pas
 * qui est la personne.
 */

const CLE_PARCOURS = "leoclean.parcours";

/**
 * Écrans déjà comptés comme vus, pour ce parcours.
 *
 * Le garde vit au niveau du module et non dans une `ref` : en développement,
 * React monte deux fois chaque composant, ce qui recrée les `ref` et
 * dédoublerait chaque vue. Un écran compté deux fois gonfle le dénominateur de
 * tous les taux d'abandon — c'est l'erreur de mesure qui décrédibilise un
 * module entier, et elle est invisible tant qu'on ne compare pas à la réalité.
 *
 * Conséquence assumée : revenir sur un écran ne le recompte pas. Un retour
 * arrière est un signal distinct, qui mérite son propre événement le jour où on
 * le mesurera, pas d'être confondu avec une première visite.
 */
const VUES = new Set<string>();

/**
 * Identifiant de parcours : lu, ou engendré une fois pour l'onglet.
 *
 * `crypto.randomUUID` sans les tirets, ce qui donne exactement la forme que
 * `parcoursValide` exige côté serveur — trente-deux caractères alphanumériques
 * minuscules. Un identifiant que le serveur n'accepterait pas serait mesuré
 * sans jamais pouvoir être recollé.
 */
function identifiantDeParcours(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const existant = window.sessionStorage.getItem(CLE_PARCOURS);
    if (existant) return existant;

    const nouveau = crypto.randomUUID().replaceAll("-", "");
    window.sessionStorage.setItem(CLE_PARCOURS, nouveau);
    return nouveau;
  } catch {
    /*
     * Stockage refusé — navigation privée, réglage restrictif. On mesure alors
     * des événements orphelins plutôt que rien : le volume par étape reste
     * juste, seul le recollement d'un parcours se perd. Une mesure ne justifie
     * jamais d'insister auprès de quelqu'un qui a dit non.
     */
    return null;
  }
}

/**
 * Émet un événement sans jamais faire attendre la personne.
 *
 * Ni `await`, ni gestion d'erreur remontée : c'est la même règle que pour les
 * notifications du dépôt. Un tunnel qui ralentirait ou refuserait d'avancer
 * parce que la mesure a échoué serait un défaut bien plus grave que l'absence
 * de la mesure.
 */
function emettre(
  backend: BookingBackend,
  nom: "tunnel_etape_vue" | "tunnel_etape_completee",
  etape: string,
  dureeMs?: number,
): void {
  const parcours = identifiantDeParcours();
  try {
    const retour = backend.tracerEtape({
      nom,
      etape,
      duree_ms: dureeMs,
      parcours: parcours ?? undefined,
    });
    /* En production le retour est une promesse : un rejet non capté remonterait
       en erreur non gérée dans la console du client, pour une mesure. */
    void Promise.resolve(retour).catch(() => {});
  } catch {
    /* Volontairement muet : voir l'en-tête de la fonction. */
  }
}

/**
 * Suit les écrans traversés et le temps passé sur chacun.
 *
 * La durée est ce qui rend la mesure utile : un écran abandonné en trois
 * secondes et un écran abandonné après deux minutes ne décrivent pas la même
 * difficulté, et c'est le second qui coûte des clients.
 */
export function useTracageTunnel(
  backend: BookingBackend,
  etape: string,
): void {
  const precedente = useRef<{ etape: string; depuis: number } | null>(null);

  /*
   * `backend` figure dans les dépendances plutôt que dans une `ref` : lire une
   * `ref` pendant le rendu est interdit, et le relancement de l'effet ne coûte
   * rien — les deux gardes ci-dessous font que rien n'est émis deux fois.
   */
  useEffect(() => {
    const maintenant = Date.now();
    const avant = precedente.current;

    if (avant && avant.etape !== etape) {
      emettre(
        backend,
        "tunnel_etape_completee",
        avant.etape,
        maintenant - avant.depuis,
      );
    }

    if (!avant || avant.etape !== etape) {
      const cle = `${identifiantDeParcours() ?? "sans-parcours"}|${etape}`;
      if (!VUES.has(cle)) {
        VUES.add(cle);
        emettre(backend, "tunnel_etape_vue", etape);
      }
      precedente.current = { etape, depuis: maintenant };
    }
  }, [backend, etape]);
}
