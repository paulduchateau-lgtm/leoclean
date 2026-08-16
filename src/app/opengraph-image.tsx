import { SITE_OG_CARD } from "@/lib/seo/metadata";
import { OG_CONTENT_TYPE, OG_SIZE, ogAlt, ogCard } from "@/lib/seo/og";
import { COMMUNES } from "@/lib/territory";

/**
 * Carte de partage par défaut.
 *
 * C'est celle que `pageMetadata()` renvoie à toute page qui n'a pas la sienne :
 * tarifs, à propos, conseils, index des communes, formulaire de rappel.
 */

export const alt = ogAlt(SITE_OG_CARD.title);
/**
 * L'image est un fichier, jamais une réponse calculée : elle ne dépend que du
 * contenu du dépôt. Le dire explicitement est en outre exigé par l'export
 * statique de la vitrine de démonstration, qui refuse de construire une route
 * de métadonnées dont le mode de rendu n'est pas tranché.
 */
export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogCard({
    overline: "Ménage à domicile",
    title: SITE_OG_CARD.title,
    subtitle: `${COMMUNES.length} communes, un intervenant attitré qui habite le secteur.`,
  });
}
