import { FACTS } from "@/lib/facts";
import { formatHourlyRate } from "@/lib/pricing";

/**
 * Bandeau de crédibilité : quatre nombres, tous vrais aujourd'hui.
 *
 * Il suit immédiatement la thèse et lui donne ses preuves. Le format est
 * délibérément pauvre — un nombre, un libellé — parce que sa fonction est
 * d'être lu en un coup d'œil, avant tout défilement, sur un écran de 390
 * pixels : d'où la grille 2×2 en mobile.
 *
 * Aucune valeur n'est écrite ici : toutes viennent de `FACTS`, qui les dérive
 * lui-même des modules qui les détiennent. Et aucune n'est une métrique
 * d'activité — nombre de clients, note moyenne, interventions réalisées : tant
 * qu'elles n'existent pas, elles n'ont pas leur place dans ce bandeau, dont
 * toute la valeur tient à ce qu'il ne contienne rien d'invérifiable.
 */
const FIGURES = [
  {
    value: String(FACTS.communeCount),
    label: "communes desservies",
  },
  {
    value: `${FACTS.maxDriveMinutes} min`,
    label: "de route au maximum",
  },
  {
    value: formatHourlyRate(FACTS.lowestHourlyRateCents),
    label: `minimum ${FACTS.minimumBillableMinutes / 60} heures`,
  },
  {
    value: "1",
    label: "vrai numéro, quelqu'un décroche",
  },
];

export function KeyFigures() {
  return (
    <section
      className="border-b border-border-subtle bg-card"
      aria-label="Léo Clean en quatre chiffres"
    >
      <dl className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-px overflow-hidden bg-border-subtle sm:grid-cols-4">
        {FIGURES.map((figure) => (
          <div key={figure.label} className="bg-card px-5 py-6 text-center">
            <dt className="sr-only">{figure.label}</dt>
            <dd>
              <span className="block text-3xl font-black tracking-tight text-brand">
                {figure.value}
              </span>
              <span className="mt-1 block text-sm text-pretty text-muted-foreground">
                {figure.label}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
