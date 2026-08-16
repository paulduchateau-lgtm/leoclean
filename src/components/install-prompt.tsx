"use client";

import { DownloadIcon, XIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

/**
 * Proposition d'installation, après une réservation confirmée et jamais avant.
 *
 * Le moment n'est pas un détail, c'est toute la décision. Proposer d'installer
 * une application à quelqu'un qui vient d'arriver revient à demander un
 * engagement avant d'avoir rendu le moindre service : le taux de refus est
 * élevé, et un refus se paie — le navigateur ne repose plus la question de
 * sitôt. Après une réservation, la personne a un rendez-vous à retrouver, et
 * l'icône sur son écran d'accueil devient le chemin le plus court pour y
 * revenir.
 *
 * L'événement du navigateur arrive quand il veut, souvent au chargement. On le
 * retient donc dès qu'il se présente, et on ne l'ouvre qu'ici — c'est
 * précisément ce que `preventDefault` permet.
 *
 * Rien ne s'affiche sur iOS, qui n'émet pas cet événement : Safari n'installe
 * que par « Ajouter à l'écran d'accueil », dans son propre menu. Afficher un
 * bouton qui ne ferait rien serait pire que de n'en afficher aucun.
 */

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * L'événement est capté au niveau du module, pas du composant.
 *
 * Le navigateur l'émet au chargement de la page, bien avant que l'écran de
 * confirmation existe : un écouteur monté avec le composant arriverait trop
 * tard, et l'occasion serait perdue pour la visite entière.
 *
 * `useSyncExternalStore` est ensuite le bon outil pour le lire : le rendu
 * serveur ne connaît pas cet événement, le client oui, et c'est exactement
 * l'écart que ce hook franchit sans erreur d'hydratation. Il exige un
 * instantané stable — d'où la variable de module plutôt qu'un état.
 */
let differe: InstallEvent | null = null;

/** Réveille les abonnés quand l'événement arrive ou vient d'être consommé. */
const abonnes = new Set<() => void>();

function notifier() {
  for (const abonne of abonnes) abonne();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    differe = event as InstallEvent;
    notifier();
  });
}

function subscribe(onChange: () => void): () => void {
  abonnes.add(onChange);
  return () => abonnes.delete(onChange);
}

const snapshot = () => differe !== null;

export function InstallPrompt() {
  const disponible = useSyncExternalStore(subscribe, snapshot, () => false);
  const [ecarte, setEcarte] = useState(false);

  if (!disponible || ecarte) return null;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
      <div className="min-w-0">
        <p className="font-extrabold">Retrouver ce rendez-vous plus vite</p>
        <p className="mt-1 text-sm text-pretty text-muted-foreground">
          Ajoutez Léo Clean à votre écran d&apos;accueil : vos réservations en
          un geste, sans passer par le navigateur.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => {
            const evenement = differe;
            if (!evenement) return;
            // Un événement ne se rejoue pas : on l'oublie dès qu'il est ouvert,
            // que la personne accepte ou non.
            differe = null;
            notifier();
            void evenement.prompt();
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 font-bold text-primary-foreground shadow-xs"
        >
          <DownloadIcon className="size-4" aria-hidden />
          Ajouter
        </button>
        <button
          type="button"
          onClick={() => setEcarte(true)}
          aria-label="Ne pas installer l'application"
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <XIcon className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
