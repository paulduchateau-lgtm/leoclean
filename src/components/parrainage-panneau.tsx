"use client";

import { CheckIcon, CopyIcon, Share2Icon } from "lucide-react";
import { useState } from "react";

/**
 * Le panneau de parrainage, partagé par le client et l'intervenant.
 *
 * Les deux programmes n'ont ni la même récompense ni les mêmes conditions, mais
 * ils ont la même mécanique : un code, des filleuls, un compteur. Un seul
 * composant, donc, paramétré par ce que les règles disent — et **jamais** par
 * un texte recopié : le plafond, le seuil et la durée viennent du programme.
 */

export interface Filleul {
  prenom: string | null;
  statut: string;
  prestationsTerminees: number;
  expireLe: string;
  gagneCents: number;
}

const LIBELLES_STATUT: Record<string, string> = {
  PENDING: "En cours",
  QUALIFIED: "Acquis",
  EXPIRED: "Expiré",
  CANCELLED: "Annulé",
};

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function ParrainagePanneau({
  code,
  lien,
  messageDePartage,
  filleuls,
  enAttenteCents,
  verseCents,
  seuil,
  regles,
}: {
  code: string;
  lien: string;
  messageDePartage: string;
  filleuls: Filleul[];
  enAttenteCents: number;
  verseCents: number;
  /** Prestations que le filleul doit réaliser avant que le gain soit dû. */
  seuil: number;
  /** Les règles, phrase par phrase, engendrées depuis le programme. */
  regles: string[];
}) {
  const [copie, setCopie] = useState(false);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border-2 border-brand bg-card p-6 text-center">
        <p className="text-xs tracking-overline text-muted-foreground uppercase">
          Votre code
        </p>
        <p className="mt-2 font-mono text-4xl font-black tracking-[0.15em]">
          {code}
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(lien).then(() => {
                setCopie(true);
                setTimeout(() => setCopie(false), 2000);
              });
            }}
            className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-border bg-card px-5 font-bold"
          >
            {copie ? (
              <CheckIcon className="size-4" aria-hidden />
            ) : (
              <CopyIcon className="size-4" aria-hidden />
            )}
            {/*
             * Le libellé change avec l'état plutôt que d'ajouter une info-bulle :
             * un bouton qui dit ce qui vient d'arriver se lit sans détour.
             */}
            {copie ? "Lien copié" : "Copier le lien"}
          </button>

          {/*
           * `wa.me` plutôt qu'un `navigator.share` seul : la moitié des postes
           * de bureau ne l'implémente pas, et un bouton qui ne fait rien sur
           * la moitié des appareils vaut moins qu'un lien qui marche partout.
           */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${messageDePartage} ${lien}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 font-bold text-primary-foreground"
          >
            <Share2Icon className="size-4" aria-hidden />
            Partager
          </a>
        </div>
      </section>

      {enAttenteCents + verseCents > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <p className="rounded-xl border border-border bg-card p-4">
            <span className="block text-sm text-muted-foreground">Acquis</span>
            <span className="mt-1 block font-mono text-2xl font-black">
              {euros(enAttenteCents)}
            </span>
          </p>
          <p className="rounded-xl border border-border bg-card p-4">
            <span className="block text-sm text-muted-foreground">
              Déjà versé
            </span>
            <span className="mt-1 block font-mono text-2xl font-black">
              {euros(verseCents)}
            </span>
          </p>
        </section>
      ) : null}

      <section>
        <h2 className="font-heading text-lg font-extrabold">Mes filleuls</h2>
        {filleuls.length === 0 ? (
          <p className="mt-3 rounded-xl border border-border bg-secondary/40 p-5 text-muted-foreground">
            Personne pour l&apos;instant. Le gain se déclenche à la{" "}
            {seuil === 1 ? "première" : `${seuil}ᵉ`} prestation de votre
            filleul.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {filleuls.map((filleul, index) => (
              <li
                key={`${filleul.prenom ?? "?"}-${index}`}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
              >
                <span className="font-medium">
                  {filleul.prenom ?? "Filleul"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {LIBELLES_STATUT[filleul.statut] ?? filleul.statut} ·{" "}
                  {filleul.prestationsTerminees}/{seuil} prestation
                  {seuil > 1 ? "s" : ""}
                  {filleul.statut === "PENDING"
                    ? ` · expire le ${DATE.format(new Date(filleul.expireLe))}`
                    : ""}
                </span>
                <span className="font-mono font-semibold tabular-nums">
                  {euros(filleul.gagneCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-border pt-6">
        <h2 className="font-heading text-lg font-extrabold">Les règles</h2>
        {/*
         * Le plafond est annoncé, et c'est la seule limite du dispositif :
         * la taire reproduirait l'opacité reprochée aux plateformes
         * nationales.
         */}
        <ul className="mt-3 space-y-2 text-muted-foreground">
          {regles.map((regle) => (
            <li key={regle} className="flex gap-2">
              <span aria-hidden className="text-brand">
                —
              </span>
              <span className="text-pretty">{regle}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
