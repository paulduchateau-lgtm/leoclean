"use client";

import { Loader2Icon, PauseIcon, PlayIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  mettreMonAbonnementEnPause,
  reprendreMonAbonnement,
  resilierMonAbonnement,
} from "@/app/(app)/mon-espace/abonnement/actions";
import { Button } from "@/components/ui/button";
import {
  LIBELLES_RESILIATION,
  MOTIFS_RESILIATION,
  PAUSE_MAXIMALE_SEMAINES,
  type MotifResiliation,
} from "@/lib/abonnement/recurrence";

/**
 * Un abonnement, et les trois gestes qu'on peut lui appliquer.
 *
 * L'ordre à l'écran est délibéré : **la pause d'abord, en plein**, la
 * résiliation ensuite, discrète mais atteignable en un geste. On ne cache pas
 * la sortie, on met en avant l'issue qui rend service aux deux parties.
 */

interface Abonnement {
  id: string;
  statut: string;
  enPauseJusquA: string | null;
  intervenantAttitre: string | null;
  prochainesDates: string[];
  frequenceLisible: string;
  jourLisible: string;
  heureLisible: string;
  dureeLisible: string;
}

const DATE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

/** Les propositions faites une fois, sans insister. */
const PROPOSITIONS: Record<string, string> = {
  FREQUENCE_MOINDRE:
    "Espacer les passages coûte moins cher qu'arrêter : un ménage toutes les deux semaines revient à la moitié du budget. Voulez-vous qu'on en parle ?",
  AUTRE_INTERVENANT:
    "Changer d'intervenant est possible sans changer d'abonnement. Dites-le-nous et on s'en occupe pour le prochain passage.",
  PAUSE:
    "Une pause garde votre créneau et votre intervenant. Vous reprenez quand vous voulez, sans rien refaire.",
};

export function CarteAbonnement({ abonnement }: { abonnement: Abonnement }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [pauseOuverte, setPauseOuverte] = useState(false);
  const [resiliationOuverte, setResiliationOuverte] = useState(false);
  const [motif, setMotif] = useState<MotifResiliation | null>(null);
  const [proposition, setProposition] = useState<string | null>(null);
  const [resiliee, setResiliee] = useState(false);
  const [debutPause, setDebutPause] = useState("");
  const [finPause, setFinPause] = useState("");

  const enPause = abonnement.statut === "PAUSED";

  if (resiliee) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-border bg-secondary/40 p-6"
      >
        <p className="font-semibold">
          C&apos;est fait, votre abonnement est arrêté.
        </p>
        <p className="mt-2 text-muted-foreground">
          Les rendez-vous déjà pris restent au calendrier — nous cessons
          simplement d&apos;en créer de nouveaux. Vous pouvez les annuler
          séparément si vous le souhaitez.
        </p>
        {proposition ? (
          <p className="mt-3 text-muted-foreground">
            {PROPOSITIONS[proposition]}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-6">
      <p className="font-heading text-xl font-extrabold">
        {abonnement.frequenceLisible}, le {abonnement.jourLisible.toLowerCase()}{" "}
        à {abonnement.heureLisible}
      </p>
      <p className="mt-1 text-muted-foreground">
        {abonnement.dureeLisible} par passage
        {abonnement.intervenantAttitre
          ? ` · ${abonnement.intervenantAttitre} en priorité`
          : ""}
      </p>

      {enPause ? (
        <p className="mt-4 rounded-xl border border-warning-border bg-warning-bg p-4 text-sm text-warning-dark">
          En pause
          {abonnement.enPauseJusquA
            ? ` jusqu'au ${DATE.format(new Date(abonnement.enPauseJusquA))}`
            : ""}
          . Aucun passage n&apos;est créé pendant ce temps.
        </p>
      ) : abonnement.prochainesDates.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-medium">Prochains passages</p>
          <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
            {abonnement.prochainesDates.map((date) => (
              <li key={date} className="first-letter:uppercase">
                {DATE.format(new Date(date))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {erreur ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {erreur}
        </p>
      ) : null}

      {/* --- La pause, en plein --- */}
      {pauseOuverte ? (
        <div className="mt-5 space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
          <p className="text-sm font-medium">De quand à quand ?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>Du</span>
              <input
                type="date"
                value={debutPause}
                onChange={(event) => {
                  setDebutPause(event.target.value);
                  if (!finPause || finPause < event.target.value) {
                    setFinPause(event.target.value);
                  }
                }}
                className="min-h-13 rounded-xl border border-input bg-background px-3 text-base"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Au (inclus)</span>
              <input
                type="date"
                value={finPause}
                min={debutPause || undefined}
                onChange={(event) => setFinPause(event.target.value)}
                className="min-h-13 rounded-xl border border-input bg-background px-3 text-base"
              />
            </label>
          </div>
          {/*
           * L'information est honnête plutôt que rassurante : promettre de
           * retrouver le même intervenant après huit semaines serait une
           * promesse qu'on ne tient pas.
           */}
          <p className="text-sm text-muted-foreground">
            Jusqu&apos;à {PAUSE_MAXIMALE_SEMAINES} semaines.{" "}
            {abonnement.intervenantAttitre
              ? `${abonnement.intervenantAttitre} pourra être réaffecté pendant votre pause ; on fait au mieux pour le retrouver.`
              : "Votre intervenant pourra être réaffecté pendant ce temps."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={pending || !debutPause || !finPause}
              onClick={() =>
                startTransition(async () => {
                  setErreur(null);
                  const resultat = await mettreMonAbonnementEnPause({
                    subscriptionId: abonnement.id,
                    debutJour: debutPause,
                    finJour: finPause,
                  });
                  if (!resultat.ok) {
                    setErreur(resultat.error);
                    return;
                  }
                  setPauseOuverte(false);
                  router.refresh();
                })
              }
            >
              {pending ? (
                <Loader2Icon className="animate-spin" aria-hidden />
              ) : null}
              Mettre en pause
            </Button>
            <Button variant="ghost" onClick={() => setPauseOuverte(false)}>
              Revenir
            </Button>
          </div>
        </div>
      ) : resiliationOuverte ? (
        <div className="mt-5 space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
          <p className="text-sm font-medium">
            Qu&apos;est-ce qui vous fait arrêter ?
          </p>
          <div className="flex flex-col gap-2">
            {MOTIFS_RESILIATION.map((valeur) => (
              <button
                key={valeur}
                type="button"
                aria-pressed={motif === valeur}
                onClick={() => setMotif(valeur)}
                className={`min-h-12 rounded-xl border px-4 text-left text-base ${
                  motif === valeur
                    ? "border-brand bg-brand text-ink-950"
                    : "border-input bg-background"
                }`}
              >
                {LIBELLES_RESILIATION[valeur]}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Aucun appel n&apos;est nécessaire, aucun préavis ne s&apos;applique.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={pending || !motif}
              onClick={() =>
                startTransition(async () => {
                  setErreur(null);
                  const resultat = await resilierMonAbonnement({
                    subscriptionId: abonnement.id,
                    motif: motif!,
                  });
                  if (!resultat.ok) {
                    setErreur(resultat.error);
                    return;
                  }
                  setProposition(resultat.data.proposition);
                  setResiliee(true);
                })
              }
            >
              {pending ? (
                <Loader2Icon className="animate-spin" aria-hidden />
              ) : null}
              Confirmer l&apos;arrêt
            </Button>
            <Button
              variant="ghost"
              onClick={() => setResiliationOuverte(false)}
            >
              Revenir
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {enPause ? (
            <Button
              size="lg"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setErreur(null);
                  const resultat = await reprendreMonAbonnement({
                    subscriptionId: abonnement.id,
                  });
                  if (!resultat.ok) {
                    setErreur(resultat.error);
                    return;
                  }
                  router.refresh();
                })
              }
            >
              <PlayIcon aria-hidden />
              Reprendre mes ménages
            </Button>
          ) : (
            <Button
              size="lg"
              variant="outline"
              onClick={() => setPauseOuverte(true)}
            >
              <PauseIcon aria-hidden />
              Mettre en pause
            </Button>
          )}

          {/*
           * La sortie n'est pas cachée : un lien discret mais atteignable en
           * un geste. Un parcours de résiliation qu'on n'atteint pas se
           * termine par un appel à sa banque, ce qui coûte davantage.
           */}
          <button
            type="button"
            onClick={() => setResiliationOuverte(true)}
            className="text-sm text-muted-foreground underline"
          >
            Arrêter mon abonnement
          </button>
        </div>
      )}
    </article>
  );
}
