"use client";

import { ArrowRightIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

/**
 * Bandeau de reprise, en tête d'accueil.
 *
 * Un parcours interrompu au troisième écran ne se retrouve pas tout seul : la
 * personne revient par la page d'accueil, y relit ce qu'elle sait déjà, et
 * recommence de zéro. Le bandeau lui rend ses choix en un geste.
 *
 * **Il ne lit que ce que le tunnel a le droit d'écrire** — une commune, une
 * surface, un rythme, une heure. Ni nom, ni téléphone, ni adresse : c'est la
 * règle du stockage, et elle se vérifie ici autant qu'à l'écriture.
 *
 * Le composant est rendu côté client sur une page prérendue. `useSyncExternal
 * Store` est l'outil qui franchit cet écart sans erreur d'hydratation : le
 * serveur ne voit pas le stockage, le client si, et le hook le sait.
 */

const STORAGE_KEY = "leoclean:booking:v1";
const MAX_AGE_MS = 7 * 24 * 3_600_000;

/** Les six écrans du tunnel, pour dire où l'on en était. */
const STEPS = [
  "commune",
  "logement",
  "rythme",
  "creneau",
  "coordonnees",
  "adresse",
] as const;

/**
 * Le stockage est une frontière comme une autre : son contenu est modifiable
 * à la main et peut venir d'une version antérieure de l'écran. Il est donc
 * validé, jamais typé par assertion.
 *
 * **Le contrôle est écrit à la main, et c'est la seule entorse du dépôt à la
 * règle « Zod à chaque frontière ».** Ce composant est rendu sur la page
 * d'accueil, qui est la porte d'entrée du référencement : importer le
 * validateur y ajoutait un fragment de 282 kio, servi à chaque visiteur, pour
 * vérifier quatre champs primitifs dont aucun ne pilote quoi que ce soit —
 * ils ne servent qu'à afficher un numéro d'étape et à composer un lien vers
 * une commune, elle-même revalidée à l'arrivée. Le tunnel, lui, garde Zod :
 * ce qu'il relit décide d'un prix.
 */

const STEPS_SET: ReadonlySet<string> = new Set(STEPS);

interface Saved {
  savedAt: number;
  step: (typeof STEPS)[number];
  communeSlug: string;
  chosenSlot: string | null;
}

function parse(raw: unknown): Saved | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;

  if (typeof value.savedAt !== "number" || !Number.isFinite(value.savedAt)) {
    return null;
  }
  if (typeof value.step !== "string" || !STEPS_SET.has(value.step)) return null;
  if (typeof value.communeSlug !== "string") return null;
  if (value.communeSlug.length === 0 || value.communeSlug.length > 60) {
    return null;
  }
  if (value.chosenSlot !== null && typeof value.chosenSlot !== "string") {
    return null;
  }

  return {
    savedAt: value.savedAt,
    step: value.step as (typeof STEPS)[number],
    communeSlug: value.communeSlug,
    chosenSlot: (value.chosenSlot as string | null) ?? null,
  };
}

function read(): Saved | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = parse(JSON.parse(raw));
    if (!saved) return null;
    if (Date.now() - saved.savedAt > MAX_AGE_MS) return null;
    return saved;
  } catch {
    // Stockage illisible — quota, mode privé, JSON tronqué. Il n'y a rien à
    // rattraper : la page s'affiche sans bandeau, ce qui est l'état normal.
    return null;
  }
}

/**
 * `useSyncExternalStore` exige un instantané référentiellement stable : sans
 * mémoïsation, chaque lecture rendrait un nouvel objet et bouclerait.
 */
let cached: Saved | null | undefined;

function snapshot(): Saved | null {
  if (cached === undefined) cached = read();
  return cached;
}

function subscribe(): () => void {
  return () => {};
}

export function ResumeBookingBanner() {
  const saved = useSyncExternalStore(subscribe, snapshot, () => null);

  if (!saved) return null;

  const position = STEPS.indexOf(saved.step) + 1;

  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-200 bg-teal-50 p-5">
      <div>
        <p className="font-extrabold">
          Reprendre ma réservation — étape {position} sur {STEPS.length}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Nous avons gardé vos choix, sans vos coordonnées ni votre adresse.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/reserver?commune=${saved.communeSlug}`}
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-xs transition-colors duration-200 ease-brand hover:bg-pineapple-400"
        >
          Reprendre
          <ArrowRightIcon className="size-4" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => {
            try {
              window.localStorage.removeItem(STORAGE_KEY);
            } catch {
              // Le stockage peut être refusé ; il n'y a rien à rattraper.
            }
            cached = null;
            // Un rechargement plutôt qu'un état local : le tunnel lit le même
            // stockage, et deux sources de vérité pour une même donnée
            // finissent toujours par diverger.
            window.location.reload();
          }}
          className="min-h-11 px-2 text-sm font-medium text-muted-foreground underline decoration-border underline-offset-4 hover:text-brand"
        >
          <RotateCcwIcon className="mr-1.5 inline size-3.5" aria-hidden />
          Recommencer
        </button>
      </div>
    </div>
  );
}
