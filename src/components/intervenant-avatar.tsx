/**
 * Le visage de l'intervenant, ou ses initiales.
 *
 * **La photo est facultative et le restera** : `CleanerProfile.photoUrl` est
 * nullable, et exiger une photo pour travailler ajouterait une condition
 * d'entrée que rien ne justifie. Le repli n'est donc pas un cas dégradé mais le
 * cas courant, et il doit être aussi soigné que la photo.
 *
 * Les initiales sont tirées du nom affiché, jamais du nom complet stocké : le
 * dépôt ne publie pas le nom de famille d'un intervenant.
 */
export function IntervenantAvatar({
  nom,
  photoUrl,
  taille = 44,
}: {
  nom: string;
  photoUrl?: string | null;
  taille?: number;
}) {
  const initiales = nom
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((mot) => mot[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-100 font-bold text-teal-800"
      style={{ width: taille, height: taille, fontSize: taille * 0.34 }}
    >
      {photoUrl ? (
        /*
         * `img` et non `next/image` : l'URL vient d'une colonne, donc d'un
         * domaine qu'on ne connaît pas à la construction — `next/image` exige
         * une liste d'hôtes autorisés, et l'oubli d'un hôte casse l'affichage
         * au lieu de le dégrader.
         */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          width={taille}
          height={taille}
          className="size-full object-cover"
        />
      ) : (
        initiales
      )}
    </span>
  );
}
