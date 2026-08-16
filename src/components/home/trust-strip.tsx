import { ShieldCheckIcon } from "lucide-react";

import { FISCAL } from "@/lib/fiscal";
import { SITE } from "@/lib/site";

/**
 * Bandeau de cadre : ce qui sécurise, avant que l'objection se formule.
 *
 * Faire entrer quelqu'un chez soi soulève trois questions qu'on ne pose pas à
 * voix haute — cette personne est-elle déclarée, suis-je couvert si quelque
 * chose casse, est-ce que je m'engage. Y répondre en quatre mentions coûte une
 * ligne et évite qu'elles restent en suspens pendant toute la lecture.
 *
 * La mention fiscale est lue dans `FISCAL`, jamais écrite : « Déclaration SAP
 * en cours » décrit un dossier déposé et non instruit, et le libellé devient
 * le numéro de déclaration le jour où elle est obtenue, sans qu'on repasse
 * ici. Écrire « agréé SAP » ou afficher un numéro avant obtention est une
 * affirmation fausse sur une situation administrative.
 *
 * Le brief autorisait un défilement en boucle sur mobile. Quatre mentions
 * courtes tiennent en deux lignes sans défilement : une animation qui n'ajoute
 * rien à la lisibilité coûterait du temps de rendu sur la page dont le LCP est
 * le plus surveillé du site, et une exception `prefers-reduced-motion` à tenir.
 */
const CLAIMS: readonly string[] = [
  ...(SITE.siret !== null ? ["SIRET vérifié"] : []),
  "Assurance RC Pro",
  FISCAL.sap.label,
  "Sans engagement",
];

export function TrustStrip() {
  return (
    <section
      className="border-b border-border-subtle bg-sage-50"
      aria-label="Garanties"
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
