"use client";

import { AlertTriangleIcon, CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Frise } from "@/app/(app)/intervenant/frise";
import {
  accepterMission,
  refuserMission,
} from "@/app/(app)/intervenant/actions";
import { Button } from "@/components/ui/button";
import type { MissionProposee } from "@/lib/assignments/types";
import { formatEuros } from "@/lib/pricing";

/**
 * Une mission proposée, avec les deux seules réponses possibles.
 *
 * L'adresse n'y figure pas : la commune, la voie sans numéro et le temps de
 * trajet suffisent à juger, et le client n'a pas consenti à ce que son adresse
 * circule chez quelqu'un qui refusera peut-être. Elle apparaît à l'acceptation.
 */

const jourHeure = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

function dureeLisible(minutes: number): string {
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  if (heures === 0) return `${reste} min`;
  return reste === 0 ? `${heures} h` : `${heures} h ${reste}`;
}

/** Ce qui mérite d'être signalé avant de répondre. */
function Avertissements({ mission }: { mission: MissionProposee }) {
  const { insertion } = mission;
  const messages: string[] = [];

  if (insertion.estIsolee) {
    messages.push(
      "Seule mission de la journée : l'aller-retour ne sera pas partagé avec une autre.",
    );
  }
  if (insertion.estSerree) {
    messages.push(
      "Enchaînement serré : les temps de route se touchent, sans marge pour un imprévu.",
    );
  }
  if (insertion.tempsMortMinutes >= 60) {
    messages.push(
      `${dureeLisible(insertion.tempsMortMinutes)} d'attente entre deux missions ce jour-là.`,
    );
  }
  if (insertion.chevauche) {
    messages.push(
      "Cette mission chevauche une mission déjà acceptée. Signalez-le-nous avant de répondre.",
    );
  }

  if (messages.length === 0) return null;

  return (
    <ul className="space-y-1.5">
      {messages.map((message) => (
        <li key={message} className="flex items-baseline gap-2 text-sm">
          <AlertTriangleIcon
            className="size-4 shrink-0 translate-y-0.5 text-warning"
            aria-hidden
          />
          {message}
        </li>
      ))}
    </ul>
  );
}

export function MissionProposeeCarte({
  mission,
}: {
  mission: MissionProposee;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [refusOuvert, setRefusOuvert] = useState(false);
  const [motif, setMotif] = useState("");

  function repondre(action: "accepter" | "refuser") {
    setErreur(null);
    startTransition(async () => {
      const resultat =
        action === "accepter"
          ? await accepterMission({ assignmentId: mission.assignmentId })
          : await refuserMission({
              assignmentId: mission.assignmentId,
              motif: motif.trim() || undefined,
            });

      if (!resultat.ok) {
        setErreur(resultat.error);
        return;
      }

      /*
       * `revalidatePath` invalide le cache serveur ; il ne redessine pas la vue
       * déjà affichée. Sans ce rafraîchissement, la réponse était bien
       * enregistrée mais la carte restait à l'écran — et l'intervenant, ne
       * voyant rien changer, cliquait une seconde fois.
       */
      router.refresh();
    });
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <header>
        <p className="font-heading text-lg font-semibold first-letter:uppercase">
          {jourHeure.format(new Date(mission.debut))}
        </p>
        <p className="mt-1 text-muted-foreground">
          {dureeLisible(mission.dureeMinutes)} ·{" "}
          {formatEuros(mission.remunerationCents)} pour vous
        </p>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Où</dt>
          <dd className="mt-0.5 font-medium">
            {mission.communeName}
            <span className="block font-normal text-muted-foreground">
              {mission.voie}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Route</dt>
          <dd className="mt-0.5 font-medium tabular-nums">
            {mission.trajetAvantMinutes} min pour y aller
          </dd>
        </div>
        {mission.surfaceSqm ? (
          <div>
            <dt className="text-muted-foreground">Logement</dt>
            <dd className="mt-0.5 font-medium">{mission.surfaceSqm} m²</dd>
          </div>
        ) : null}
        {mission.repondreAvant ? (
          <div>
            <dt className="text-muted-foreground">À répondre avant</dt>
            <dd className="mt-0.5 font-medium first-letter:uppercase">
              {jourHeure.format(new Date(mission.repondreAvant))}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-5 space-y-4 rounded-xl bg-secondary/40 p-4">
        <Frise insertion={mission.insertion} />
        <Avertissements mission={mission} />
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        L&apos;adresse exacte et les consignes d&apos;accès vous seront données
        dès que vous aurez accepté.
      </p>

      {erreur ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {erreur}
        </p>
      ) : null}

      {refusOuvert ? (
        <div className="mt-5 space-y-3">
          <label htmlFor={`motif-${mission.assignmentId}`} className="text-sm">
            Pourquoi refusez-vous ? (facultatif, cela nous aide à mieux vous
            proposer)
          </label>
          <input
            id={`motif-${mission.assignmentId}`}
            value={motif}
            onChange={(event) => setMotif(event.target.value)}
            placeholder="Trop loin, journée déjà chargée…"
            className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-base"
          />
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => repondre("refuser")}
            >
              {pending ? (
                <Loader2Icon className="animate-spin" aria-hidden />
              ) : null}
              Confirmer le refus
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => setRefusOuvert(false)}
            >
              Revenir
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            size="lg"
            disabled={pending}
            onClick={() => repondre("accepter")}
          >
            {pending ? (
              <Loader2Icon className="animate-spin" aria-hidden />
            ) : (
              <CheckIcon aria-hidden />
            )}
            J&apos;accepte cette mission
          </Button>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => setRefusOuvert(true)}
          >
            <XIcon aria-hidden />
            Je ne peux pas
          </Button>
        </div>
      )}
    </article>
  );
}
