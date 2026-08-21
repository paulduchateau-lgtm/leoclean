"use client";

import { useRef, useState, useTransition } from "react";

import {
  enregistrerMonPortrait,
  retirerMonPortrait,
} from "@/app/(app)/mon-compte/informations/actions";
import { IntervenantAvatar } from "@/components/intervenant-avatar";

/**
 * Le portrait du compte.
 *
 * **Il n'est jamais obligatoire.** Un avatar retombe sur les initiales partout
 * où il s'affiche, et exiger une photo pour réserver un ménage n'aurait aucun
 * sens. L'écran dit donc à quoi il sert — se reconnaître dans le fil — plutôt
 * que de le réclamer.
 *
 * Le champ de fichier est masqué derrière un bouton : le champ natif affiche
 * « Aucun fichier sélectionné » dans une langue qui n'est pas toujours la
 * nôtre, et sa zone de clic est trop petite pour un pouce.
 */
export function Portrait({
  nom,
  photoUrl: initiale,
  disponible,
}: {
  nom: string;
  photoUrl: string | null;
  /** Le coffre est-il configuré ? Sans lui, on le dit au lieu d'échouer. */
  disponible: boolean;
}) {
  const [photoUrl, setPhotoUrl] = useState(initiale);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const champ = useRef<HTMLInputElement | null>(null);

  const envoyer = (fichier: File) => {
    setErreur(null);
    const formData = new FormData();
    formData.append("portrait", fichier);

    startTransition(async () => {
      const resultat = await enregistrerMonPortrait(formData);
      if (resultat.ok) setPhotoUrl(resultat.url);
      else setErreur(resultat.message);
    });
  };

  return (
    <section className="space-y-3">
      <p className="font-semibold">Votre photo</p>
      <p className="text-sm text-muted-foreground">
        Elle apparaît dans vos conversations, pour que votre intervenant sache à
        qui il écrit. Elle n&apos;est pas obligatoire.
      </p>

      <div className="flex items-center gap-4">
        <IntervenantAvatar nom={nom} photoUrl={photoUrl} taille={64} />

        <div className="flex flex-wrap gap-2">
          <input
            ref={champ}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const fichier = event.target.files?.[0];
              if (fichier) envoyer(fichier);
              // Remis à zéro : sans cela, redéposer le même fichier après une
              // erreur ne déclencherait aucun changement.
              event.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={!disponible || pending}
            onClick={() => champ.current?.click()}
            className="inline-flex min-h-11 items-center rounded-full border-2 border-border bg-card px-5 text-sm font-bold transition-colors hover:border-teal-300 hover:bg-teal-50 disabled:opacity-50"
          >
            {pending
              ? "Envoi…"
              : photoUrl
                ? "Changer la photo"
                : "Ajouter une photo"}
          </button>

          {photoUrl ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await retirerMonPortrait();
                  setPhotoUrl(null);
                })
              }
              className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-brand hover:underline"
            >
              Retirer
            </button>
          ) : null}
        </div>
      </div>

      {!disponible ? (
        <p className="text-sm text-muted-foreground">
          Le dépôt de photo n&apos;est pas encore ouvert.
        </p>
      ) : null}

      {erreur ? (
        <p role="alert" className="text-sm text-destructive">
          {erreur}
        </p>
      ) : null}
    </section>
  );
}
