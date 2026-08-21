/**
 * L'écran d'attente des espaces connectés.
 *
 * **Trente-trois pages du dépôt sont en `force-dynamic` et aucune n'avait de
 * fallback.** La documentation de Next est explicite : sans `loading`, une
 * navigation vers une page dynamique reste sur l'écran précédent jusqu'à ce
 * que le serveur ait répondu — rien ne bouge, et on croit avoir mal cliqué.
 * C'est le premier remède, avant tout indicateur : il rend la transition
 * **immédiate** au lieu de la commenter.
 *
 * Une silhouette et non un tournoyeur : elle occupe la place que le contenu
 * prendra, si bien que l'arrivée des données ne déplace rien. Un tournoyeur
 * centré, lui, disparaît en laissant le contenu tomber d'un coup.
 *
 * `animate-pulse` seulement, jamais de mouvement horizontal : le scintillement
 * qui traverse un bloc coûte une animation composite sur chaque bloc, pour un
 * écran qui ne dure qu'une fraction de seconde.
 */
export default function Loading() {
  return (
    <main
      aria-busy
      aria-label="Chargement"
      className="mx-auto w-full max-w-2xl flex-1 px-6 py-10"
    >
      <div className="animate-pulse space-y-6">
        <div className="h-9 w-2/3 rounded-full bg-ink-100" />

        <div className="space-y-3">
          {[0, 1, 2].map((rang) => (
            <div
              key={rang}
              className="rounded-[var(--r-l)] border border-border-subtle p-5"
            >
              <div className="h-4 w-1/3 rounded-full bg-ink-100" />
              <div className="mt-3 h-3 w-3/4 rounded-full bg-ink-100" />
              <div className="mt-2 h-3 w-1/2 rounded-full bg-ink-100" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
