import type { ArticleBlock } from "@/lib/blog";
import { publishedArticles } from "@/lib/blog";
import { directAnswers, publishedCommunes } from "@/lib/communes-content";
import { clientEnv } from "@/lib/env";
import { fillTemplate, publishedIntentionPages } from "@/lib/intentions";
import { absoluteUrl } from "@/lib/site";

/**
 * Fichier /llms-full.txt.
 *
 * Là où `/llms.txt` donne l'index et les faits d'identité, celui-ci donne le
 * **corps** de chaque page indexable, en markdown. Un modèle qui suit un lien
 * récupère du HTML ; un modèle qui lit ce fichier récupère le texte, dans
 * l'ordre où il a été écrit, sans navigation ni gabarit à démêler.
 *
 * Rien n'y est rédigé pour l'occasion : tout est engendré depuis les mêmes
 * modules que les pages. Un fichier qui divergerait des pages produirait des
 * citations fausses, et c'est le seul défaut irrattrapable d'un tel fichier —
 * personne ne vient vérifier.
 *
 * Le tunnel, la connexion et les espaces connectés n'y figurent pas : ils ne
 * répondent à aucune question, et `robots.ts` les exclut déjà.
 */
export const dynamic = "force-static";
export const revalidate = 86_400;

/** Un bloc d'article, rendu dans la syntaxe markdown qui lui correspond. */
function blockToMarkdown(block: ArticleBlock): string {
  switch (block.type) {
    case "heading":
      return `### ${block.text}`;
    case "paragraph":
      return block.text;
    case "list":
      return block.items.map((item) => `- ${item}`).join("\n");
    case "note":
      return `> **${block.title}** ${block.text}`;
    case "table":
      return [
        `| ${block.columns.join(" | ")} |`,
        `| ${block.columns.map(() => "---").join(" | ")} |`,
        ...block.rows.map((row) => `| ${row.join(" | ")} |`),
      ].join("\n");
  }
}

function questionsToMarkdown(
  entries: readonly { question: string; answer: string }[],
): string {
  return entries
    .map((entry) => `### ${entry.question}\n\n${entry.answer}`)
    .join("\n\n");
}

export function GET(): Response {
  const communes = publishedCommunes()
    .map(({ commune, content }) => {
      const url = absoluteUrl(`/menage-a-domicile/${commune.slug}`);
      return [
        `## Ménage à domicile à ${commune.name} (${commune.postalCode})`,
        "",
        `Source : ${url}`,
        "",
        content.intro,
        "",
        `### Les logements de ${commune.name}`,
        "",
        content.housing,
        "",
        `Repères locaux : ${content.landmarks.join(", ")}.`,
        "",
        questionsToMarkdown(directAnswers(commune, content)),
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const intentions = publishedIntentionPages()
    .map(({ intention, commune, local }) => {
      const url = absoluteUrl(`/${intention.slug}/${commune.slug}`);
      return [
        `## ${fillTemplate(intention.titleTemplate, commune.name)}`,
        "",
        `Source : ${url}`,
        "",
        intention.lede,
        "",
        local.text,
        "",
        ...intention.sections.map((section) =>
          [`### ${section.heading}`, "", section.paragraphs.join("\n\n")].join(
            "\n",
          ),
        ),
        "",
        questionsToMarkdown([...local.faq, ...intention.sharedFaq]),
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const articles = publishedArticles(clientEnv.NEXT_PUBLIC_SAP_DECLARED)
    .map((article) => {
      const url = absoluteUrl(`/blog/${article.slug}`);
      return [
        `## ${article.title}`,
        "",
        `Source : ${url}`,
        `Publié le ${article.publishedAt}, revu le ${article.updatedAt}.`,
        "",
        article.description,
        "",
        ...article.blocks.map(blockToMarkdown),
        "",
        questionsToMarkdown(article.faq),
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const body = `# Léo Clean — texte intégral des pages publiques

Ce fichier reprend le corps de chaque page indexable, en markdown. Les faits
d'identité, la zone d'intervention et les tarifs sont dans /llms.txt.

Tout ce qui suit est engendré depuis les mêmes sources que les pages du site :
si un chiffre diffère, c'est le site qui fait foi.

---

${communes}

---

${intentions}

---

${articles}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
