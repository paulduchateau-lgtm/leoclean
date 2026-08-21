"use client";

import { CheckIcon, MapPinIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * « Est-ce que vous venez chez moi ? »
 *
 * C'est la première question que se pose quelqu'un devant un service local, et
 * la seule que le reste de la page ne peut pas trancher : seize pastilles
 * répondent à qui sait déjà lire une carte, pas à qui connaît son code postal
 * et rien d'autre. Le champ répond en un geste, sans quitter l'accueil.
 *
 * Trois choix, tous conséquents :
 *
 * - **Il ne remplace pas les seize liens**, il les précède. Le maillage
 *   interne vers les pages commune est le canal d'acquisition du site, et un
 *   champ de recherche n'est pas indexable — les pastilles restent en dessous.
 * - **Il n'ouvre pas le tunnel avec la commune** : le bouton pointe sur
 *   `/reserver` sans paramètre, puisque le tunnel demande désormais l'adresse
 *   exacte dès le premier écran. Transmettre une commune ferait promettre un
 *   raccourci qui n'existe plus.
 * - **Le référentiel arrive en props**, réduit à quatre champs par commune.
 *   Importer `territory.ts` ici embarquerait dans le paquet client des
 *   coordonnées, des codes INSEE et des populations dont l'écran n'a rien à
 *   faire.
 *
 * Un code postal ne désigne pas une commune : 33650 en couvre six. La réponse
 * les nomme donc toutes, plutôt que d'en choisir une au hasard.
 */

export type CommuneCoverage = {
  slug: string;
  name: string;
  postalCode: string;
  /** Temps de route depuis le siège. `null` pour le siège lui-même. */
  driveMinutes: number | null;
};

/** Sans accents ni casse : personne ne tape « Saint-Médard-d'Eyrans ». */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

export function CouvertureCheck({
  communes,
  phoneE164,
  className = "",
}: {
  communes: readonly CommuneCoverage[];
  phoneE164: string;
  className?: string;
}) {
  const fieldId = useId();
  const [query, setQuery] = useState("");

  const needle = fold(query);
  /* Deux caractères : en deçà, tout correspond et la réponse ne dit rien. */
  const asked = needle.length >= 2;
  const matches = asked
    ? communes.filter(
        (commune) =>
          commune.postalCode.startsWith(needle) ||
          fold(commune.name).includes(needle),
      )
    : [];

  return (
    <div
      className={`rounded-[var(--r-l)] border border-border bg-card p-5 sm:p-6 ${className}`}
    >
      {/* Un formulaire, pour que la touche Entrée d'un clavier mobile ne
          recharge pas la page. La réponse est de toute façon calculée à la
          frappe : il n'y a rien à envoyer. */}
      <form onSubmit={(event) => event.preventDefault()}>
        <Label htmlFor={fieldId} className="font-extrabold">
          Votre code postal
        </Label>
        <p
          id={`${fieldId}-aide`}
          className="mt-1 text-sm text-muted-foreground"
        >
          Tapez-le : on vous dit tout de suite si nous venons chez vous, et en
          combien de temps.
        </p>

        <div className="relative mt-3">
          <SearchIcon
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={fieldId}
            value={query}
            /* Le clavier numérique s'ouvre pour un code postal sans interdire
               d'écrire un nom de commune : `inputMode` propose, il n'impose
               pas. */
            inputMode="numeric"
            autoComplete="postal-code"
            aria-describedby={`${fieldId}-aide`}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="33850, ou Léognan"
            className="min-h-13 pl-9 text-base"
          />
        </div>
      </form>

      {/* La réponse est annoncée : elle apparaît sans navigation, donc rien
          ne la lirait autrement. `polite` et non `assertive` — elle change à
          chaque caractère. */}
      <div aria-live="polite" className="mt-4">
        {!asked ? null : matches.length > 0 ? (
          <div data-booking-cta>
            <p className="flex items-start gap-2 font-bold">
              <CheckIcon
                className="mt-0.5 size-5 shrink-0 text-brand"
                strokeWidth={3}
                aria-hidden
              />
              Oui, nous intervenons chez vous.
            </p>

            <ul className="mt-3 flex flex-wrap gap-2">
              {matches.map((commune) => (
                <li key={commune.slug}>
                  <Link
                    href={`/menage-a-domicile/${commune.slug}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 text-sm font-semibold transition-colors hover:border-teal-300"
                  >
                    {commune.name}
                    <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                      {commune.driveMinutes === null
                        ? "siège"
                        : `${commune.driveMinutes} min`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              href="/reserver"
              className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-8 font-bold text-primary-foreground shadow-action transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-pineapple-500"
            >
              Voir mes créneaux
            </Link>
          </div>
        ) : (
          /* Un refus est une réponse, pas une impasse : on donne le numéro
             plutôt que de laisser quelqu'un devant un champ qui ne rend
             rien. */
          <div>
            <p className="font-bold">Pas encore chez vous.</p>
            <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
              Nous ne desservons que le sud de Bordeaux, et nous préférons le
              dire franchement plutôt que d&apos;envoyer quelqu&apos;un de trop
              loin.{" "}
              <a href={`tel:${phoneE164}`} className="text-brand underline">
                Appelez-nous
              </a>{" "}
              : si vous êtes juste à côté de la zone, on vous le dira.
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
        <MapPinIcon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
        Même tarif dans toutes les communes desservies, sans frais de
        déplacement.
      </p>
    </div>
  );
}
