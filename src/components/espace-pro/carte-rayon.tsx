"use client";

import { Loader2Icon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  type CommuneCarte,
  type Point,
  RAYON_MAX_KM,
  RAYON_MIN_KM,
  RAYON_PAS_KM,
  projeter,
  resumeDuRayon,
} from "@/lib/availability/rayon";

/**
 * Rayon d'action, choisi sur une carte.
 *
 * **La carte est dessinée, pas chargée.** Seize communes nommées autour d'un
 * point disent mieux « est-ce que je couvre Cadaujac ? » qu'un fond de plan où
 * il faudrait reconnaître un contour ; et cela évite une bibliothèque
 * cartographique, une clé de service, et une requête de tuiles par
 * déplacement — c'est-à-dire une adresse de domicile envoyée à un tiers à
 * chaque geste. Le jour où le territoire dépassera un département, la question
 * se rouvrira.
 *
 * **Le curseur redessine sans enregistrer.** Voir ce qu'on perd avant de le
 * perdre est tout l'intérêt du dessin : un réglage qui s'appliquerait au
 * relâchement obligerait à revenir en arrière pour comparer.
 */
export function CarteRayon({
  centre,
  communes,
  rayonInitial,
  adresseConnue,
  enregistrer,
}: {
  /** Domicile de l'intervenant, ou le siège à défaut. */
  centre: Point;
  communes: readonly CommuneCarte[];
  rayonInitial: number;
  /**
   * Le centre est-il vraiment le domicile ?
   *
   * Faux, la carte reste utile — elle montre le territoire — mais elle ne
   * décrit pas encore le périmètre réel, et le dire vaut mieux que de laisser
   * croire à un cercle tracé chez soi.
   */
  adresseConnue: boolean;
  enregistrer: (rayonKm: number) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [rayon, setRayon] = useState(rayonInitial);
  const [enregistre, setEnregistre] = useState(rayonInitial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const carte = useMemo(
    () => projeter(centre, communes, rayon),
    [centre, communes, rayon],
  );

  return (
    <div>
      <figure className="rounded-[var(--r-l)] bg-secondary p-4">
        <svg
          viewBox="0 0 100 100"
          className="h-auto w-full"
          role="img"
          aria-label={resumeDuRayon(carte, rayon)}
        >
          <circle
            cx={50}
            cy={50}
            r={carte.rayonRelatif}
            className="fill-teal-400/15 stroke-teal-600"
            strokeWidth={0.5}
            strokeDasharray="2 1.5"
          />

          {carte.communes.map((commune) => (
            <g key={commune.slug}>
              <circle
                cx={commune.x}
                cy={commune.y}
                r={commune.couverte ? 1.4 : 1}
                className={commune.couverte ? "fill-teal-600" : "fill-ink-300"}
              />
              {commune.etiquette ? (
                <text
                  x={commune.x}
                  y={commune.y - 2.2}
                  textAnchor="middle"
                  /* 2,6 unités sur 100 : à 340 pixels de large, environ 9 px.
                     En dessous, les noms des communes proches se confondent. */
                  fontSize={2.6}
                  className={
                    commune.couverte
                      ? "fill-ink-900 font-semibold"
                      : "fill-ink-400"
                  }
                >
                  {commune.name}
                </text>
              ) : null}
            </g>
          ))}

          {/* Le domicile par-dessus tout : c'est le point de référence, et il
              tombe souvent sur une commune. */}
          <circle
            cx={50}
            cy={50}
            r={2.2}
            className="fill-ink-900 stroke-white"
            strokeWidth={0.8}
          />
        </svg>

        <figcaption className="mt-3 text-sm text-pretty text-muted-foreground">
          {adresseConnue
            ? "Le point noir est votre domicile."
            : "Votre adresse n'est pas encore renseignée : la carte est centrée sur Léognan, et votre rayon ne filtrera rien tant qu'elle manque."}
        </figcaption>
      </figure>

      <label className="mt-6 block">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-medium">Rayon d&apos;action</span>
          <span className="font-mono text-lg font-bold">{rayon} km</span>
        </span>
        <input
          type="range"
          className="range-slider mt-3"
          min={RAYON_MIN_KM}
          max={RAYON_MAX_KM}
          step={RAYON_PAS_KM}
          value={rayon}
          onChange={(event) => {
            setErreur(null);
            setRayon(Number(event.target.value));
          }}
          aria-label="Rayon d'action, en kilomètres"
        />
        <span
          className="mt-2 flex justify-between font-mono text-xs text-muted-foreground"
          aria-hidden
        >
          <span>{RAYON_MIN_KM} km</span>
          <span>{RAYON_MAX_KM} km</span>
        </span>
      </label>

      <p role="status" className="mt-3 text-pretty">
        {resumeDuRayon(carte, rayon)}
      </p>

      {/*
       * **La liste répond, la carte montre.** Sept communes se serrent dans
       * deux kilomètres carrés : le dessin ne peut pas les nommer toutes sans
       * devenir illisible, et « est-ce que je couvre Cadaujac ? » se répond en
       * lisant un nom, pas en visant un point. Les deux sont donc données, et
       * elles viennent du même calcul.
       */}
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {carte.communes
          .filter((commune) => commune.couverte)
          .sort((a, b) => a.km - b.km)
          .map((commune) => (
            <li
              key={commune.slug}
              className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-ink-900"
            >
              {commune.name}{" "}
              <span className="font-mono font-normal text-teal-800">
                {Math.round(commune.km)} km
              </span>
            </li>
          ))}
        {carte.communes
          .filter((commune) => !commune.couverte)
          .sort((a, b) => a.km - b.km)
          .map((commune) => (
            <li
              key={commune.slug}
              className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground line-through"
            >
              {commune.name}
            </li>
          ))}
      </ul>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">
        Au-delà de ce rayon, aucune mission ne vous est proposée — même un jour
        où votre planning est vide.
      </p>

      {erreur ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {erreur}
        </p>
      ) : null}

      <Button
        size="lg"
        className="mt-5 w-full"
        disabled={pending || rayon === enregistre}
        onClick={() =>
          startTransition(async () => {
            setErreur(null);
            const resultat = await enregistrer(rayon);
            if (!resultat.ok) {
              setErreur(resultat.error ?? "Enregistrement refusé.");
              return;
            }
            setEnregistre(rayon);
          })
        }
      >
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
        {rayon === enregistre ? "Rayon enregistré" : `Enregistrer ${rayon} km`}
      </Button>
    </div>
  );
}
