"use client";

import { Loader2Icon, PlusIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { enregistrerSemaine } from "@/app/(app)/intervenant/disponibilites/actions";
import { Button } from "@/components/ui/button";
import { PlageSlider } from "@/components/espace-pro/plage-slider";
import { majorationDuJourSemaine } from "@/lib/pricing/majorations";
import {
  JOURS,
  type Jour,
  MESSAGES,
  PAS_MINUTES,
  PLAGE_MINIMALE_MINUTES,
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
 *
 * **Les jours majorés se voient sur le jour qu'ils majorent.** Samedi et
 * dimanche rapportent davantage, et c'est à l'intervenant que va cette
 * majoration-là — pas à la plateforme. La taire ferait décider d'un week-end
 * sans savoir ce qu'il vaut, et découvrir l'écart sur un relevé de versements
 * est la façon la plus sûre de faire douter du reste. Le taux vient de la
 * grille, jamais d'un libellé recopié.
 */

/**
 * Bornes du rail, en minutes depuis minuit.
 *
 * 6 h – 22 h : au-delà, les créneaux proposés au client n'existent pas, et un
 * rail qui court sur vingt-quatre heures rend chaque demi-heure imprécise à
 * régler au doigt.
 */
const RAIL_MIN = 6 * 60;
const RAIL_MAX = 22 * 60;

export function SemaineForm({ initiales }: { initiales: Plage[] }) {
  const router = useRouter();
  const [plages, setPlages] = useState<Plage[]>(initiales);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const anomalies = verifierSemaine(plages);
  const total = totalHebdomadaireMinutes(plages);

  /*
   * Les deux bornes bougent ensemble.
   *
   * Le curseur les rend indissociables : pousser le début au-delà de la fin
   * est un geste que le rail permet, et l'écrêter dans le composant plutôt
   * qu'ici produirait un état intermédiaire invalide le temps d'un rendu.
   */
  function modifierLa(index: number, debutMinute: number, finMinute: number) {
    setMessage(null);
    setPlages((actuelles) =>
      actuelles.map((plage, position) =>
        position === index ? { ...plage, debutMinute, finMinute } : plage,
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
        const majoration = majorationDuJourSemaine(valeur);

        return (
          <section
            key={valeur}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex flex-wrap items-baseline gap-2 font-medium">
                {nom}
                {majoration ? (
                  <span className="rounded-full bg-pineapple-200 px-2 py-0.5 font-mono text-xs font-bold text-ink-900">
                    +{majoration.rateBp / 100} % pour vous
                  </span>
                ) : null}
              </h3>
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
              <ul className="mt-3 space-y-4">
                {duJour.map(({ plage, index }) => (
                  <li key={index}>
                    <div className="flex items-center justify-between gap-3">
                      {/* L'heure se lit au-dessus du rail, pas dans une
                          infobulle : c'est la valeur qu'on règle, et elle doit
                          être visible pendant qu'on la règle. */}
                      <p className="font-mono text-base font-bold">
                        {heureLisible(plage.debutMinute)} –{" "}
                        {heureLisible(plage.finMinute)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => retirer(index)}
                        aria-label={`Retirer cette plage du ${nom.toLowerCase()}`}
                      >
                        <TrashIcon aria-hidden />
                      </Button>
                    </div>
                    <PlageSlider
                      nomDuJour={nom}
                      min={RAIL_MIN}
                      max={RAIL_MAX}
                      pas={PAS_MINUTES}
                      minimum={PLAGE_MINIMALE_MINUTES}
                      debutMinute={plage.debutMinute}
                      finMinute={plage.finMinute}
                      onChange={(debut, fin) => modifierLa(index, debut, fin)}
                    />
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

      {/* Un férié ne se range pas dans une colonne : il tombe n'importe quel
          jour de la semaine, et son taux est celui du dimanche. Le dire à part
          vaut mieux que de le laisser découvrir un 15 août. */}
      <p className="rounded-[var(--r-l)] bg-pineapple-100 px-4 py-3 text-sm text-pretty">
        Les jours fériés sont majorés comme un dimanche, quel que soit le jour
        de la semaine où ils tombent.
      </p>

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
          <p role="status" className="mt-2 text-sm text-brand">
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
