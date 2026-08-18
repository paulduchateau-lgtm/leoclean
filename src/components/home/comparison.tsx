import { CheckIcon, XIcon } from "lucide-react";

import { FACTS } from "@/lib/facts";
import { formatHourlyRate } from "@/lib/pricing";

/**
 * Comparatif des trois façons de faire venir quelqu'un chez soi.
 *
 * On compare des **modèles**, jamais des sociétés : aucun concurrent n'est
 * nommé, aucun superlatif n'est employé, et chaque case défavorable à un autre
 * modèle doit rester défendable devant la personne qui l'opère. « Abonnement,
 * souvent avec frais » décrit un fonctionnement courant et vérifiable ;
 * « moins fiable » serait une appréciation, et une appréciation sur un
 * concurrent identifiable est un dénigrement.
 *
 * Un tableau plutôt qu'une prose : c'est la forme qu'un modèle de langage
 * reprend le plus fidèlement pour répondre à « quelle différence entre une
 * plateforme locale et une agence ». D'où aussi le DOM unique — rendre une
 * version mobile et une version desktop dupliquerait tout le contenu, et ce
 * qui est lu deux fois est cité de travers.
 *
 * Sur mobile, le tableau se déplie en blocs par critère plutôt que de défiler
 * horizontalement : un tableau qu'il faut pousser du doigt n'est pas lu. Les
 * rôles ARIA sont reposés à la main, `display: block` faisant perdre à un
 * `<table>` sa sémantique de tableau.
 */

const MODELS = [
  "Plateforme nationale",
  "Agence de services",
  "Léo Clean",
] as const;

/** Index de la colonne Léo Clean — la dernière, mise en avant. */
const MINE = MODELS.length - 1;

interface Cell {
  text: string;
  ok: boolean;
}

const ROWS: readonly { criterion: string; values: readonly Cell[] }[] = [
  {
    criterion: "Toujours la même personne",
    values: [
      { text: "Celui qui est libre ce jour-là", ok: false },
      { text: "Remplacé en cas d'absence", ok: false },
      { text: "Votre intervenant attitré, sur formule régulière", ok: true },
    ],
  },
  {
    criterion: "Elle habite près de chez vous",
    values: [
      { text: "Recrutement à l'échelle d'une ville", ok: false },
      { text: "Selon le secteur commercial", ok: false },
      {
        text: `Elle vit dans l'une des ${FACTS.communeCount} communes`,
        ok: true,
      },
    ],
  },
  {
    criterion: "Sans abonnement ni préavis",
    values: [
      { text: "Abonnement, souvent avec frais", ok: false },
      { text: "Contrat et préavis de résiliation", ok: false },
      { text: "Vous réservez, ou vous ne réservez pas", ok: true },
    ],
  },
  {
    criterion: "Un prix sans frais ajoutés",
    values: [
      { text: "Frais de service en supplément", ok: false },
      { text: "Tarif contractuel", ok: true },
      {
        text: `${formatHourlyRate(FACTS.lowestHourlyRateCents)}, rien d'autre`,
        ok: true,
      },
    ],
  },
  {
    criterion: `Annulation gratuite jusqu'à ${FACTS.freeCancellationHours} h`,
    values: [
      { text: "Barème variable selon l'offre", ok: false },
      { text: "Préavis contractuel", ok: false },
      { text: "Gratuite, barème public ensuite", ok: true },
    ],
  },
  {
    criterion: "L'intervenant sait ce qu'il gagne",
    values: [
      { text: "Pourcentage prélevé après coup", ok: false },
      { text: "Grille salariale", ok: true },
      { text: "Montant accepté avant la mission", ok: true },
    ],
  },
  {
    criterion: "Quelqu'un vous répond",
    values: [
      { text: "Support en ligne", ok: false },
      { text: "Une agence, aux heures de bureau", ok: true },
      { text: "Une personne, nommée sur le site", ok: true },
    ],
  },
];

function Mark({ cell, mine }: { cell: Cell; mine: boolean }) {
  return (
    <span
      className={`flex items-start gap-1.5 ${mine ? "font-medium" : cell.ok ? "" : "text-muted-foreground"}`}
    >
      {cell.ok ? (
        <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
      ) : (
        <XIcon className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
      )}
      {cell.text}
    </span>
  );
}

export function Comparison() {
  return (
    <section className="border-y border-border-subtle bg-cream-50">
      <div className="mx-auto w-full max-w-4xl px-6 py-16">
        <h2 className="text-2xl font-black tracking-tight text-balance">
          Comment Léo Clean se distingue des autres offres
        </h2>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Trois façons de faire venir quelqu&apos;un chez soi. Nous ne nommons
          personne : ce sont des modèles, et chacun a ses raisons.
        </p>

        <table
          role="table"
          className="mt-8 block w-full border-collapse text-sm sm:table"
        >
          <thead role="rowgroup" className="hidden sm:table-header-group">
            <tr role="row">
              <th
                role="columnheader"
                scope="col"
                className="w-1/4 p-3 text-left align-bottom"
              >
                <span className="sr-only">Critère</span>
              </th>
              {MODELS.map((model, index) => (
                <th
                  key={model}
                  role="columnheader"
                  scope="col"
                  className={`p-3 text-left align-bottom font-extrabold ${
                    index === MINE
                      ? "rounded-t-[var(--r-m)] bg-teal-50 text-brand"
                      : ""
                  }`}
                >
                  {model}
                </th>
              ))}
            </tr>
          </thead>

          <tbody role="rowgroup" className="block sm:table-row-group">
            {ROWS.map((row) => (
              <tr
                key={row.criterion}
                role="row"
                className="mb-4 block rounded-[var(--r-m)] border border-border bg-card p-4 sm:mb-0 sm:table-row sm:rounded-none sm:border-0 sm:border-t sm:border-border-subtle sm:bg-transparent sm:p-0"
              >
                <th
                  role="rowheader"
                  scope="row"
                  className="block pb-2 text-left font-extrabold sm:table-cell sm:p-3 sm:align-top sm:font-bold"
                >
                  {row.criterion}
                </th>

                {row.values.map((cell, index) => (
                  <td
                    key={MODELS[index]}
                    role="cell"
                    className={`flex justify-between gap-4 border-t border-border-subtle py-2 sm:table-cell sm:border-0 sm:p-3 sm:align-top ${
                      index === MINE ? "sm:bg-teal-50" : ""
                    }`}
                  >
                    {/* Le nom du modèle n'est répété qu'en mobile, où la
                        colonne n'a plus d'en-tête au-dessus d'elle. */}
                    <span className="shrink-0 text-muted-foreground sm:hidden">
                      {MODELS[index]}
                    </span>
                    <span className="text-right sm:text-left">
                      <Mark cell={cell} mine={index === MINE} />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
