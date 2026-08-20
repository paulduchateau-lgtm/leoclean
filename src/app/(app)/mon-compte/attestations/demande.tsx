"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { demanderMonAttestation } from "@/app/(app)/mon-compte/attestations/actions";
import { Button } from "@/components/ui/button";

/**
 * Demander l'attestation d'une année close.
 *
 * **Seules les années terminées sont proposées.** Une attestation d'année en
 * cours serait jointe à une déclaration et deviendrait fausse à la prestation
 * suivante — `attestation.ts` la refuse, et l'écran ne la propose donc pas.
 */

export function Demande({
  annees,
  dejaEmises,
}: {
  annees: number[];
  dejaEmises: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  if (annees.length === 0) {
    return (
      <p className="mt-6 rounded-2xl border border-border bg-secondary/40 p-6 text-pretty text-muted-foreground">
        {dejaEmises
          ? "Vos attestations disponibles sont ci-dessus. Celle de l'année en cours sera établie début janvier."
          : "Rien à attester pour l'instant. Une attestation porte sur une année terminée : la vôtre sera disponible début janvier."}
      </p>
    );
  }

  return (
    <div className="mt-8">
      {erreur ? (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {erreur}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {annees.map((annee) => (
          <Button
            key={annee}
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setErreur(null);
                const resultat = await demanderMonAttestation({ annee });
                if (!resultat.ok) {
                  setErreur(resultat.error);
                  return;
                }
                router.refresh();
              })
            }
          >
            {pending ? (
              <Loader2Icon className="animate-spin" aria-hidden />
            ) : null}
            Établir mon attestation {annee}
          </Button>
        ))}
      </div>
    </div>
  );
}
