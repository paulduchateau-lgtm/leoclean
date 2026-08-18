import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { publishedArticles } from "@/lib/blog";
import { clientEnv } from "@/lib/env";

/**
 * Les conseils, depuis l'accueil.
 *
 * Le blog répond aux intentions sans nom de ville — « combien coûte », «
 * combien de temps », « fin de bail » — et l'accueil est la page qui reçoit
 * ces questions en premier. Les cartes sont lues dans `blog.ts`, jamais
 * recopiées : l'article sur le crédit d'impôt reste absent tant que la
 * déclaration SAP n'est pas obtenue, sans que cette page ait à le savoir.
 */
const FEATURED_COUNT = 4;

export function Conseils() {
  const articles = publishedArticles(clientEnv.NEXT_PUBLIC_SAP_DECLARED).slice(
    0,
    FEATURED_COUNT,
  );

  if (articles.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Nos conseils</h2>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Ce qu&apos;on nous demande le plus souvent, écrit une fois pour
            toutes.
          </p>
        </div>
        <Link
          href="/blog"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-border bg-card px-5 text-sm font-bold transition-all duration-200 ease-brand hover:-translate-y-px hover:border-teal-300 hover:bg-teal-50"
        >
          Tous les articles
          <ArrowRightIcon className="size-4" aria-hidden />
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {articles.map((article) => (
          <Link
            key={article.slug}
            href={`/blog/${article.slug}`}
            className="group flex flex-col gap-2 rounded-[var(--r-xl)] border border-border bg-card p-5 shadow-xs transition-all duration-200 ease-brand hover:-translate-y-1 hover:shadow-lg"
          >
            <h3 className="text-base font-extrabold text-pretty">
              {article.title}
            </h3>
            <p className="line-clamp-3 text-sm text-pretty text-muted-foreground">
              {article.description}
            </p>
            <span className="mt-auto flex items-center gap-1.5 pt-2 text-sm font-bold text-brand">
              Lire
              <ArrowRightIcon
                className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
