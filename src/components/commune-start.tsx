import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { COMMUNES_BY_POPULATION } from "@/lib/territory";

/**
 * Seize portes d'entrée du tunnel, posées là où la personne arrive.
 *
 * On ne présente pas le service, on commence à réserver. La question est celle
 * que se pose réellement quelqu'un devant une plateforme locale — « est-ce
 * que vous venez chez moi ? » — et chaque pastille y répond « oui » d'un
 * geste.
 *
 * **Elle n'ouvre plus le tunnel à l'écran suivant.** Le tunnel demande
 * désormais l'adresse dès le premier écran, et une commune n'en est pas une :
 * le paramètre reste transmis parce qu'il sert encore — repère de la saisie
 * manuelle, exemple du champ, préchargement des créneaux depuis le centre de
 * la commune pendant qu'on tape — mais il ne fait plus sauter d'étape. La
 * copie ne promet donc plus un raccourci qui n'existe pas.
 *
 * Le composant ne porte aucun code client : ce sont seize liens. Il fonctionne
 * donc partout, y compris sur la vitrine statique, et n'ajoute rien au poids
 * d'une page dont le référencement est le canal d'acquisition.
 */
export function CommuneStart({ className = "" }: { className?: string }) {
  return (
    <section
      className={`rounded-2xl bg-primary p-6 text-primary-foreground shadow-mango sm:p-8 ${className}`}
      aria-labelledby="commune-start"
      /* Tant que ce bloc est à l'écran, la barre collante s'efface. */
      data-booking-cta
    >
      <h2
        id="commune-start"
        className="text-xl font-extrabold text-primary-foreground"
      >
        Où habitez-vous ?
      </h2>
      <p className="mt-1 text-sm text-primary-foreground/80">
        Choisissez votre commune : nous vous montrons les créneaux disponibles
        dès que vous nous aurez donné votre adresse.
      </p>

      <ul className="mt-5 flex flex-wrap gap-2">
        {COMMUNES_BY_POPULATION.map((commune) => (
          <li key={commune.slug}>
            <Link
              href={`/reserver?commune=${commune.slug}`}
              className="inline-flex min-h-11 items-center rounded-full bg-ink-0/70 px-4 text-sm font-semibold ring-1 ring-ink-0 transition-colors hover:bg-ink-900 hover:text-primary"
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
