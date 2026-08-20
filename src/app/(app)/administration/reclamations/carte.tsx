"use client";

import { PhoneIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  cloreLaReclamation,
  prendreEnChargeLaReclamation,
} from "@/app/(app)/administration/reclamations/actions";
import { Button } from "@/components/ui/button";
import {
  LIBELLES_CATEGORIES,
  RESOLUTION_MINIMUM,
  type CategorieReclamation,
  type ReclamationVue,
} from "@/lib/reclamation/vocabulaire";

/**
 * Une réclamation, et les deux gestes qui la font avancer.
 *
 * L'origine est dite en tête — note basse ou démarche du client — parce qu'elle
 * change ce qu'on dit en décrochant : on ne rappelle pas de la même façon
 * quelqu'un qui a demandé quelque chose et quelqu'un à qui on écrit.
 */

const JOUR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

const TON_PRIORITE: Record<string, string> = {
  P0: "bg-destructive/10 text-destructive",
  P1: "bg-warning-bg text-warning-dark",
  P2: "bg-secondary text-muted-foreground",
  P3: "bg-secondary text-muted-foreground",
};

export function CarteReclamation({
  reclamation,
}: {
  reclamation: ReclamationVue;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [clotureOuverte, setClotureOuverte] = useState(false);

  const [jours] = useState(() =>
    Math.floor(
      (Date.now() - new Date(reclamation.ouverteLe).getTime()) / 86_400_000,
    ),
  );

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-semibold">
          {reclamation.client}
          {reclamation.commune ? (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {reclamation.commune}
            </span>
          ) : null}
        </p>
        <span className="flex items-center gap-2 text-sm">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              TON_PRIORITE[reclamation.priorite] ?? TON_PRIORITE.P2
            }`}
          >
            {reclamation.priorite}
          </span>
          <span className="font-mono text-muted-foreground tabular-nums">
            {jours} j
          </span>
        </span>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        {LIBELLES_CATEGORIES[reclamation.categorie as CategorieReclamation] ??
          reclamation.categorie}
        {reclamation.etoiles !== null ? ` · ${reclamation.etoiles}/5` : ""}
        {reclamation.intervenant ? ` · ${reclamation.intervenant}` : ""}
        {reclamation.quand
          ? ` · intervention du ${JOUR.format(new Date(reclamation.quand))}`
          : ""}
      </p>

      {/*
       * L'origine décide de la première phrase au téléphone. Elle est donc
       * dite avant le contenu, pas enfouie dans un badge.
       */}
      <p className="mt-2 text-sm">
        {reclamation.ouvertParLaNote
          ? "Ouverte par une note basse — la personne n'attend pas d'appel, elle sera surprise."
          : "Le client a fait la démarche — il attend une réponse."}
      </p>

      {reclamation.description ? (
        <p className="mt-2 rounded-lg bg-secondary/40 p-3 text-pretty">
          « {reclamation.description} »
        </p>
      ) : null}

      {erreur ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {erreur}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {reclamation.telephone ? (
          <a
            href={`tel:${reclamation.telephone.replace(/\s/g, "")}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            <PhoneIcon className="size-4" aria-hidden />
            Appeler
          </a>
        ) : null}

        {reclamation.statut === "OUVERTE" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setErreur(null);
                const resultat = await prendreEnChargeLaReclamation({
                  id: reclamation.id,
                });
                if (!resultat.ok) {
                  setErreur(resultat.error);
                  return;
                }
                router.refresh();
              })
            }
          >
            Je m&apos;en occupe
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">En cours</span>
        )}

        <button
          type="button"
          onClick={() => setClotureOuverte((etat) => !etat)}
          className="text-sm text-muted-foreground underline"
        >
          Clore
        </button>
      </div>

      {clotureOuverte ? (
        <div className="mt-3 space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
          <textarea
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            rows={3}
            placeholder="Ce qui a été décidé. Un classement sans suite se justifie autant qu'une résolution."
            className="w-full rounded-lg border border-input bg-background p-3 text-sm"
          />
          <div className="flex flex-wrap gap-3">
            {(["RESOLUE", "CLASSEE"] as const).map((statut) => (
              <Button
                key={statut}
                size="sm"
                variant="outline"
                disabled={
                  pending || resolution.trim().length < RESOLUTION_MINIMUM
                }
                onClick={() =>
                  startTransition(async () => {
                    setErreur(null);
                    const resultat = await cloreLaReclamation({
                      id: reclamation.id,
                      statut,
                      resolution,
                    });
                    if (!resultat.ok) {
                      setErreur(resultat.error);
                      return;
                    }
                    router.refresh();
                  })
                }
              >
                {statut === "RESOLUE" ? "Résolue" : "Classer sans suite"}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
