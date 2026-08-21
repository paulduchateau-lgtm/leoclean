"use client";

import { useRef, useState, useTransition } from "react";

import { IntervenantAvatar } from "@/components/intervenant-avatar";

/**
 * Le portrait du compte, client ou intervenant.
 *
 * **Il n'est jamais obligatoire.** Un avatar retombe sur les initiales partout
 * où il s'affiche, et exiger une photo pour réserver un ménage n'aurait aucun
 * sens. L'écran dit donc à quoi il sert — se reconnaître dans le fil — plutôt
 * que de le réclamer.
 *
 * Le champ de fichier est masqué derrière un bouton : le champ natif affiche
 * « Aucun fichier sélectionné » dans une langue qui n'est pas toujours la
 * nôtre, et sa zone de clic est trop petite pour un pouce.
 *
 * **Les deux actions sont reçues en propriété.** Un client et un intervenant
 * n'écrivent pas dans la même table et ne passent pas par la même vérification
 * d'accès : dupliquer l'écran aurait donné deux politiques qui divergent, et
 * c'est celui du client qui aurait fini par accepter ce que celui de
 * l'intervenant refuse. Une server action traverse la frontière serveur /
 * client, ce qu'une fonction ordinaire ne sait pas faire — c'est précisément ce
 * qui permet de les passer d'ici.
 */
export function PortraitField({
  nom,
  photoUrl: initiale,
  disponible,
  legende,
  enregistrer,
  retirer,
}: {
  nom: string;
  photoUrl: string | null;
  /** Le coffre est-il configuré ? Sans lui, on le dit au lieu d'échouer. */
  disponible: boolean;
  /** Ce que la photo change, dit à celui qui la dépose. */
  legende: string;
  enregistrer: (
    formData: FormData,
  ) => Promise<{ ok: true; url: string } | { ok: false; message: string }>;
  retirer: () => Promise<{ ok: true }>;
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
      const resultat = await enregistrer(formData);
      if (resultat.ok) setPhotoUrl(resultat.url);
      else setErreur(resultat.message);
    });
  };

  return (
    <section className="space-y-3">
      <p className="font-semibold">Votre photo</p>
      <p className="text-sm text-muted-foreground">{legende}</p>

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
                  await retirer();
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
