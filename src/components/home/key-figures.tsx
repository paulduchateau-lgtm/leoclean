import { SERVICES } from "@/components/home/services";
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
 *
 * Ce sont les chiffres du prototype, orientés offre, à une exception près :
 * son « −50 % de crédit d'impôt » est interdit par `fiscal.ts` tant que la
 * déclaration SAP n'est pas obtenue — les seize communes tiennent la
 * quatrième tuile. Le nombre de prestations est compté sur la grille de
 * `services.tsx`, jamais écrit : une cinquième prestation ajoutée là-bas se
 * répercuterait ici sans qu'on y pense.
 */
const FIGURES = [
  {
    value: formatHourlyRate(FACTS.lowestHourlyRateCents),
    label: "en formule régulière",
    tone: "bg-teal-50",
  },
  {
    value: `${FACTS.freeCancellationHours} h`,
    label: "pour annuler sans rien payer",
    tone: "bg-mango-50",
  },
  {
    value: String(SERVICES.length),
    label: "prestations, du ménage courant à la fin de bail",
    tone: "bg-papaya-50",
  },
  {
    value: String(FACTS.communeCount),
    label: "communes desservies, au même tarif",
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
          fois.

          **`justify-end` n'est pas cosmétique.** En `column-reverse`, l'axe
          principal descend du bas vers le haut : `flex-start` — la valeur par
          défaut — tasse donc le contenu **au bas** de la tuile. Les quatre
          tuiles étant étirées à la même hauteur par la grille, celle dont le
          libellé tient sur une seule ligne voyait son nombre descendre d'un
          cran sous les trois autres. `justify-end` désigne le haut de cet axe,
          et les quatre nombres retrouvent la même ligne. */}
      <dl className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-3 px-6 py-8 sm:grid-cols-4">
        {FIGURES.map((figure) => (
          <div
            key={figure.label}
            className={`flex flex-col-reverse justify-end rounded-[var(--r-l)] px-5 py-6 text-center ${figure.tone}`}
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
