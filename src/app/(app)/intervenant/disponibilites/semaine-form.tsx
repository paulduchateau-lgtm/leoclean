"use client";

import { Loader2Icon, PlusIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { enregistrerSemaine } from "@/app/(app)/intervenant/disponibilites/actions";
import { Button } from "@/components/ui/button";
import {
  JOURS,
  type Jour,
  MESSAGES,
  PAS_MINUTES,
  type Plage,
  heureLisible,
  totalHebdomadaireMinutes,
  verifierSemaine,
} from "@/lib/availability/semaine";

/**
 * Déclaration de la semaine type.
 *
 * Les mêmes règles qu'au serveur, appliquées par le même module : l'écran
 * empêche de se tromper, le serveur empêche de contourner. Rien n'est
 * enregistré tant que la semaine ne tient pas debout, et les anomalies sont
 * nommées jour par jour — corriger au hasard est ce qui décourage.
 */

/** Choix d'heures, du plus tôt au plus tard, par demi-heure. */
const HEURES = Array.from(
  { length: (22 - 6) * (60 / PAS_MINUTES) + 1 },
  (_, index) => 6 * 60 + index * PAS_MINUTES,
);

function Selecteur({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (minute: number) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-h-11 rounded-xl border border-input bg-card px-3 text-base"
      >
        {HEURES.map((minute) => (
          <option key={minute} value={minute}>
            {heureLisible(minute)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SemaineForm({ initiales }: { initiales: Plage[] }) {
  const router = useRouter();
  const [plages, setPlages] = useState<Plage[]>(initiales);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const anomalies = verifierSemaine(plages);
  const total = totalHebdomadaireMinutes(plages);

  function modifier(index: number, champ: keyof Plage, valeur: number) {
    setMessage(null);
    setPlages((actuelles) =>
      actuelles.map((plage, position) =>
        position === index ? { ...plage, [champ]: valeur } : plage,
      ),
    );
  }

  function ajouter(jour: Jour) {
    setMessage(null);
    setPlages((actuelles) => [
      ...actuelles,
      { jour, debutMinute: 9 * 60, finMinute: 17 * 60 },
    ]);
  }

  function retirer(index: number) {
    setMessage(null);
    setPlages((actuelles) =>
      actuelles.filter((_, position) => position !== index),
    );
  }

  function enregistrer() {
    setErreur(null);
    setMessage(null);
    startTransition(async () => {
      const resultat = await enregistrerSemaine({ plages });
      if (!resultat.ok) {
        setErreur(resultat.error);
        return;
      }
      setMessage("Vos horaires sont enregistrés.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {JOURS.map(({ valeur, nom }) => {
        const duJour = plages
          .map((plage, index) => ({ plage, index }))
          .filter(({ plage }) => plage.jour === valeur);
        const anomaliesDuJour = anomalies.filter(
          (anomalie) => anomalie.jour === valeur,
        );

        return (
          <section
            key={valeur}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium">{nom}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => ajouter(valeur)}
                aria-label={`Ajouter une plage le ${nom.toLowerCase()}`}
              >
                <PlusIcon aria-hidden />
                Ajouter
              </Button>
            </div>

            {duJour.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Vous ne travaillez pas ce jour-là.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {duJour.map(({ plage, index }) => (
                  <li key={index} className="flex flex-wrap items-center gap-2">
                    <Selecteur
                      label={`Début de la plage du ${nom.toLowerCase()}`}
                      value={plage.debutMinute}
                      onChange={(minute) =>
                        modifier(index, "debutMinute", minute)
                      }
                    />
                    <span className="text-muted-foreground">à</span>
                    <Selecteur
                      label={`Fin de la plage du ${nom.toLowerCase()}`}
                      value={plage.finMinute}
                      onChange={(minute) =>
                        modifier(index, "finMinute", minute)
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => retirer(index)}
                      aria-label={`Retirer cette plage du ${nom.toLowerCase()}`}
                    >
                      <TrashIcon aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {anomaliesDuJour.map((anomalie) => (
              <p
                key={anomalie.erreur}
                role="alert"
                className="mt-3 text-sm text-destructive"
              >
                {MESSAGES[anomalie.erreur]}
              </p>
            ))}
          </section>
        );
      })}

      <div className="sticky bottom-0 -mx-6 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? "Aucune heure déclarée : vous ne recevrez aucune proposition."
            : `${heureLisible(total)} déclarées par semaine.`}
        </p>

        {erreur ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {erreur}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="mt-2 text-sm text-primary">
            {message}
          </p>
        ) : null}

        <Button
          size="lg"
          className="mt-3 w-full"
          disabled={pending || anomalies.length > 0}
          onClick={enregistrer}
        >
          {pending ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : null}
          Enregistrer mes horaires
        </Button>
      </div>
    </div>
  );
}
