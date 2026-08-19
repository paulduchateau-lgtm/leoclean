"use client";

import {
  AlertTriangleIcon,
  CheckIcon,
  ClockIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Frise } from "@/app/(app)/intervenant/frise";
import {
  accepterMission,
  proposerUnAutreCreneau,
  refuserMission,
} from "@/app/(app)/intervenant/actions";
import { Button } from "@/components/ui/button";
import type { MissionProposee } from "@/lib/assignments/types";
import { formatEuros } from "@/lib/pricing";

/** Heure seule : la date est déjà portée par la carte. */
const HEURE = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

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
  const [autreOuvert, setAutreOuvert] = useState(false);
  const [autreHeure, setAutreHeure] = useState("");
  const [autreMot, setAutreMot] = useState("");
  const [voieRetenue, setVoieRetenue] = useState<string | null>(null);

  /*
   * Les heures proposables : le même jour que la demande, au pas de trente
   * minutes, et au plus une heure d'écart de part et d'autre. Le serveur
   * refuserait le reste de toute façon ; les offrir ici serait montrer un
   * bouton qui échoue.
   *
   * L'horloge est lue **une fois**, à la première construction : la lire à
   * chaque rendu ferait disparaître une heure sous le doigt de quelqu'un au
   * franchissement du délai minimal, ce qui est autant un défaut d'interface
   * qu'une impureté.
   */
  const [maintenant] = useState(() => Date.now());
  const debutDemande = new Date(mission.debut);
  const heuresPossibles = [-60, -30, 30, 60]
    .map((decalage) => new Date(debutDemande.getTime() + decalage * 60_000))
    .filter((heure) => heure.getTime() > maintenant + 12 * 3_600_000)
    .filter((heure) => heure.getDate() === debutDemande.getDate());

  function proposerAutreHeure() {
    if (!autreHeure) return;
    setErreur(null);
    startTransition(async () => {
      const resultat = await proposerUnAutreCreneau({
        bookingId: mission.bookingId,
        proposedStart: autreHeure,
        message: autreMot.trim() || undefined,
      });
      if (!resultat.ok) {
        setErreur(resultat.error);
        return;
      }
      setVoieRetenue(resultat.data.voie);
      setAutreOuvert(false);
    });
  }

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
          {heuresPossibles.length > 0 ? (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setAutreOuvert(true)}
            >
              <ClockIcon aria-hidden />
              Je peux, mais à une autre heure
            </Button>
          ) : null}
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

      {autreOuvert ? (
        <div className="mt-5 space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
          <p className="text-sm font-medium">Quelle heure vous irait ?</p>
          <p className="text-sm text-muted-foreground">
            Le client reçoit votre proposition tout de suite et n&apos;a
            qu&apos;à l&apos;accepter. Si quelqu&apos;un prend la mission à
            l&apos;heure demandée entre-temps, elle repart — ce n&apos;est pas
            un refus de votre part.
          </p>
          <div className="flex flex-wrap gap-2">
            {heuresPossibles.map((heure) => {
              const valeur = heure.toISOString();
              const choisie = valeur === autreHeure;
              return (
                <button
                  key={valeur}
                  type="button"
                  onClick={() => setAutreHeure(valeur)}
                  aria-pressed={choisie}
                  className={`min-h-11 rounded-full border px-4 text-base ${
                    choisie
                      ? "border-brand bg-brand text-ink-950"
                      : "border-input bg-background"
                  }`}
                >
                  {HEURE.format(heure)}
                </button>
              );
            })}
          </div>
          <input
            value={autreMot}
            onChange={(event) => setAutreMot(event.target.value)}
            placeholder="Un mot pour le client (facultatif)"
            maxLength={200}
            className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-base"
          />
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={pending || !autreHeure}
              onClick={proposerAutreHeure}
            >
              {pending ? (
                <Loader2Icon className="animate-spin" aria-hidden />
              ) : null}
              Proposer cette heure
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => setAutreOuvert(false)}
            >
              Revenir
            </Button>
          </div>
        </div>
      ) : null}

      {voieRetenue ? (
        <p className="mt-4 rounded-xl border border-success/40 bg-success/10 p-3 text-sm">
          {voieRetenue === "PRE_ACCEPTATION"
            ? "C'est envoyé. Le client a votre proposition sous les yeux ; vous serez prévenue de sa réponse."
            : "C'est noté. On cherche d'abord l'heure demandée par le client ; votre proposition lui sera montrée si personne ne la prend."}
        </p>
      ) : null}
    </article>
  );
}
