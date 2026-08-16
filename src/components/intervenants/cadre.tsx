import { ShieldCheckIcon } from "lucide-react";

import { INTERVENANTS } from "@/lib/facts";

/**
 * Bandeau de cadre, côté offre.
 *
 * Les quatre objections d'un indépendant à qui l'on propose de passer par une
 * plateforme, dans l'ordre où elles viennent : est-ce que je reste à mon
 * compte, est-ce que je m'enferme, est-ce qu'on va me forcer la main, est-ce
 * qu'il y aura quelqu'un au bout du fil.
 *
 * Ce ne sont pas des arguments commerciaux : ce sont les quatre
 * caractéristiques qui distinguent une relation de prestation d'une relation
 * de travail. Les afficher engage à les tenir dans le produit — et les tenir
 * est ce qui protège la relation d'une requalification.
 *
 * Pas de défilement en boucle : quatre mentions courtes tiennent sur deux
 * lignes, et une animation coûterait du temps de rendu plus une exception
 * `prefers-reduced-motion` à maintenir, sans rien ajouter à la lisibilité.
 */
const CLAIMS: readonly string[] = [
  "Vous restez indépendant",
  ...(INTERVENANTS.requiresExclusivity ? [] : ["Aucune exclusivité"]),
  "Vous acceptez ou vous refusez",
  "Un interlocuteur joignable",
];

export function CadreIntervenants() {
  return (
    <section
      className="border-b border-border-subtle bg-sage-50"
      aria-label="Le cadre"
    >
      <ul className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-4">
        {CLAIMS.map((claim) => (
          <li
            key={claim}
            className="flex items-center gap-1.5 text-sm font-medium text-ink-700"
          >
            <ShieldCheckIcon
              className="size-4 shrink-0 text-brand"
              aria-hidden
            />
            {claim}
          </li>
        ))}
      </ul>
    </section>
  );
}
