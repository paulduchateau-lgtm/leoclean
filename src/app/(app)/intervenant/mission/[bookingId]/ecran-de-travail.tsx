"use client";

import {
  AlertTriangleIcon,
  CheckIcon,
  KeyRoundIcon,
  Loader2Icon,
  MapPinIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  cocherUneTache,
  demanderLaConsigne,
  pointerLaMission,
  signalerUneAnomalie,
} from "@/app/(app)/intervenant/mission/actions";
import { Button } from "@/components/ui/button";
import { LIBELLES_ANOMALIE, TYPES_ANOMALIE } from "@/lib/mission/cycle";
import { formatEuros } from "@/lib/pricing";

/**
 * L'écran de travail, tel qu'on l'emploie debout dans un hall d'immeuble.
 *
 * Un seul geste dominant par état : arriver, puis terminer. Tout le reste est
 * en dessous et peut attendre. Le bouton reste collant en bas parce que c'est
 * là que le pouce se trouve, et il fait 56 px parce qu'on le presse avec des
 * gants.
 */

interface Mission {
  bookingId: string;
  statut: string;
  debut: string;
  dureePrevueMinutes: number;
  dureeReelleMinutes: number | null;
  rapportComplet: boolean;
  remunerationCents: number;
  clientPrenom: string | null;
  adresse: string;
  etage: string | null;
  ascenseur: boolean | null;
  stationnement: string | null;
  accesNotes: string | null;
  zonesInterdites: string | null;
  allergies: string | null;
  consignesClient: string | null;
  /** Consignes guidées du logement, déjà mises en forme par le module pur. */
  consignesGuidees: { rubrique: string; sujet: string; reponse: string }[];
  /** ISO 8601 de leur dernière mise à jour, ou `null`. */
  consignesMajAt: string | null;
  consigneSecreteExiste: boolean;
  arriveeA: string | null;
  departA: string | null;
}

interface Tache {
  id: string;
  piece: string | null;
  libelle: string;
  ajouteeParLeClient: boolean;
  faite: boolean;
}

interface Anomalie {
  id: string;
  type: string;
  description: string | null;
  ajustement: string | null;
}

const HEURE = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

function dureeLisible(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export function EcranDeTravail({
  mission,
  taches,
  anomalies,
}: {
  mission: Mission;
  taches: Tache[];
  anomalies: Anomalie[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [consigne, setConsigne] = useState<string | null>(null);
  const [messageConsigne, setMessageConsigne] = useState<string | null>(null);
  const [anomalieOuverte, setAnomalieOuverte] = useState(false);
  const [typeAnomalie, setTypeAnomalie] = useState<string>(TYPES_ANOMALIE[0]);
  const [descriptionAnomalie, setDescriptionAnomalie] = useState("");
  const [cochees, setCochees] = useState<Record<string, boolean>>(
    Object.fromEntries(taches.map((t) => [t.id, t.faite])),
  );

  const arrivee = mission.arriveeA ? new Date(mission.arriveeA) : null;
  const depart = mission.departA ? new Date(mission.departA) : null;
  const terminee = depart !== null;
  const restantes = taches.filter((t) => !cochees[t.id]).length;

  function pointer(sens: "ARRIVEE" | "DEPART") {
    setErreur(null);

    /*
     * La position est demandée, jamais exigée : un refus, un sous-sol ou un
     * immeuble mal géocodé ne doivent pas empêcher de travailler. On laisse
     * cinq secondes au capteur, puis on pointe sans lui.
     */
    const obtenirPosition = () =>
      new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (!("geolocation" in navigator)) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null),
          { timeout: 5000, maximumAge: 60_000 },
        );
      });

    startTransition(async () => {
      const position = await obtenirPosition();
      const resultat = await pointerLaMission({
        bookingId: mission.bookingId,
        sens,
        lat: position?.lat,
        lng: position?.lng,
      });

      if (!resultat.ok) {
        setErreur(resultat.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <header className="mt-4">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {mission.clientPrenom ?? "Mission"}
        </h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">
          {DATE_LONGUE.format(new Date(mission.debut))} ·{" "}
          {HEURE.format(new Date(mission.debut))} ·{" "}
          {dureeLisible(mission.dureePrevueMinutes)} ·{" "}
          {formatEuros(mission.remunerationCents)}
        </p>
      </header>

      {terminee ? (
        <section className="mt-6 rounded-xl border border-success/40 bg-success/10 p-5">
          <p className="font-semibold">Mission terminée</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Arrivée à {HEURE.format(arrivee!)}, départ à {HEURE.format(depart)}
            {mission.dureeReelleMinutes !== null
              ? ` — ${dureeLisible(mission.dureeReelleMinutes)} sur place, ${dureeLisible(mission.dureePrevueMinutes)} prévues.`
              : "."}
          </p>
          {!mission.rapportComplet ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Le rapport photo est incomplet. Ce n&apos;est pas bloquant et
              n&apos;affecte pas votre paiement — on vous le signale pour que
              vous le complétiez si vous le pouvez.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading text-lg font-semibold">Sur place</h2>
        <p className="mt-2 flex items-start gap-2">
          <MapPinIcon className="mt-1 size-4 shrink-0 text-brand" aria-hidden />
          <span>{mission.adresse}</span>
        </p>
        <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
          {mission.etage ? (
            <div>
              <dt className="inline font-medium">Étage : </dt>
              <dd className="inline">
                {mission.etage}
                {mission.ascenseur === true
                  ? ", avec ascenseur"
                  : mission.ascenseur === false
                    ? ", sans ascenseur"
                    : ""}
              </dd>
            </div>
          ) : null}
          {mission.stationnement ? (
            <div>
              <dt className="inline font-medium">Stationnement : </dt>
              <dd className="inline">{mission.stationnement}</dd>
            </div>
          ) : null}
          {mission.accesNotes ? (
            <div>
              <dt className="inline font-medium">Accès : </dt>
              <dd className="inline">{mission.accesNotes}</dd>
            </div>
          ) : null}
        </dl>

        {mission.consigneSecreteExiste ? (
          <div className="mt-4">
            {consigne ? (
              <p className="rounded-lg border border-brand/40 bg-brand/10 p-4 font-mono text-xl font-semibold">
                {consigne}
              </p>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const resultat = await demanderLaConsigne({
                      bookingId: mission.bookingId,
                    });
                    if (!resultat.ok) {
                      setMessageConsigne(resultat.error);
                      return;
                    }
                    setConsigne(resultat.data.consigne);
                    setMessageConsigne(resultat.data.message);
                  })
                }
              >
                <KeyRoundIcon aria-hidden />
                Afficher le code d&apos;accès
              </Button>
            )}
            {messageConsigne ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {messageConsigne}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {mission.zonesInterdites ||
      mission.allergies ||
      mission.consignesClient ? (
        <section className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-5">
          <h2 className="font-heading text-lg font-semibold">À savoir</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {mission.allergies ? (
              <li>
                <span className="font-medium">Allergies : </span>
                {mission.allergies}
              </li>
            ) : null}
            {mission.zonesInterdites ? (
              <li>
                <span className="font-medium">Ne pas toucher : </span>
                {mission.zonesInterdites}
              </li>
            ) : null}
            {mission.consignesClient ? (
              <li>
                <span className="font-medium">Du client : </span>
                {mission.consignesClient}
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {/*
        Les consignes du logement, dans leur propre bloc et **après** « À
        savoir ». L'ordre est celui de l'urgence : les allergies et les zones
        interdites disent ce qui peut mal tourner, les consignes disent comment
        bien faire. Les fondre en une seule liste noierait les premières dans
        les secondes, qui sont plus nombreuses.

        La date est affichée parce qu'une consigne de l'an dernier ne se lit pas
        comme une consigne d'hier — et qu'on n'a rien d'autre pour en juger.
      */}
      {mission.consignesGuidees.length > 0 ? (
        <section className="mt-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-semibold">
            Les consignes du logement
          </h2>
          {mission.consignesMajAt ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Mises à jour par le client le{" "}
              {new Intl.DateTimeFormat("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "Europe/Paris",
              }).format(new Date(mission.consignesMajAt))}
            </p>
          ) : null}

          <dl className="mt-3 space-y-2 text-sm">
            {mission.consignesGuidees.map((consigne) => (
              <div
                key={`${consigne.rubrique}-${consigne.sujet}`}
                className="flex flex-wrap gap-x-2"
              >
                <dt className="font-medium">{consigne.sujet} :</dt>
                <dd className="text-muted-foreground">{consigne.reponse}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {taches.length > 0 ? (
        <section className="mt-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-semibold">
            Checklist
            <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
              {taches.length - restantes}/{taches.length}
            </span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Un mémo, pas un contrôle. Rien ne vous empêche de terminer.
          </p>
          <ul className="mt-3 space-y-2">
            {taches.map((tache) => (
              <li key={tache.id}>
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={cochees[tache.id] ?? false}
                    disabled={terminee}
                    onChange={(event) => {
                      const faite = event.target.checked;
                      setCochees((etat) => ({ ...etat, [tache.id]: faite }));
                      void cocherUneTache({
                        bookingId: mission.bookingId,
                        tacheId: tache.id,
                        faite,
                      });
                    }}
                    className="size-6 rounded-md border-input"
                  />
                  <span
                    className={
                      cochees[tache.id] ? "line-through opacity-60" : ""
                    }
                  >
                    {tache.piece ? (
                      <span className="text-muted-foreground">
                        {tache.piece} ·{" "}
                      </span>
                    ) : null}
                    {tache.libelle}
                    {tache.ajouteeParLeClient ? (
                      <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs">
                        demandé cette fois
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-4 rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading text-lg font-semibold">
          Quelque chose ne va pas ?
        </h2>

        {anomalies.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {anomalies.map((anomalie) => (
              <li key={anomalie.id} className="rounded-lg bg-secondary/40 p-3">
                <span className="font-medium">
                  {LIBELLES_ANOMALIE[
                    anomalie.type as keyof typeof LIBELLES_ANOMALIE
                  ] ?? anomalie.type}
                </span>
                {anomalie.description ? (
                  <span className="text-muted-foreground">
                    {" "}
                    — {anomalie.description}
                  </span>
                ) : null}
                {anomalie.ajustement === "PENDING" ? (
                  <p className="mt-1 text-muted-foreground">
                    Ajustement de durée proposé, en attente de validation. Rien
                    n&apos;est facturé tant que ce n&apos;est pas validé.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {anomalieOuverte ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {TYPES_ANOMALIE.map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={typeAnomalie === type}
                  onClick={() => setTypeAnomalie(type)}
                  className={`min-h-11 rounded-full border px-4 text-sm ${
                    typeAnomalie === type
                      ? "border-brand bg-brand text-ink-950"
                      : "border-input bg-background"
                  }`}
                >
                  {LIBELLES_ANOMALIE[type]}
                </button>
              ))}
            </div>
            <input
              value={descriptionAnomalie}
              onChange={(event) => setDescriptionAnomalie(event.target.value)}
              maxLength={1000}
              placeholder="Précisez en un mot"
              className="min-h-13 w-full rounded-xl border border-input bg-background px-3 text-base"
            />
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const resultat = await signalerUneAnomalie({
                      bookingId: mission.bookingId,
                      type: typeAnomalie as (typeof TYPES_ANOMALIE)[number],
                      description: descriptionAnomalie.trim() || undefined,
                    });
                    if (!resultat.ok) {
                      setErreur(resultat.error);
                      return;
                    }
                    setAnomalieOuverte(false);
                    setDescriptionAnomalie("");
                    router.refresh();
                  })
                }
              >
                Signaler
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAnomalieOuverte(false)}
              >
                Revenir
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => setAnomalieOuverte(true)}
          >
            <AlertTriangleIcon aria-hidden />
            Signaler quelque chose
          </Button>
        )}
      </section>

      {erreur ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {erreur}
        </p>
      ) : null}

      {/*
       * Le geste dominant, collant en bas : c'est là que le pouce se trouve, et
       * c'est le seul bouton de l'écran qui compte à cet instant.
       */}
      {!terminee ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-4 backdrop-blur">
          <div className="mx-auto max-w-2xl">
            <Button
              type="button"
              size="lg"
              className="h-14 w-full text-lg"
              disabled={pending}
              onClick={() => pointer(arrivee ? "DEPART" : "ARRIVEE")}
            >
              {pending ? (
                <Loader2Icon className="animate-spin" aria-hidden />
              ) : (
                <CheckIcon aria-hidden />
              )}
              {arrivee ? "Terminer la mission" : "Je suis arrivée"}
            </Button>
            {arrivee ? (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Arrivée pointée à {HEURE.format(arrivee)}
                {restantes > 0
                  ? ` · ${restantes} tâche${restantes > 1 ? "s" : ""} non cochée${restantes > 1 ? "s" : ""}`
                  : ""}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
