import Link from "next/link";

import { Logo } from "@/components/brand/logo";

import { publishedCommunes } from "@/lib/communes-content";
import { publishedIntentionPages } from "@/lib/intentions";
import { SITE } from "@/lib/site";
import { MONTESQUIEU_COMMUNES, TERRITORY_POPULATION } from "@/lib/territory";

export function SiteFooter() {
  const published = publishedCommunes();
  const intentions = publishedIntentionPages();

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
                    className="hover:text-primary"
                  >
                    {commune.name} ({commune.postalCode})
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <nav aria-label="Autres prestations" className="mt-8">
          <p className="text-sm font-medium">Autres prestations</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {intentions.map(({ intention, commune }) => (
              <li key={`${intention.slug}-${commune.slug}`}>
                <Link
                  href={`/${intention.slug}/${commune.slug}`}
                  className="hover:text-primary"
                >
                  {intention.slug === "repassage"
                    ? `Repassage à ${commune.name}`
                    : `Femme de ménage à ${commune.name}`}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/blog" className="hover:text-primary">
                Conseils ménage
              </Link>
            </li>
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
