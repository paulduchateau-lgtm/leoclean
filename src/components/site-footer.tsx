import Link from "next/link";

import { Logo } from "@/components/brand/logo";

import { publishedCommunes } from "@/lib/communes-content";
import { clientEnv } from "@/lib/env";
import { SITE } from "@/lib/site";
import {
  COMMUNES,
  MONTESQUIEU_COMMUNES,
  TERRITORY_POPULATION,
} from "@/lib/territory";

/**
 * Communes mises en avant dans le pied de page.
 *
 * Six, et non seize. Le pied de page exposait quarante liens depuis chaque
 * page du site : l'autorité s'y répartissait en parts si petites qu'aucune
 * page locale n'en bénéficiait, et la liste ne servait de toute façon à
 * personne. Les six retenues sont les plus peuplées du territoire — c'est là
 * que se trouve la demande — et `/zones-desservies` porte désormais le
 * maillage exhaustif, depuis une page unique.
 */
const FOOTER_COMMUNE_COUNT = 6;

export function SiteFooter() {
  const published = publishedCommunes()
    .slice()
    .sort((a, b) => b.commune.population - a.commune.population)
    .slice(0, FOOTER_COMMUNE_COUNT);

  return (
    // Le pied de page porte la profondeur de la palette : sarcelle 900,
    // texte blanc ou sarcelle claire — le pendant de la bande sombre du déroulé.
    <footer className="mt-auto bg-teal-900 text-white">
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <Logo href={null} inverse />
            <p className="mt-2 text-sm text-teal-200">
              Ménage à domicile à {SITE.address.city} ({SITE.address.postalCode}
              ), dans les {MONTESQUIEU_COMMUNES.length} communes de la
              Communauté de communes de Montesquieu, ainsi qu&apos;à Gradignan,
              Villenave-d&apos;Ornon et Cestas.
            </p>
            <p className="mt-4 text-sm">
              <a
                href={`tel:${SITE.phoneE164}`}
                className="font-medium text-white"
              >
                {SITE.phone}
              </a>
              <br />
              <a href={`mailto:${SITE.email}`} className="text-teal-200">
                {SITE.email}
              </a>
            </p>
          </div>

          <nav aria-label="Communes desservies">
            <p className="text-sm font-medium text-teal-300">
              Ménage à domicile
            </p>
            <ul className="mt-2 space-y-1 text-sm text-teal-200">
              {published.map(({ commune }) => (
                <li key={commune.slug}>
                  <Link
                    href={`/menage-a-domicile/${commune.slug}`}
                    className="hover:text-white"
                  >
                    {commune.name} ({commune.postalCode})
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/zones-desservies"
                  className="font-medium text-teal-300 hover:underline"
                >
                  Les {COMMUNES.length} communes desservies
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <nav aria-label="Autres pages" className="mt-8">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-teal-200">
            <li>
              <Link href="/tarifs" className="hover:text-white">
                Tarifs
              </Link>
            </li>
            <li>
              <Link href="/blog" className="hover:text-white">
                Conseils ménage
              </Link>
            </li>
            {/* L'en-tête ne porte plus ce lien depuis qu'il cède la place au
                bouton de réservation ; la page reste atteignable ici, sans quoi
                elle serait orpheline tout en figurant au sitemap. */}
            <li>
              <Link href="/etre-rappele" className="hover:text-white">
                Être rappelé
              </Link>
            </li>
            {/* La seconde porte du site, côté offre, sous le même libellé
                que l'en-tête et l'accueil. `INTERVENANT_PAGE_READY` ne la garde
                plus : le drapeau tenait à la fois l'indexation de la page et sa
                désignation depuis la vitrine, et seule la première reste une
                règle — `/travailler-avec-nous` demeure en `noindex` et hors du
                sitemap tant que ses garanties ne sont pas arbitrées. */}
            {/* La vitrine statique retire la face offre de son arbre : le
                lien y pointerait vers une page absente. */}
            {!clientEnv.NEXT_PUBLIC_DEMO_STATIQUE && (
              <li>
                <Link href="/travailler-avec-nous" className="hover:text-white">
                  Devenir pro
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <p className="mt-10 border-t border-white/15 pt-6 text-xs text-teal-200">
          {TERRITORY_POPULATION.toLocaleString("fr-FR")} habitants desservis en
          Gironde, Nouvelle-Aquitaine, au sud de Bordeaux.
        </p>
      </div>
    </footer>
  );
}
