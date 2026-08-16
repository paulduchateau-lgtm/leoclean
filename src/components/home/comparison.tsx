import { FACTS } from "@/lib/facts";

/**
 * Comparatif des trois façons de faire faire son ménage.
 *
 * On compare des **modèles**, jamais des sociétés : aucun concurrent n'est
 * nommé, aucun superlatif n'est employé, et chaque case défavorable à un autre
 * modèle doit rester défendable devant la personne qui l'opère. « Selon les
 * disponibilités » décrit un fonctionnement réel ; « moins fiable » serait une
 * appréciation, et une appréciation sur un concurrent identifiable est un
 * dénigrement.
 *
 * Un tableau plutôt qu'une prose : c'est la forme qu'un modèle de langage
 * reprend le plus fidèlement pour répondre à « quelle différence entre une
 * plateforme locale et un emploi direct ». D'où aussi le DOM unique — rendre
 * une version mobile et une version desktop dupliquerait tout le contenu, et
 * ce qui est lu deux fois est cité de travers.
 *
 * Sur mobile, le tableau se déplie en blocs par critère plutôt que de défiler
 * horizontalement : un tableau qu'il faut pousser du doigt n'est pas lu. Les
 * rôles ARIA sont reposés à la main, `display: block` faisant perdre à un
 * `<table>` sa sémantique de tableau.
 */

const MODELS = [
  "Léo Clean",
  "Plateforme nationale",
  "Emploi direct (CESU)",
] as const;

const ROWS: readonly {
  criterion: string;
  values: readonly [string, string, string];
}[] = [
  {
    criterion: "Le même intervenant à chaque passage",
    values: ["Oui, sur formule régulière", "Selon les disponibilités", "Oui"],
  },
  {
    criterion: "Un intervenant qui habite le secteur",
    values: [
      `Oui, ${FACTS.maxDriveMinutes} min de route au maximum`,
      "Non garanti",
      "Selon votre recherche",
    ],
  },
  {
    criterion: "Un interlocuteur joignable",
    values: [
      "Un numéro direct, quelqu'un décroche",
      "Formulaire ou messagerie",
      "Aucun",
    ],
  },
  {
    criterion: "Vous êtes l'employeur",
    values: ["Non", "Non", "Oui"],
  },
  {
    criterion: "Gestion administrative",
    values: [
      "Prise en charge",
      "Prise en charge",
      "À votre charge : contrat, paie, congés",
    ],
  },
  {
    criterion: "Assurance responsabilité civile professionnelle",
    values: [
      "Vérifiée avant la première intervention",
      "Selon la plateforme",
      "À vérifier vous-même",
    ],
  },
  {
    criterion: "Engagement",
    values: ["Aucun", "Selon l'offre", "Contrat de travail"],
  },
];

export function Comparison() {
  return (
    <section className="border-y border-border-subtle bg-cream-50">
      <div className="mx-auto w-full max-w-4xl px-6 py-16">
        <h2 className="text-2xl font-black tracking-tight">
          Trois façons de faire faire son ménage
        </h2>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Aucune n&apos;est mauvaise, elles ne répondent simplement pas à la
          même attente. Voici ce qui change concrètement.
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
                    index === 0 ? "text-brand" : ""
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

                {row.values.map((value, index) => (
                  <td
                    key={MODELS[index]}
                    role="cell"
                    className={`flex justify-between gap-4 border-t border-border-subtle py-2 sm:table-cell sm:border-0 sm:p-3 sm:align-top ${
                      index === 0 ? "font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {/* Le nom du modèle n'est répété qu'en mobile, où la
                        colonne n'a plus d'en-tête au-dessus d'elle. */}
                    <span className="shrink-0 text-muted-foreground sm:hidden">
                      {MODELS[index]}
                    </span>
                    <span className="text-right sm:text-left">{value}</span>
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
