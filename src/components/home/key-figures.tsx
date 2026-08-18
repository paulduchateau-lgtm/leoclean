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
/**
 * Chaque tuile porte l'une des quatre teintes du tropical punch — sarcelle,
 * mangue, papaye, ananas — pour que le bandeau annonce la palette entière dès
 * le premier écran. Les fonds restent aux crans 50 : la couleur pleine est
 * réservée à l'action et aux pilules.
 */
const FIGURES = [
  {
    value: String(FACTS.communeCount),
    label: "communes desservies",
    tone: "bg-teal-50",
  },
  {
    value: `${FACTS.maxDriveMinutes} min`,
    label: "de route au maximum",
    tone: "bg-mango-50",
  },
  {
    value: formatHourlyRate(FACTS.lowestHourlyRateCents),
    label: `minimum ${FACTS.minimumBillableMinutes / 60} heures`,
    tone: "bg-papaya-50",
  },
  {
    value: "1",
    label: "vrai numéro, quelqu'un décroche",
    tone: "bg-pineapple-50",
  },
];

export function KeyFigures() {
  return (
    <section
      className="border-b border-border-subtle"
      aria-label="Léo Clean en quatre chiffres"
    >
      {/* `flex-col-reverse` place le nombre au-dessus de son libellé sans
          inverser le document : une liste de définitions veut le terme avant
          sa valeur, et répéter le libellé en `sr-only` le ferait entendre deux
          fois. */}
      <dl className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-3 px-6 py-8 sm:grid-cols-4">
        {FIGURES.map((figure) => (
          <div
            key={figure.label}
            className={`flex flex-col-reverse rounded-[var(--r-l)] px-5 py-6 text-center ${figure.tone}`}
          >
            <dt className="mt-1 text-sm text-pretty text-muted-foreground">
              {figure.label}
            </dt>
            <dd className="font-display text-3xl font-black tracking-tight">
              {figure.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
