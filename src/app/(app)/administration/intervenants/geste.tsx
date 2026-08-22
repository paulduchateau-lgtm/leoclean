"use client";

import { useState, useTransition } from "react";

/**
 * Un geste d'administration qui exige un motif.
 *
 * **Le motif est saisi avant l'action, jamais après.** Une confirmation qui
 * demande « êtes-vous sûr ? » n'obtient qu'un réflexe ; un champ à remplir
 * oblige à formuler, et c'est ce qui sera relu — par l'intervenant pour la
 * suspension, par nous six mois plus tard pour tout le reste.
 *
 * Le champ n'apparaît qu'au clic : afficher quatre zones de texte sous chaque
 * ligne d'une file de trente comptes la rendrait illisible.
 */
export function GesteAvecMotif({
  libelle,
  invite,
  ton = "neutre",
  action,
}: {
  libelle: string;
  invite: string;
  ton?: "neutre" | "danger";
  action: (motif: string) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className={`inline-flex min-h-10 items-center rounded-full border-2 px-4 text-sm font-bold transition-colors ${
          ton === "danger"
            ? "border-destructive/50 text-destructive hover:bg-destructive/10"
            : "border-border bg-card hover:border-teal-300 hover:bg-teal-50"
        }`}
      >
        {libelle}
      </button>
    );
  }

  return (
    <div className="w-full rounded-[var(--r-m)] border border-border bg-card p-3">
      <label className="block text-sm font-medium">{invite}</label>
      <textarea
        rows={2}
        autoFocus
        value={motif}
        onChange={(event) => setMotif(event.target.value)}
        className="mt-1 w-full rounded-[var(--r-m)] border-2 border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-teal-600"
      />
      {erreur ? (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {erreur}
        </p>
      ) : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={pending || motif.trim().length < 10}
          onClick={() =>
            startTransition(async () => {
              setErreur(null);
              const resultat = await action(motif.trim());
              if (resultat.ok) {
                setOuvert(false);
                setMotif("");
              } else {
                setErreur(resultat.message ?? "Action refusée.");
              }
            })
          }
          className="inline-flex min-h-10 items-center rounded-full bg-ink-900 px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          Confirmer
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold text-muted-foreground"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
