import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";
import { COMMUNES } from "@/lib/territory";

/**
 * Manifeste d'application.
 *
 * Ce qu'il change n'est pas technique : une icône sur l'écran d'accueil est un
 * rappel permanent, là où un favori dans un navigateur n'est jamais rouvert.
 * Pour un service qu'on emploie une fois par semaine, c'est la différence
 * entre un client qui revient et un client qui recherche « ménage Léognan » et
 * tombe sur quelqu'un d'autre.
 *
 * `display: standalone` retire la barre d'adresse : l'application occupe
 * l'écran, et la navigation est celle de la coque — barre d'onglets, retour
 * gestuel. C'est cohérent avec ce que la phase 2 a posé, et incohérent avec
 * l'idée d'un site vitrine.
 *
 * Les icônes sont des fichiers versionnés dans `public/`, produits par
 * `scripts/generer-icones.jsx` depuis le symbole du design system : un
 * manifeste doit pointer vers des chemins stables, pas vers des routes au nom
 * haché.
 */
/**
 * Le manifeste ne dépend que du dépôt : c'est un fichier, jamais une réponse
 * calculée. Le dire est en outre exigé par l'export statique de la vitrine de
 * démonstration, qui refuse une route de métadonnées au mode de rendu non
 * tranché.
 */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} — ménage à domicile au sud de Bordeaux`,
    short_name: SITE.name,
    description: SITE.description,
    lang: "fr-FR",
    start_url: "/",
    // Le périmètre s'arrête à la vitrine et au tunnel : les espaces connectés
    // vivent sur l'autre domaine, et une application qui redirigerait vers un
    // navigateur externe à la première connexion serait pire qu'aucune.
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // ink-950 pour la barre système, ink-0 pour l'écran de démarrage : les
    // mêmes valeurs que `themeColor` du gabarit racine.
    theme_color: "#0B1B16",
    background_color: "#FFFFFF",
    categories: ["lifestyle", "productivity"],
    icons: [
      {
        src: "/icone-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icone-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      /*
       * Variantes masquables, au symbole plus resserré : Android découpe
       * jusqu'à 20 % de chaque bord pour l'ajuster à la forme du lanceur, et
       * une icône cadrée au plus juste s'y ferait rogner les pointes.
       */
      {
        src: "/icone-192-masquable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icone-512-masquable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Réserver un ménage",
        url: "/reserver",
      },
      {
        name: `Les ${COMMUNES.length} communes desservies`,
        url: "/zones-desservies",
      },
    ],
  };
}
