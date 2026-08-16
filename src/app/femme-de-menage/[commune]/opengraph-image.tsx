import { notFound } from "next/navigation";

import {
  fillTemplate,
  getIntentionPage,
  intentionPages,
} from "@/lib/intentions";
import { OG_CONTENT_TYPE, OG_SIZE, ogCard, ogLead } from "@/lib/seo/og";

/** Carte de partage de « Femme de ménage à <commune> ». */

const INTENTION = "femme-de-menage";

export function generateStaticParams() {
  return intentionPages(INTENTION).map(({ commune }) => ({
    commune: commune.slug,
  }));
}

export const dynamicParams = false;
/**
 * L'image est un fichier, jamais une réponse calculée : elle ne dépend que du
 * contenu du dépôt. Le dire explicitement est en outre exigé par l'export
 * statique de la vitrine de démonstration, qui refuse de construire une route
 * de métadonnées dont le mode de rendu n'est pas tranché.
 */
export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ commune: string }>;
}) {
  const { commune: slug } = await params;
  const page = getIntentionPage(INTENTION, slug);

  if (!page) {
    notFound();
  }

  return ogCard({
    overline: "Femme de ménage",
    title: fillTemplate("Femme de ménage à {commune}", page.commune.name),
    subtitle: ogLead(page.local.text),
  });
}
