"use client";

import { CameraIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { deposerUnePhotoDeMission } from "@/app/(app)/intervenant/mission/actions";
import { PHOTOS_MAXIMUM_PAR_PHASE } from "@/lib/mission/rapport-photo";

/**
 * Le rapport photo, deux avant et deux après.
 *
 * **Rien n'est bloquant, et l'écran le dit.** Le rapport ne retient ni la fin
 * de mission ni le paiement : un produit qui empêche de travailler pour
 * protéger une mesure obtient des mesures fausses — quelqu'un photographierait
 * n'importe quoi pour finir sa journée.
 *
 * `capture="environment"` ouvre l'appareil photo arrière sur un téléphone, et
 * laisse le sélecteur de fichiers ailleurs. C'est un attribut de confort : le
 * navigateur reste libre de l'ignorer, et il le fait sur ordinateur.
 */

interface PhotoVue {
  id: string;
  phase: string;
  piece: string | null;
}

const PHASES = [
  { valeur: "AVANT" as const, titre: "Avant", aide: "L'état en arrivant." },
  {
    valeur: "APRES" as const,
    titre: "Après",
    aide: "Ce que vous laissez derrière vous.",
  },
];

export function PhotosDeMission({
  bookingId,
  photos,
  depotOuvert,
  telephone,
}: {
  bookingId: string;
  photos: PhotoVue[];
  depotOuvert: boolean;
  telephone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const entrees = useRef<Record<string, HTMLInputElement | null>>({});

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-5">
      <h2 className="font-heading text-lg font-semibold">Le rapport photo</h2>
      <p className="mt-1 text-sm text-pretty text-muted-foreground">
        Deux avant, deux après, si vous pouvez. Ce n&apos;est pas obligatoire et
        cela ne retient pas votre paiement — c&apos;est ce qui vous protège si
        un client conteste.
      </p>

      {!depotOuvert ? (
        <p className="mt-3 rounded-lg border border-warning-border bg-warning-bg p-3 text-sm text-warning-dark">
          Le dépôt de photos n&apos;est pas encore ouvert. Gardez-les sur votre
          téléphone, et appelez le {telephone} en cas de litige.
        </p>
      ) : null}

      {erreur ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {erreur}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {PHASES.map((phase) => {
          const siennes = photos.filter(
            (photo) => photo.phase === phase.valeur,
          );
          const pleine = siennes.length >= PHOTOS_MAXIMUM_PAR_PHASE;

          return (
            <div
              key={phase.valeur}
              className="rounded-lg border border-border p-4"
            >
              <p className="font-semibold">{phase.titre}</p>
              <p className="text-sm text-muted-foreground">{phase.aide}</p>

              <p className="mt-2 font-mono text-sm">
                {siennes.length} photo{siennes.length > 1 ? "s" : ""}
              </p>

              {depotOuvert && !pleine ? (
                <>
                  <input
                    ref={(element) => {
                      entrees.current[phase.valeur] = element;
                    }}
                    type="file"
                    accept="image/jpeg,image/png"
                    capture="environment"
                    className="sr-only"
                    onChange={(event) => {
                      const fichier = event.target.files?.[0];
                      if (!fichier) return;
                      const donnees = new FormData();
                      donnees.set("bookingId", bookingId);
                      donnees.set("phase", phase.valeur);
                      donnees.set("fichier", fichier);
                      setEnCours(phase.valeur);
                      startTransition(async () => {
                        setErreur(null);
                        const resultat =
                          await deposerUnePhotoDeMission(donnees);
                        setEnCours(null);
                        if (!resultat.ok) setErreur(resultat.error);
                        else router.refresh();
                      });
                    }}
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => entrees.current[phase.valeur]?.click()}
                    className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-border px-4 text-sm font-bold"
                  >
                    {enCours === phase.valeur ? (
                      <Loader2Icon
                        className="size-4 animate-spin"
                        aria-hidden
                      />
                    ) : (
                      <CameraIcon className="size-4" aria-hidden />
                    )}
                    Ajouter une photo
                  </button>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
