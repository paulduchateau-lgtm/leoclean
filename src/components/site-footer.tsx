import Link from "next/link";

import { Logo } from "@/components/brand/logo";

import { publishedCommunes } from "@/lib/communes-content";
import { INTERVENANT_PAGE_READY } from "@/lib/facts";
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
    <footer className="mt-auto border-t border-border bg-secondary/40">
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <Logo href={null} />
            <p className="mt-2 text-sm text-muted-foreground">
              Ménage à domicile à {SITE.address.city} ({SITE.address.postalCode}
              ), dans les {MONTESQUIEU_COMMUNES.length} communes de la
              Communauté de communes de Montesquieu, ainsi qu&apos;à Gradignan,
              Villenave-d&apos;Ornon et Cestas.
            </p>
            <p className="mt-4 text-sm">
              <a href={`tel:${SITE.phoneE164}`} className="font-medium">
                {SITE.phone}
              </a>
              <br />
              <a
                href={`mailto:${SITE.email}`}
                className="text-muted-foreground"
              >
                {SITE.email}
              </a>
            </p>
          </div>

          <nav aria-label="Communes desservies">
            <p className="text-sm font-medium">Ménage à domicile</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {published.map(({ commune }) => (
                <li key={commune.slug}>
                  <Link
                    href={`/menage-a-domicile/${commune.slug}`}
                    className="hover:text-brand"
                  >
                    {commune.name} ({commune.postalCode})
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/zones-desservies"
                  className="font-medium text-brand hover:underline"
                >
                  Les {COMMUNES.length} communes desservies
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <nav aria-label="Autres pages" className="mt-8">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <li>
              <Link href="/tarifs" className="hover:text-brand">
                Tarifs
              </Link>
            </li>
            <li>
              <Link href="/blog" className="hover:text-brand">
                Conseils ménage
              </Link>
            </li>
            {/* L'en-tête ne porte plus ce lien depuis qu'il cède la place au
                bouton de réservation ; la page reste atteignable ici, sans quoi
                elle serait orpheline tout en figurant au sitemap. */}
            <li>
              <Link href="/etre-rappele" className="hover:text-brand">
                Être rappelé
              </Link>
            </li>
            {/* La seconde porte du site, côté offre. Elle n'est annoncée
                qu'une fois ses conditions arbitrées : amener un intervenant
                sur une page qui ne sait pas encore dire ce qu'elle paie
                coûterait la candidature et la confiance. */}
            {INTERVENANT_PAGE_READY && (
              <li>
                <Link href="/travailler-avec-nous" className="hover:text-brand">
                  Devenir intervenant
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <p className="mt-10 border-t border-border/60 pt-6 text-xs text-muted-foreground">
          {TERRITORY_POPULATION.toLocaleString("fr-FR")} habitants desservis en
          Gironde, Nouvelle-Aquitaine, au sud de Bordeaux.
        </p>
      </div>
    </footer>
  );
}
