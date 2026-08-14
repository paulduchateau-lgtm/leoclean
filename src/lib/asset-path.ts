/**
 * Préfixe des fichiers servis depuis `public/`.
 *
 * Next.js applique `basePath` aux liens et aux images optimisées, mais pas au
 * `src` d'une image déclarée `unoptimized` — et l'export statique impose
 * précisément ce mode. Sans ce préfixe, le logotype d'une vitrine servie depuis
 * `<compte>.github.io/<dépôt>/` irait chercher son fichier à la racine du
 * domaine, où il n'est pas.
 *
 * La valeur est lue depuis `NEXT_PUBLIC_BASE_PATH`, littéralement pour que
 * Next l'inline dans le bundle client ; elle vaut la chaîne vide en
 * production, où le site est servi à la racine.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function assetPath(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
