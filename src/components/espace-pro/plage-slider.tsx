"use client";

import { useRef, useState } from "react";

import { heureLisible } from "@/lib/availability/semaine";

/**
 * Une plage horaire, réglée par deux poignées sur un seul rail.
 *
 * **Deux listes déroulantes disaient la même chose et se manipulaient plus
 * mal.** « De 9 h à 17 h » est une durée avant d'être deux instants : un rail
 * la montre, deux menus obligent à la reconstituer de tête. Sur mobile, un
 * `<select>` ouvre en plus une roue plein écran qui masque le reste de la
 * semaine — quatre gestes pour avancer d'une demi-heure.
 *
 * **Deux `<input type="range">` superposés plutôt qu'un composant maison.**
 * Le clavier, le lecteur d'écran et le geste de balayage viennent gratuitement,
 * et c'est ce qu'un curseur reconstruit à la main perd toujours en premier. La
 * poignée à saisir est décidée à la pression : au-dessus du milieu de la
 * plage on prend la fin, en dessous le début — sans quoi les deux poignées
 * collées l'une à l'autre deviennent impossibles à séparer, chacune butant sur
 * l'autre.
 */
export function PlageSlider({
  debutMinute,
  finMinute,
  min,
  max,
  pas,
  minimum,
  onChange,
  nomDuJour,
}: {
  debutMinute: number;
  finMinute: number;
  min: number;
  max: number;
  pas: number;
  /** Écart minimal entre les deux poignées, en minutes. */
  minimum: number;
  onChange: (debutMinute: number, finMinute: number) => void;
  nomDuJour: string;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [saisie, setSaisie] = useState<"debut" | "fin" | null>(null);

  const pourcent = (minute: number) => ((minute - min) / (max - min)) * 100;

  /**
   * Qui répond au geste ?
   *
   * Le second `<input>` recouvre le premier : sans arbitrage, la poignée de
   * fin capte tout, y compris les pressions du côté du début.
   */
  function choisirLaPoignee(clientX: number) {
    const boite = rail.current?.getBoundingClientRect();
    if (!boite) return;
    const minute = min + ((clientX - boite.left) / boite.width) * (max - min);
    setSaisie(
      Math.abs(minute - debutMinute) <= Math.abs(minute - finMinute)
        ? "debut"
        : "fin",
    );
  }

  const commun =
    "pointer-events-none absolute inset-0 h-12 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-teal-600 [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-teal-600 [&::-moz-range-thumb]:bg-white";

  return (
    <div
      ref={rail}
      className="relative h-12 w-full touch-none"
      onPointerDown={(event) => choisirLaPoignee(event.clientX)}
    >
      {/* Rail. Purement décoratif : les deux `input` portent la sémantique. */}
      <div
        aria-hidden
        className="absolute top-1/2 h-3 w-full -translate-y-1/2 rounded-full bg-secondary"
      />
      <div
        aria-hidden
        className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-teal-400"
        style={{
          left: `${pourcent(debutMinute)}%`,
          width: `${pourcent(finMinute) - pourcent(debutMinute)}%`,
        }}
      />

      <input
        type="range"
        min={min}
        max={max}
        step={pas}
        value={debutMinute}
        aria-label={`Début de la plage du ${nomDuJour.toLowerCase()}`}
        aria-valuetext={heureLisible(debutMinute)}
        className={`${commun} ${saisie === "debut" ? "z-20" : "z-10"}`}
        onChange={(event) => {
          const valeur = Math.min(
            Number(event.target.value),
            finMinute - minimum,
          );
          onChange(valeur, finMinute);
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={pas}
        value={finMinute}
        aria-label={`Fin de la plage du ${nomDuJour.toLowerCase()}`}
        aria-valuetext={heureLisible(finMinute)}
        className={`${commun} ${saisie === "fin" ? "z-20" : "z-10"}`}
        onChange={(event) => {
          const valeur = Math.max(
            Number(event.target.value),
            debutMinute + minimum,
          );
          onChange(debutMinute, valeur);
        }}
      />
    </div>
  );
}
