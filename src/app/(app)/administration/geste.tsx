"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  relancerUneProposition,
  relancerUneRecherche,
  traiterUnRappel,
} from "@/app/(app)/administration/actions";

/**
 * Un geste d'exploitation, avec son résultat affiché sur place.
 *
 * **Le résultat reste sous le bouton**, il ne disparaît pas dans un
 * rafraîchissement. « Personne n'est disponible, même en relançant » est une
 * information qui change le travail suivant : elle doit rester lisible le temps
 * qu'on décroche le téléphone.
 */

type Geste =
  | { type: "recherche"; bookingId: string }
  | { type: "proposition"; assignmentId: string }
  | { type: "rappel"; leadId: string };

const LIBELLES: Record<Geste["type"], string> = {
  recherche: "Relancer la recherche",
  proposition: "Clore et reproposer",
  rappel: "Marquer rappelé",
};

export function Geste({ geste }: { geste: Geste }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resultat, setResultat] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  if (resultat) {
    return (
      <p
        role="status"
        className={`mt-3 text-sm text-pretty ${
          resultat.ok ? "text-brand" : "text-warning-dark"
        }`}
      >
        {resultat.message}
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const reponse =
            geste.type === "recherche"
              ? await relancerUneRecherche({ bookingId: geste.bookingId })
              : geste.type === "proposition"
                ? await relancerUneProposition({
                    assignmentId: geste.assignmentId,
                  })
                : await traiterUnRappel({ leadId: geste.leadId });

          if (!reponse.ok) {
            setResultat({ ok: false, message: reponse.error });
            return;
          }

          setResultat({
            ok: true,
            message:
              "message" in reponse.data ? reponse.data.message : "C'est noté.",
          });
          router.refresh();
        })
      }
      className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-border bg-card px-4 text-sm font-bold"
    >
      {pending ? (
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
      ) : null}
      {LIBELLES[geste.type]}
    </button>
  );
}
