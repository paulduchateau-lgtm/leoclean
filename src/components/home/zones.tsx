import Link from "next/link";

import { publishedCommunes } from "@/lib/communes-content";
import { FACTS } from "@/lib/facts";
import { SITE } from "@/lib/site";
import { TERRITORY_POPULATION } from "@/lib/territory";

/**
 * Les seize communes, en fin de parcours.
 *
 * C'est le déplacement central de la refonte. Ces liens ouvraient la page :
 * seize choix demandés à quelqu'un qui n'avait encore reçu aucune raison de
 * rester, c'est-à-dire un effort de sélection administratif avant le moindre
 * argument. Placés ici, les mêmes liens changent de nature — ils ne sont plus
 * un menu mais **la preuve de la thèse**, à condition que chaque pastille
 * porte son temps de trajet. C'est ce chiffre, répété seize fois, qui montre
 * qu'un rayon court n'est pas une promesse mais une géographie.
 *
 * Aucun lien interne n'est perdu au passage : ce sont les seize pages commune
 * qui étaient déjà liées depuis l'accueil, vers les mêmes URL.
 *
 * Deux familles, parce qu'en confondre une avec l'autre serait inexact :
 * Gradignan, Villenave-d'Ornon et Cestas sont desservies aux mêmes conditions
 * mais n'appartiennent pas à la Communauté de communes de Montesquieu. Le
 * cadre narratif du site est « le sud de Bordeaux », l'intercommunalité n'en
 * est qu'une partie — nommée parce que les moteurs la connaissent.
 */

const published = publishedCommunes();

const GROUPS = [
  {
    title: "Bordeaux Sud",
    communes: published.filter(({ commune }) => !commune.inMontesquieu),
  },
  {
    title: "Communauté de communes de Montesquieu",
    communes: published.filter(({ commune }) => commune.inMontesquieu),
  },
].map((group) => ({
  ...group,
  // Du plus proche au plus lointain : l'ordre raconte la même chose que les
  // chiffres.
  communes: [...group.communes].sort(
    (a, b) =>
      a.content.driveMinutesFromLeognan - b.content.driveMinutesFromLeognan,
  ),
}));

export function Zones() {
  return (
    <section className="border-y border-border-subtle bg-cream-50">
      <div className="mx-auto w-full max-w-4xl px-6 py-16">
        <h2 className="text-2xl font-black tracking-tight">Où nous venons</h2>
        <p className="mt-2 max-w-prose text-muted-foreground">
          {FACTS.communeCount} communes du sud de Bordeaux, soit{" "}
          {TERRITORY_POPULATION.toLocaleString("fr-FR")} habitants. Le chiffre
          en face de chaque commune est le temps de route depuis notre siège de{" "}
          {SITE.address.city}.
        </p>

        {GROUPS.map((group) => (
          <div key={group.title} className="mt-8">
            <h3 className="text-muted-foreground overline">{group.title}</h3>

            <ul className="mt-3 flex flex-wrap gap-2">
              {group.communes.map(({ commune, content }) => (
                <li key={commune.slug}>
                  <Link
                    href={`/menage-a-domicile/${commune.slug}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium transition-colors hover:border-teal-300 hover:bg-teal-50"
                  >
                    {commune.name}
                    {/* Le chiffre en mono : un temps de route est une donnée,
                        pas un mot. */}
                    <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                      {commune.isHeadquarters
                        ? "siège"
                        : `${content.driveMinutesFromLeognan} min`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <p className="mt-8 text-sm text-muted-foreground">
          <Link href="/zones-desservies" className="text-brand underline">
            Voir le détail des zones desservies
          </Link>
        </p>

        <p className="mt-3 text-sm text-muted-foreground">
          Votre commune n&apos;apparaît pas ?{" "}
          <a href={`tel:${FACTS.phoneE164}`} className="text-brand underline">
            Appelez-nous
          </a>
          , on vous dira franchement si on peut.
        </p>
      </div>
    </section>
  );
}
