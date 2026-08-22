"use client";

import { useTransition } from "react";

import {
  activerLeCompte,
  cloreLaDemandeRgpd,
  cloreLeCompte,
  leverLaSuspensionDuCompte,
  suspendreLeCompte,
} from "@/app/(app)/administration/intervenants/actions";
import { GesteAvecMotif } from "@/app/(app)/administration/intervenants/geste";
import type { CompteVue } from "@/lib/administration/comptes-intervenants";
import type { DemandeEnAttente } from "@/lib/cleaner/demande-rgpd";

const JOUR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});

export function ListeComptes({ comptes }: { comptes: CompteVue[] }) {
  const [pending, startTransition] = useTransition();

  if (comptes.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        Aucun compte dans cette file.
      </p>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {comptes.map((compte) => (
        <li
          key={compte.cleanerProfileId}
          className="rounded-xl border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">{compte.nom}</p>
            <span
              className={`text-sm font-bold ${
                compte.actif ? "text-success" : "text-destructive"
              }`}
            >
              {compte.etatLibelle}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {compte.email} · {compte.organisation} · {compte.piecesConformes}/
            {compte.piecesTotal} pièces
            {compte.dossierSoumisLe
              ? ` · soumis le ${JOUR.format(compte.dossierSoumisLe)}`
              : ""}
          </p>
          {compte.suspensionMotif ? (
            <p className="mt-1 text-sm text-pretty text-destructive">
              Motif : {compte.suspensionMotif}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-start gap-2">
            {compte.motif === "EN_COURS_EXAMEN" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await activerLeCompte({
                      cleanerProfileId: compte.cleanerProfileId,
                    });
                  })
                }
                className="inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-40"
              >
                Activer le compte
              </button>
            ) : null}

            {compte.suspensionOrigine === "PLATFORM" &&
            compte.statut === "SUSPENDED" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await leverLaSuspensionDuCompte({
                      cleanerProfileId: compte.cleanerProfileId,
                    });
                  })
                }
                className="inline-flex min-h-10 items-center rounded-full border-2 border-border bg-card px-4 text-sm font-bold"
              >
                Lever la suspension
              </button>
            ) : null}

            {compte.statut !== "SUSPENDED" && compte.statut !== "INACTIVE" ? (
              <GesteAvecMotif
                libelle="Suspendre"
                invite="Pourquoi ? Ce motif s'affiche à l'intervenant."
                action={async (motif) => {
                  const r = await suspendreLeCompte({
                    cleanerProfileId: compte.cleanerProfileId,
                    motif,
                  });
                  return { ok: r.ok, message: r.ok ? undefined : r.error };
                }}
              />
            ) : null}

            {compte.statut !== "INACTIVE" ? (
              <GesteAvecMotif
                libelle="Clore le compte"
                ton="danger"
                invite="Pourquoi ? Le compte est retiré de la plateforme, les factures restent."
                action={async (motif) => {
                  const r = await cloreLeCompte({
                    cleanerProfileId: compte.cleanerProfileId,
                    motif,
                  });
                  return { ok: r.ok, message: r.ok ? undefined : r.error };
                }}
              />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FileRgpd({ demandes }: { demandes: DemandeEnAttente[] }) {
  if (demandes.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        Aucune demande en attente.
      </p>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {demandes.map((demande) => (
        <li
          key={demande.id}
          className={`rounded-xl border p-4 ${
            /* Le délai légal est d'un mois : au-delà de trois semaines, la
               ligne se signale d'elle-même. */
            demande.jours >= 21
              ? "border-destructive/50 bg-destructive/5"
              : "border-border bg-card"
          }`}
        >
          <p className="font-medium">
            {demande.type === "ACCES" ? "Copie des données" : "Effacement"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {demande.nom ?? "—"} · {demande.email} · déposée il y a{" "}
            {demande.jours} jour{demande.jours > 1 ? "s" : ""}
          </p>
          {demande.message ? (
            <p className="mt-2 text-sm text-pretty">{demande.message}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-start gap-2">
            {(
              [
                { statut: "TRAITEE" as const, libelle: "Marquer traitée" },
                { statut: "REFUSEE" as const, libelle: "Refuser" },
              ] as const
            ).map((choix) => (
              <GesteAvecMotif
                key={choix.statut}
                libelle={choix.libelle}
                ton={choix.statut === "REFUSEE" ? "danger" : "neutre"}
                invite="Ce qui a été fait, et pourquoi. C'est ce qu'on relira."
                action={async (resolution) => {
                  const r = await cloreLaDemandeRgpd({
                    id: demande.id,
                    statut: choix.statut,
                    resolution,
                  });
                  return { ok: r.ok, message: r.ok ? undefined : r.error };
                }}
              />
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
