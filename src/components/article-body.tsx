import type { ArticleBlock } from "@/lib/blog";

/**
 * Rendu d'un article.
 *
 * Le corps des articles est une liste de blocs typés, jamais du HTML : rien de
 * ce qui est écrit dans `lib/blog.ts` ne peut produire de balise, donc rien ne
 * peut être injecté par mégarde dans une page servie statiquement.
 *
 * Les titres de section sont des `h2` : le `h1` appartient à la page, et une
 * hiérarchie cassée est l'une des rares choses qu'un moteur pénalise sans
 * l'annoncer.
 */
export function ArticleBody({ blocks }: { blocks: readonly ArticleBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className="max-w-prose text-pretty text-muted-foreground">
          {block.text}
        </p>
      );

    case "heading":
      return (
        <h2 className="pt-6 font-heading text-2xl font-semibold tracking-tight">
          {block.text}
        </h2>
      );

    case "list":
      return (
        <ul className="max-w-prose list-disc space-y-2 pl-5 text-muted-foreground marker:text-primary">
          {block.items.map((item) => (
            <li key={item} className="text-pretty">
              {item}
            </li>
          ))}
        </ul>
      );

    case "table":
      // Tableau sémantique, avec légende : c'est le format le plus fiablement
      // repris par les moteurs et les modèles de langage. Le débordement est
      // confiné au conteneur, pour que la page ne défile jamais latéralement.
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="pb-3 text-left text-sm text-muted-foreground">
              {block.caption}
            </caption>
            <thead>
              <tr className="border-b border-border">
                {block.columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="py-3 pr-4 font-medium whitespace-nowrap"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join("|")} className="border-b border-border/60">
                  {row.map((cell, index) =>
                    index === 0 ? (
                      <th
                        key={cell}
                        scope="row"
                        className="py-3 pr-4 font-medium"
                      >
                        {cell}
                      </th>
                    ) : (
                      <td
                        key={cell}
                        className="py-3 pr-4 text-muted-foreground"
                      >
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "note":
      return (
        <aside className="max-w-prose rounded-xl border border-primary/20 bg-primary/5 p-5">
          <p className="font-heading font-semibold">{block.title}</p>
          <p className="mt-2 text-pretty text-muted-foreground">{block.text}</p>
        </aside>
      );
  }
}
