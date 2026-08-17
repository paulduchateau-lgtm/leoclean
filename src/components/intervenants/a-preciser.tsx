/**
 * Marque une valeur que le porteur du projet n'a pas encore arbitrée.
 *
 * Elle n'apparaît que sur une page tenue hors de l'index par
 * `INTERVENANT_PAGE_READY` : elle sert à relire la structure, pas à être lue
 * par un candidat. Deux raisons de la rendre visible plutôt que de masquer le
 * bloc entier — on voit ce qui manque en ouvrant la page, et on ne peut pas
 * oublier qu'il manque quelque chose.
 *
 * Le libellé ne dit pas « TODO » : c'est un mot d'ingénieur, et si cette page
 * finissait par être vue, « à préciser » est au moins une phrase française.
 */
export function APreciser({ quoi }: { quoi: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-sm font-medium text-muted-foreground"
      title={`Valeur à arbitrer : ${quoi}`}
    >
      à préciser
    </span>
  );
}
