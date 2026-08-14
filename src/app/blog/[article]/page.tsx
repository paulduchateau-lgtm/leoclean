import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleBody } from "@/components/article-body";
import { ContactChannels } from "@/components/contact-channels";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  getPublishedArticle,
  publishedArticles,
  readingMinutes,
} from "@/lib/blog";
import { getPublishedCommune } from "@/lib/communes-content";
import { clientEnv } from "@/lib/env";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
  organizationJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { absoluteUrl } from "@/lib/site";

/**
 * Article de conseil.
 *
 * Statique comme le reste du site public. Le paramètre `dynamicParams` est à
 * faux : un slug inconnu doit renvoyer 404 immédiatement plutôt que d'être
 * rendu à la demande, sans quoi un article retiré — celui qui suppose la
 * déclaration SAP, par exemple — resterait atteignable par son URL.
 */

const SAP_DECLARED = clientEnv.NEXT_PUBLIC_SAP_DECLARED;

export function generateStaticParams() {
  return publishedArticles(SAP_DECLARED).map((article) => ({
    article: article.slug,
  }));
}

export const revalidate = 86_400;
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: PageProps<"/blog/[article]">): Promise<Metadata> {
  const { article: slug } = await params;
  const article = getPublishedArticle(slug, SAP_DECLARED);

  if (!article) {
    return {};
  }

  const path = `/blog/${article.slug}`;

  return {
    title: article.metaTitle ?? article.title,
    description: article.description,
    alternates: { canonical: path },
    openGraph: {
      title: article.title,
      description: article.description,
      url: absoluteUrl(path),
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
    },
  };
}

export default async function ArticlePage({
  params,
}: PageProps<"/blog/[article]">) {
  const { article: slug } = await params;
  const article = getPublishedArticle(slug, SAP_DECLARED);

  if (!article) {
    notFound();
  }

  const path = `/blog/${article.slug}`;
  const others = publishedArticles(SAP_DECLARED).filter(
    (entry) => entry.slug !== article.slug,
  );
  const communes = article.relatedCommuneSlugs
    .map((communeSlug) => getPublishedCommune(communeSlug))
    .filter((entry) => entry !== undefined);

  const structuredData = [
    organizationJsonLd(),
    articleJsonLd({
      headline: article.title,
      description: article.description,
      path,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt,
      wordCount: readingMinutes(article) * 220,
    }),
    breadcrumbJsonLd([
      { name: "Accueil", path: "/" },
      { name: "Conseils", path: "/blog" },
      { name: article.title, path },
    ]),
    faqJsonLd(article.faq),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />

      <SiteHeader />

      <main className="flex flex-1 flex-col">
        <nav
          aria-label="Fil d'Ariane"
          className="mx-auto w-full max-w-4xl px-6 pt-6"
        >
          <ol className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="hover:text-primary">
                Accueil
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/blog" className="hover:text-primary">
                Conseils
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-foreground">
              {article.title}
            </li>
          </ol>
        </nav>

        <article className="mx-auto w-full max-w-4xl px-6 py-10">
          <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
            {article.title}
          </h1>

          <p className="mt-4 text-sm text-muted-foreground">
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

          <p className="mt-6 max-w-prose text-lg text-pretty">
            {article.description}
          </p>

          <div className="mt-10">
            <ArticleBody blocks={article.blocks} />
          </div>

          <section className="mt-14">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              Questions fréquentes
            </h2>
            <div className="mt-6 space-y-6">
              {article.faq.map((entry) => (
                <div key={entry.question}>
                  <h3 className="font-heading text-lg font-semibold">
                    {entry.question}
                  </h3>
                  <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
                    {entry.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </article>

        <section className="border-y border-border bg-primary/5">
          <div className="mx-auto w-full max-w-4xl px-6 py-12 text-center">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              Une question sur votre situation ?
            </h2>
            <p className="mx-auto mt-3 max-w-prose text-muted-foreground">
              Un article ne remplace pas une réponse. Appelez, écrivez sur
              WhatsApp ou envoyez un email : c&apos;est nous qui répondons.
            </p>
            <ContactChannels className="mt-6" />
          </div>
        </section>

        {communes.length > 0 ? (
          <section className="mx-auto w-full max-w-4xl px-6 py-12">
            <h2 className="font-heading text-xl font-semibold tracking-tight">
              Le ménage près de chez vous
            </h2>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {communes.map(({ commune }) => (
                <li key={commune.slug}>
                  <Link
                    href={`/menage-a-domicile/${commune.slug}`}
                    className="text-primary hover:underline"
                  >
                    Ménage à {commune.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {others.length > 0 ? (
          <section className="mx-auto w-full max-w-4xl px-6 pb-12">
            <h2 className="font-heading text-xl font-semibold tracking-tight">
              À lire aussi
            </h2>
            <ul className="mt-4 space-y-2">
              {others.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={`/blog/${entry.slug}`}
                    className="text-primary hover:underline"
                  >
                    {entry.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
