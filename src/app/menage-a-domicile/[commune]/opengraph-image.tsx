import { notFound } from "next/navigation";

import {
  PUBLISHED_COMMUNE_SLUGS,
  getPublishedCommune,
} from "@/lib/communes-content";
import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from "@/lib/seo/og";

/**
 * Carte de partage d'une page commune.
 *
 * Une carte par commune, et non la carte générique : c'est le nom du lieu qui
 * fait cliquer quand le lien circule dans un groupe de voisins.
 *
 * `alt` n'est pas exporté ici — il ne peut pas dépendre du paramètre de route.
 * Le texte alternatif est posé par `generateMetadata` de la page, qui connaît
 * la commune.
 */

export function generateStaticParams() {
  return PUBLISHED_COMMUNE_SLUGS.map((commune) => ({ commune }));
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
  const published = getPublishedCommune(slug);

  if (!published) {
    notFound();
  }

  const { commune, content } = published;

  return ogCard({
    overline: "Ménage à domicile",
    title: commune.name,
    subtitle:
      content.driveMinutesFromLeognan > 0
        ? `${commune.postalCode} · à ${content.driveMinutesFromLeognan} minutes de notre siège de Léognan.`
        : `${commune.postalCode} · notre commune siège.`,
  });
}
