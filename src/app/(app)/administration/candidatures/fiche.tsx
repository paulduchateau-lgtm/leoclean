"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  activerLeDossier,
  consignerLentretien,
  planifierLentretien,
  refuserLaPiece,
  refuserLeDossier,
  validerLaPiece,
} from "@/app/(app)/administration/candidatures/actions";
import { Button } from "@/components/ui/button";
import {
  CRITERES_ENTRETIEN,
  LIBELLES_CRITERES,
  LIBELLES_PIECES,
  LIBELLES_SIGNAUX,
  MOTIFS_REFUS_PIECE,
  type CritereEntretien,
  type MotifRefusPiece,
  type Piece,
  type SignalAttention,
} from "@/lib/candidature/parcours";

/**
 * Une fiche de dossier, dépliable.
 *
 * Repliée, elle donne ce qui décide d'ouvrir : le nom, l'ancienneté, l'état, et
 * les signaux. Dépliée, elle donne les gestes. Une liste où tout est ouvert
 * n'est pas une file de travail, c'est un rapport.
 */

interface Dossier {
  id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  commune: string | null;
  statut: string;
  progression: number;
  activable: boolean;
  signauxBloquants: SignalAttention[];
  signaux: SignalAttention[];
  siret: string | null;
  raisonSociale: string | null;
  apeCode: string | null;
  presentation: string | null;
  experience: string | null;
  entretienLe: string | null;
  notesEntretien: string | null;
  chartesSigneesLe: string | null;
  depuis: string;
  pieces: {
    kind: Piece;
    status: string;
    motif: string | null;
    deposee: boolean;
    expireLe: string | null;
  }[];
}

const MOTIFS = Object.keys(MOTIFS_REFUS_PIECE) as MotifRefusPiece[];

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});

function joursDepuis(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function FicheCandidature({ dossier }: { dossier: Dossier }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ouverte, setOuverte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [refusPiece, setRefusPiece] = useState<Piece | null>(null);
  const [motifPiece, setMotifPiece] = useState<MotifRefusPiece>("ILLISIBLE");
  const [precision, setPrecision] = useState("");
  const [notes, setNotes] = useState<Partial<Record<CritereEntretien, number>>>(
    {},
  );
  const [compteRendu, setCompteRendu] = useState("");
  const [motifRefus, setMotifRefus] = useState("");
  const [refusOuvert, setRefusOuvert] = useState(false);

  const [attente] = useState(() => joursDepuis(dossier.depuis));
  const bloque = dossier.signauxBloquants.length > 0;

  function agir(travail: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      setErreur(null);
      const resultat = await travail();
      if (!resultat.ok) {
        setErreur(resultat.error ?? "Action impossible.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <article
      className={`rounded-xl border bg-card ${
        bloque ? "border-destructive/50" : "border-border"
      }`}
    >
      <button
        type="button"
        onClick={() => setOuverte((etat) => !etat)}
        aria-expanded={ouverte}
        className="flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4 text-left"
      >
        <span className="font-semibold">{dossier.nom}</span>
        <span className="text-sm text-muted-foreground">
          {dossier.commune ?? "commune inconnue"} · {dossier.statut} ·{" "}
          {dossier.progression} %
        </span>
        <span
          className={`font-mono text-sm tabular-nums ${
            attente > 14
              ? "font-semibold text-warning-dark"
              : "text-muted-foreground"
          }`}
        >
          {attente} j
        </span>
      </button>

      {dossier.signaux.length > 0 ? (
        <ul className="flex flex-wrap gap-2 px-4 pb-3">
          {dossier.signaux.map((signal) => (
            <li
              key={signal}
              className={`rounded-full px-3 py-1 text-xs ${
                dossier.signauxBloquants.includes(signal)
                  ? "bg-destructive/10 font-semibold text-destructive"
                  : "bg-warning-bg text-warning-dark"
              }`}
            >
              {LIBELLES_SIGNAUX[signal]}
            </li>
          ))}
        </ul>
      ) : null}

      {ouverte ? (
        <div className="space-y-6 border-t border-border p-4">
          {erreur ? (
            <p role="alert" className="text-sm text-destructive">
              {erreur}
            </p>
          ) : null}

          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Téléphone</dt>
              <dd>{dossier.telephone ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate">{dossier.email ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">SIRET</dt>
              <dd className="font-mono">{dossier.siret ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Entreprise</dt>
              <dd className="truncate">
                {dossier.raisonSociale ?? "—"}
                {dossier.apeCode ? ` (${dossier.apeCode})` : ""}
              </dd>
            </div>
          </dl>

          {dossier.presentation ? (
            <p className="text-pretty text-muted-foreground">
              {dossier.presentation}
            </p>
          ) : null}

          {/* --- Les pièces --- */}
          <section>
            <h3 className="font-semibold">Pièces</h3>
            <ul className="mt-2 divide-y divide-border border-y border-border">
              {dossier.pieces.length === 0 ? (
                <li className="py-3 text-sm text-muted-foreground">
                  Aucune pièce déposée.
                </li>
              ) : null}
              {dossier.pieces.map((piece) => (
                <li key={piece.kind} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm">
                      {LIBELLES_PIECES[piece.kind]} ·{" "}
                      <span className="text-muted-foreground">
                        {piece.status.toLowerCase()}
                      </span>
                      {piece.expireLe
                        ? ` · expire le ${DATE.format(new Date(piece.expireLe))}`
                        : ""}
                    </span>
                    {piece.status !== "VALIDEE" && piece.deposee ? (
                      <span className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() =>
                            agir(() =>
                              validerLaPiece({
                                applicationId: dossier.id,
                                kind: piece.kind,
                              }),
                            )
                          }
                        >
                          Valider
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setRefusPiece(
                              refusPiece === piece.kind ? null : piece.kind,
                            )
                          }
                        >
                          Refuser
                        </Button>
                      </span>
                    ) : null}
                  </div>

                  {piece.motif ? (
                    <p className="mt-1 text-sm text-destructive">
                      {piece.motif}
                    </p>
                  ) : null}

                  {refusPiece === piece.kind ? (
                    <div className="mt-3 space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
                      {/*
                       * Le motif se choisit dans une liste écrite en langage
                       * courant. Un motif vague fait redéposer la même pièce,
                       * et c'est le candidat qui paie l'aller-retour.
                       */}
                      <select
                        value={motifPiece}
                        onChange={(event) =>
                          setMotifPiece(event.target.value as MotifRefusPiece)
                        }
                        className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      >
                        {MOTIFS.map((motif) => (
                          <option key={motif} value={motif}>
                            {MOTIFS_REFUS_PIECE[motif] || "Autre (à préciser)"}
                          </option>
                        ))}
                      </select>
                      {motifPiece === "AUTRE" ? (
                        <textarea
                          value={precision}
                          onChange={(event) => setPrecision(event.target.value)}
                          rows={2}
                          placeholder="Dites au candidat quoi refaire."
                          className="w-full rounded-lg border border-input bg-background p-2 text-sm"
                        />
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          pending ||
                          (motifPiece === "AUTRE" &&
                            precision.trim().length < 5)
                        }
                        onClick={() =>
                          agir(async () => {
                            const resultat = await refuserLaPiece({
                              applicationId: dossier.id,
                              kind: piece.kind,
                              motif: motifPiece,
                              precision: precision || undefined,
                            });
                            if (resultat.ok) setRefusPiece(null);
                            return resultat;
                          })
                        }
                      >
                        Confirmer le refus
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {/* --- L'entretien --- */}
          <section>
            <h3 className="font-semibold">Entretien</h3>
            {dossier.notesEntretien ? (
              <p className="mt-1 text-sm text-pretty text-muted-foreground">
                {DATE.format(new Date(dossier.entretienLe!))} —{" "}
                {dossier.notesEntretien}
              </p>
            ) : (
              <>
                {/*
                 * La grille homogénéise, elle ne classe pas : aucune moyenne
                 * n'est calculée, et c'est délibéré — une moyenne ferait
                 * compenser « français opérationnel » par « motivation », ce
                 * qui ne veut rien dire.
                 */}
                <p className="mt-1 text-sm text-muted-foreground">
                  Grille de 1 à 5. Elle sert de trace en cas de contestation ;
                  aucune moyenne n&apos;en est tirée.
                </p>
                <div className="mt-3 space-y-2">
                  {CRITERES_ENTRETIEN.map((critere) => (
                    <div
                      key={critere}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="text-sm">
                        {LIBELLES_CRITERES[critere]}
                      </span>
                      <span className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((note) => (
                          <button
                            key={note}
                            type="button"
                            aria-pressed={notes[critere] === note}
                            onClick={() =>
                              setNotes((etat) => ({ ...etat, [critere]: note }))
                            }
                            className={`size-9 rounded-lg border text-sm ${
                              notes[critere] === note
                                ? "border-brand bg-brand font-semibold text-ink-950"
                                : "border-input"
                            }`}
                          >
                            {note}
                          </button>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
                <textarea
                  value={compteRendu}
                  onChange={(event) => setCompteRendu(event.target.value)}
                  rows={3}
                  placeholder="Compte rendu."
                  className="mt-3 w-full rounded-lg border border-input bg-background p-3 text-sm"
                />
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending || compteRendu.trim().length === 0}
                    onClick={() =>
                      agir(() =>
                        consignerLentretien({
                          applicationId: dossier.id,
                          notes,
                          compteRendu,
                        }),
                      )
                    }
                  >
                    Consigner l&apos;entretien
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      agir(() =>
                        planifierLentretien({
                          applicationId: dossier.id,
                          quand: new Date(
                            Date.now() + 2 * 86_400_000,
                          ).toISOString(),
                        }),
                      )
                    }
                  >
                    Marquer comme planifié
                  </Button>
                </div>
              </>
            )}
          </section>

          {/* --- La décision --- */}
          <section className="border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={pending || !dossier.activable || bloque}
                onClick={() =>
                  agir(() => activerLeDossier({ applicationId: dossier.id }))
                }
              >
                {pending ? (
                  <Loader2Icon className="animate-spin" aria-hidden />
                ) : null}
                Activer
              </Button>
              <button
                type="button"
                onClick={() => setRefusOuvert((etat) => !etat)}
                className="text-sm text-muted-foreground underline"
              >
                Refuser le dossier
              </button>
            </div>

            {/*
             * Le bouton dit pourquoi il est éteint. Un bouton grisé sans
             * explication fait chercher ailleurs.
             */}
            {bloque ? (
              <p className="mt-2 text-sm text-destructive">
                Examen suspendu :{" "}
                {dossier.signauxBloquants
                  .map((signal) => LIBELLES_SIGNAUX[signal])
                  .join(", ")}
                .
              </p>
            ) : !dossier.activable ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Le dossier n&apos;est pas complet.
              </p>
            ) : null}

            {refusOuvert ? (
              <div className="mt-3 space-y-2">
                <textarea
                  value={motifRefus}
                  onChange={(event) => setMotifRefus(event.target.value)}
                  rows={3}
                  placeholder="Le motif sera lu par la personne. Dites ce qui a manqué."
                  className="w-full rounded-lg border border-input bg-background p-3 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending || motifRefus.trim().length < 10}
                  onClick={() =>
                    agir(() =>
                      refuserLeDossier({
                        applicationId: dossier.id,
                        motif: motifRefus,
                      }),
                    )
                  }
                >
                  Confirmer le refus
                </Button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </article>
  );
}
