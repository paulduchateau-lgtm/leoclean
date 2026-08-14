import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { publishedArticles, readingMinutes } from "@/lib/blog";
import { clientEnv } from "@/lib/env";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { COMMUNES } from "@/lib/territory";

export const metadata: Metadata = {
  title: "Conseils ménage à domicile",
  description:
    "Prix, durées, statuts, état des lieux : les réponses aux questions qu'on se pose avant de faire appel à quelqu'un pour son ménage, dans le sud de Bordeaux.",
  alternates: { canonical: "/blog" },
};

export const revalidate = 86_400;

export default function BlogIndexPage() {
  const articles = publishedArticles(clientEnv.NEXT_PUBLIC_SAP_DECLARED);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            organizationJsonLd(),
            breadcrumbJsonLd([
              { name: "Accueil", path: "/" },
              { name: "Conseils", path: "/blog" },
            ]),
          ]),
        }}
      />

      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Conseils ménage à domicile
        </h1>
        <p className="mt-5 max-w-prose text-lg text-pretty text-muted-foreground">
          Ce qu&apos;on nous demande au téléphone, écrit une fois pour toutes :
          combien ça coûte, combien de temps ça prend, qui est l&apos;employeur
          de qui. Les chiffres cités sont ceux que nous appliquons dans les{" "}
          {COMMUNES.length} communes du sud de Bordeaux.
        </p>

        <ul className="mt-10 space-y-4">
          {articles.map((article) => (
            <li key={article.slug}>
              <Link
                href={`/blog/${article.slug}`}
                className="block rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary"
              >
                <h2 className="font-heading text-xl font-semibold tracking-tight text-balance">
                  {article.title}
                </h2>
                <p className="mt-2 text-pretty text-muted-foreground">
                  {article.description}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  <time dateTime={article.updatedAt}>
                    Mis à jour le{" "}
                    {new Date(article.updatedAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>{" "}
                  · {readingMinutes(article)} min de lecture
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <SiteFooter />
    </>
  );
}
