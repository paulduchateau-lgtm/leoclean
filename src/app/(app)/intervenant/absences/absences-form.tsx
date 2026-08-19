"use client";

import { Loader2Icon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  poserAbsence,
  retirerAbsence,
} from "@/app/(app)/intervenant/absences/actions";
import { Button } from "@/components/ui/button";
import {
  MESSAGES_ABSENCE,
  verifierAbsence,
} from "@/lib/availability/absences";
import { PAS_MINUTES, heureLisible } from "@/lib/availability/semaine";

/**
 * Déclaration d'une absence.
 *
 * Les mêmes règles qu'au serveur, par le même module : l'écran empêche de se
 * tromper, le serveur empêche de contourner. Le formulaire est volontairement
 * court — une absence se pose entre deux missions, sur un téléphone, et rien
 * n'y est obligatoire hormis les deux dates.
 */

const HEURES = Array.from(
  { length: (22 - 6) * (60 / PAS_MINUTES) + 1 },
  (_, index) => 6 * 60 + index * PAS_MINUTES,
);

/** « 2026-09-01 » et un nombre de minutes → l'instant, en heure française. */
function instantParis(jour: string, minute: number): Date {
  const [annee, mois, date] = jour.split("-").map(Number);
  if (!annee || !mois || !date) return new Date(Number.NaN);
  /*
   * L'aperçu côté navigateur se contente du fuseau de l'appareil : il sert à
   * dire « ces dates ne tiennent pas debout », pas à décider ce qui est écrit.
   * La conversion qui fait foi a lieu côté serveur, dans `time.ts`.
   */
  return new Date(annee, mois - 1, date, Math.floor(minute / 60), minute % 60);
}

function jourSuivant(jour: string): string {
  const [annee, mois, date] = jour.split("-").map(Number);
  const suivant = new Date(Date.UTC(annee!, mois! - 1, date! + 1));
  return suivant.toISOString().slice(0, 10);
}

export function AbsenceForm({
  existantes,
}: {
  existantes: readonly { debut: string; fin: string }[];
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();

  const [debutJour, setDebutJour] = useState("");
  const [finJour, setFinJour] = useState("");
  const [journeeEntiere, setJourneeEntiere] = useState(true);
  const [debutMinute, setDebutMinute] = useState(8 * 60);
  const [finMinute, setFinMinute] = useState(13 * 60);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const memeJour = debutJour !== "" && debutJour === finJour;
  const partielPossible = memeJour;

  function anomalie(): string | null {
    if (!debutJour || !finJour) {
      return "Indiquez une date de début et une date de fin.";
    }

    const entiere = journeeEntiere || !partielPossible;
    const debut = entiere
      ? instantParis(debutJour, 0)
      : instantParis(debutJour, debutMinute);
    const fin = entiere
      ? instantParis(jourSuivant(finJour), 0)
      : instantParis(finJour, finMinute);

    if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) {
      return "Ces dates ne sont pas lisibles.";
    }

    const code = verifierAbsence(
      { debut, fin },
      existantes.map((autre) => ({
        debut: new Date(autre.debut),
        fin: new Date(autre.fin),
      })),
      new Date(),
    );

    return code ? MESSAGES_ABSENCE[code] : null;
  }

  function envoyer() {
    const probleme = anomalie();
    if (probleme) {
      setErreur(probleme);
      return;
    }
    setErreur(null);

    const entiere = journeeEntiere || !partielPossible;

    demarrer(async () => {
      const resultat = await poserAbsence({
        debutJour,
        finJour,
        journeeEntiere: entiere,
        debutMinute: entiere ? undefined : debutMinute,
        finMinute: entiere ? undefined : finMinute,
        motif: motif.trim() ? motif.trim() : undefined,
      });

      if (!resultat.ok) {
        setErreur(resultat.error);
        return;
      }

      setDebutJour("");
      setFinJour("");
      setMotif("");
      setJourneeEntiere(true);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Du</span>
          <input
            type="date"
            value={debutJour}
            onChange={(event) => {
              setDebutJour(event.target.value);
              if (!finJour || finJour < event.target.value) {
                setFinJour(event.target.value);
              }
              setErreur(null);
            }}
            className="min-h-13 rounded-xl border border-input bg-background px-3 text-base"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Au (inclus)</span>
          <input
            type="date"
            value={finJour}
            min={debutJour || undefined}
            onChange={(event) => {
              setFinJour(event.target.value);
              setErreur(null);
            }}
            className="min-h-13 rounded-xl border border-input bg-background px-3 text-base"
          />
        </label>
      </div>

      {partielPossible ? (
        <label className="mt-4 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={journeeEntiere}
            onChange={(event) => {
              setJourneeEntiere(event.target.checked);
              setErreur(null);
            }}
            className="size-6 rounded-md border-input"
          />
          <span>Journée entière</span>
        </label>
      ) : null}

      {partielPossible && !journeeEntiere ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Heure de début</span>
            <select
              value={debutMinute}
              onChange={(event) => setDebutMinute(Number(event.target.value))}
              className="min-h-11 rounded-xl border border-input bg-background px-3 text-base"
            >
              {HEURES.map((minute) => (
                <option key={minute} value={minute}>
                  {heureLisible(minute)}
                </option>
              ))}
            </select>
          </label>
          <span aria-hidden="true" className="text-muted-foreground">
            →
          </span>
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Heure de fin</span>
            <select
              value={finMinute}
              onChange={(event) => setFinMinute(Number(event.target.value))}
              className="min-h-11 rounded-xl border border-input bg-background px-3 text-base"
            >
              {HEURES.map((minute) => (
                <option key={minute} value={minute}>
                  {heureLisible(minute)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <label className="mt-4 flex flex-col gap-1 text-sm">
        <span className="font-medium">
          Motif <span className="text-muted-foreground">(facultatif)</span>
        </span>
        <input
          type="text"
          value={motif}
          maxLength={200}
          placeholder="Vacances, formation, rendez-vous…"
          onChange={(event) => setMotif(event.target.value)}
          className="min-h-13 rounded-xl border border-input bg-background px-3 text-base"
        />
      </label>

      {erreur ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {erreur}
        </p>
      ) : null}

      <Button
        type="button"
        onClick={envoyer}
        disabled={enCours}
        className="mt-4 w-full sm:w-auto"
      >
        {enCours ? (
          <Loader2Icon className="animate-spin" aria-hidden="true" />
        ) : null}
        Déclarer cette absence
      </Button>
    </div>
  );
}

export function RetraitAbsence({ absenceId }: { absenceId: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            const resultat = await retirerAbsence({ absenceId });
            if (!resultat.ok) {
              setErreur(resultat.error);
              return;
            }
            router.refresh();
          })
        }
      >
        {enCours ? (
          <Loader2Icon className="animate-spin" aria-hidden="true" />
        ) : (
          <TrashIcon aria-hidden="true" />
        )}
        Retirer
      </Button>
      {erreur ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {erreur}
        </p>
      ) : null}
    </>
  );
}
