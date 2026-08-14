import { CheckIcon, MapPinIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";
import { COMMUNES, HEADQUARTERS, TERRITORY_POPULATION } from "@/lib/territory";

/**
 * Page d'attente.
 *
 * Le site public complet — pages par commune, JSON-LD, blog, tunnel de
 * réservation — est construit en phase 4. Cette page existe pour valider le
 * socle : typographie, palette, rendu statique, accessibilité.
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-border bg-secondary/40">
        <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-28">
          <Badge variant="secondary" className="mb-6 gap-1.5">
            <MapPinIcon className="size-3.5" aria-hidden />
            Léognan et {COMMUNES.length - 1} communes voisines
          </Badge>

          <h1 className="font-heading text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
            Le ménage à domicile, par des personnes qui habitent à côté de chez
            vous.
          </h1>

          <p className="mt-6 max-w-prose text-lg text-pretty text-muted-foreground">
            {SITE.description} Un intervenant attitré que vous retrouvez chaque
            semaine, des trajets courts, et quelqu&apos;un à qui parler dans la
            même commune que vous.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" disabled>
              Réserver un ménage
            </Button>
            <Button size="lg" variant="outline" disabled>
              Devenir intervenant
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Réservation en ligne en cours d&apos;ouverture.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-6 py-16">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Notre zone d&apos;intervention
        </h2>
        <p className="mt-2 text-muted-foreground">
          LéoClean intervient dans les {COMMUNES.length} communes de la
          Communauté de communes de Montesquieu, soit{" "}
          {TERRITORY_POPULATION.toLocaleString("fr-FR")} habitants en Gironde,
          au sud de Bordeaux.
        </p>

        <ul className="mt-8 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {COMMUNES.map((commune) => (
            <li
              key={commune.slug}
              className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-3"
            >
              <span className="flex items-center gap-2 font-medium">
                <CheckIcon
                  className="size-4 shrink-0 text-primary"
                  aria-hidden
                />
                {commune.name}
                {commune.isHeadquarters ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    siège
                  </span>
                ) : null}
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {commune.postalCode}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-auto border-t border-border bg-secondary/40">
        <div className="mx-auto w-full max-w-3xl px-6 py-10 text-sm text-muted-foreground">
          <p className="font-heading text-base font-semibold text-foreground">
            {SITE.name}
          </p>
          <p className="mt-1">
            {HEADQUARTERS.name} ({HEADQUARTERS.postalCode}), Gironde,
            Nouvelle-Aquitaine
          </p>
          <p className="mt-1">
            <a
              href={`tel:${SITE.phoneE164}`}
              className="font-medium text-foreground"
            >
              {SITE.phone}
            </a>{" "}
            — <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
          </p>
        </div>
      </footer>
    </main>
  );
}
