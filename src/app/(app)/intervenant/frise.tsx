import { ArrowDownIcon, CarFrontIcon } from "lucide-react";

import type { EtapeVue, InsertionVue } from "@/lib/assignments/types";

/**
 * La journée telle qu'elle se déroulera, proposition comprise.
 *
 * L'intervenant ne juge pas un créneau, il juge une journée : ce qui le
 * précède, ce qui le suit, et la route entre les deux. Une mission de trois
 * heures qui laisse deux heures mortes au milieu de l'après-midi ne se refuse
 * pas pour la même raison qu'une mission trop serrée, et sans cette frise
 * aucune des deux ne se voit.
 */

const heure = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const jour = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

/** « 1 h 30 », « 45 min » — une durée se lit, elle ne se calcule pas. */
function dureeLisible(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste === 0 ? `${heures} h` : `${heures} h ${reste}`;
}

function Trajet({ minutes }: { minutes: number }) {
  return (
    <li className="flex items-center gap-2 py-1 pl-3 text-sm text-muted-foreground">
      <CarFrontIcon className="size-4 shrink-0" aria-hidden />
      {minutes} min de route
    </li>
  );
}

function Attente({ minutes }: { minutes: number }) {
  return (
    <li className="flex items-center gap-2 py-1 pl-3 text-sm text-muted-foreground">
      <ArrowDownIcon className="size-4 shrink-0" aria-hidden />
      {dureeLisible(minutes)} sans mission
    </li>
  );
}

function Etape({ etape }: { etape: EtapeVue }) {
  const debut = new Date(etape.debut);
  const fin = new Date(etape.fin);

  return (
    <li
      className={`rounded-xl border p-3 ${
        etape.estLaProposition
          ? "border-primary bg-primary/5"
          : "border-border bg-card"
      }`}
    >
      <p className="font-medium tabular-nums">
        {heure.format(debut)} – {heure.format(fin)}
        <span className="ml-2 font-normal text-muted-foreground">
          {etape.communeName}
        </span>
      </p>
      {etape.estLaProposition ? (
        <p className="mt-0.5 text-sm text-brand">La mission proposée</p>
      ) : (
        <p className="mt-0.5 text-sm text-muted-foreground">Déjà acceptée</p>
      )}
    </li>
  );
}

export function Frise({ insertion }: { insertion: InsertionVue }) {
  const premiere = insertion.journee[0];
  if (!premiere) return null;

  const elements: React.ReactNode[] = [];
  insertion.journee.forEach((etape, index) => {
    const precedente = insertion.journee[index - 1];
    if (precedente) {
      /*
       * Le creux se mesure entre la fin du bloc précédent et le début de
       * celui-ci : les blocs incluent déjà la route, donc ce qui reste est du
       * temps réellement mort. On affiche la route séparément, parce qu'elle
       * est subie et le creux non.
       */
      const creux = Math.round(
        (new Date(etape.blocDebut).getTime() -
          new Date(precedente.blocFin).getTime()) /
          60_000,
      );
      if (creux > 0) {
        elements.push(
          <Attente key={`attente-${etape.assignmentId}`} minutes={creux} />,
        );
      }
    }
    if (etape.trajetAvantMinutes > 0) {
      elements.push(
        <Trajet
          key={`route-${etape.assignmentId}`}
          minutes={etape.trajetAvantMinutes}
        />,
      );
    }
    elements.push(<Etape key={etape.assignmentId} etape={etape} />);
  });

  return (
    <div>
      <p className="text-sm font-medium first-letter:uppercase">
        {jour.format(new Date(premiere.debut))}
      </p>
      <ul className="mt-3 space-y-1">{elements}</ul>
    </div>
  );
}
