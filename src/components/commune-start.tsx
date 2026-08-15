import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { COMMUNES_BY_POPULATION } from "@/lib/territory";

/**
 * Première étape du tunnel, posée là où la personne arrive.
 *
 * On ne présente pas le service, on commence à réserver. La question est celle
 * que se pose réellement quelqu'un devant une plateforme locale — « est-ce
 * que vous venez chez moi ? » — et y répondre ouvre le tunnel avec la commune
 * déjà connue, au lieu de le faire retaper à l'écran suivant.
 *
 * Le composant ne porte aucun code client : ce sont seize liens. Il fonctionne
 * donc partout, y compris sur la vitrine statique, et n'ajoute rien au poids
 * d'une page dont le référencement est le canal d'acquisition.
 */
export function CommuneStart({ className = "" }: { className?: string }) {
  return (
    <section
      className={`rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8 ${className}`}
      aria-labelledby="commune-start"
    >
      <h2
        id="commune-start"
        className="font-heading text-xl font-semibold text-primary-foreground"
      >
        Où habitez-vous ?
      </h2>
      <p className="mt-1 text-sm text-primary-foreground/80">
        Choisissez votre commune : nous vous montrons les créneaux disponibles.
      </p>

      <ul className="mt-5 flex flex-wrap gap-2">
        {COMMUNES_BY_POPULATION.map((commune) => (
          <li key={commune.slug}>
            <Link
              href={`/reserver?commune=${commune.slug}`}
              className="inline-flex min-h-11 items-center rounded-full bg-primary-foreground/10 px-4 text-sm font-medium ring-1 ring-primary-foreground/25 transition-colors hover:bg-primary-foreground hover:text-primary"
            >
              {commune.name}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-5 flex items-center gap-2 text-sm text-primary-foreground/80">
        <ArrowRightIcon className="size-4 shrink-0" aria-hidden />
        Prix affiché avant de réserver, et rien à payer aujourd&apos;hui.
      </p>
    </section>
  );
}
