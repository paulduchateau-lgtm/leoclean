"use client";

import { CreditCardIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  enregistrerUneCarte,
  retirerUneCarte,
} from "@/app/(app)/mon-espace/paiement/actions";
import { Button } from "@/components/ui/button";

/**
 * Les cartes enregistrées, et les deux gestes possibles.
 *
 * La marque et les quatre derniers chiffres suffisent à reconnaître sa carte —
 * afficher davantage n'aiderait personne et donnerait à lire ce qu'on a promis
 * de ne pas détenir.
 */

interface Moyen {
  id: string;
  marque: string;
  quatreDerniers: string;
  expireLe: string;
}

const MARQUES: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
};

export function Cartes({ moyens }: { moyens: Moyen[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div className="mt-6">
      {moyens.length === 0 ? (
        <p className="rounded-2xl border border-border bg-secondary/40 p-6 text-muted-foreground">
          Aucune carte enregistrée.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {moyens.map((moyen) => (
            <li
              key={moyen.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <span className="flex items-center gap-3">
                <CreditCardIcon
                  className="size-5 text-muted-foreground"
                  aria-hidden
                />
                <span>
                  <span className="block font-medium">
                    {MARQUES[moyen.marque] ?? moyen.marque} ····{" "}
                    {moyen.quatreDerniers}
                  </span>
                  <span className="block font-mono text-sm text-muted-foreground">
                    expire {moyen.expireLe}
                  </span>
                </span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setErreur(null);
                    const resultat = await retirerUneCarte({
                      moyenId: moyen.id,
                    });
                    if (!resultat.ok) {
                      setErreur(resultat.error);
                      return;
                    }
                    router.refresh();
                  })
                }
                className="text-sm text-muted-foreground underline"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      {erreur ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {erreur}
        </p>
      ) : null}

      <Button
        size="lg"
        className="mt-6"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setErreur(null);
            const resultat = await enregistrerUneCarte({});
            if (!resultat.ok) {
              setErreur(resultat.error);
              return;
            }
            /*
             * On quitte le site : la saisie a lieu chez Stripe. `assign` plutôt
             * que le routeur, qui ne connaît que nos propres routes.
             */
            window.location.assign(resultat.data.url);
          })
        }
      >
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
        {moyens.length === 0 ? "Enregistrer ma carte" : "Ajouter une carte"}
      </Button>
    </div>
  );
}
