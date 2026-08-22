"use client";

import { ChevronLeftIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Un écran de tunnel, dans le langage d'une application mobile.
 *
 * **La progression est une barre, pas une phrase.** « Question 3 sur 6 » se lit
 * — donc se compte, donc se compare à ce qu'on a déjà donné. Une barre se
 * perçoit sans lecture, et c'est tout ce qu'on demande d'elle : dire qu'il en
 * reste peu. Le décompte reste dans le nom accessible, pour qui ne voit pas la
 * barre.
 *
 * **Le retour est un chevron collé à la barre**, à la place où le pouce le
 * cherche et où le système d'exploitation le met. Un lien « ← Revenir » en bas
 * d'écran est le dernier endroit où on le trouve.
 *
 * **L'écran est plein sur mobile, encadré au-delà.** Une carte dans une carte
 * fait deux cadres à l'endroit où il n'y a rien d'autre à regarder ; la même
 * carte sur un écran large empêche la ligne de courir sur toute la largeur.
 */
export function EcranTunnel({
  titre,
  sousTitre,
  etape,
  total,
  onRetour,
  action,
  children,
  titrePrincipal = false,
}: {
  titre: string;
  /**
   * La question est-elle le titre de la page ?
   *
   * Sur un écran qui ne porte que le tunnel, elle l'est : poser un `h1`
   * décoratif au-dessus donnerait à lire deux titres là où il n'y a qu'une
   * question, et laisser la page sans `h1` du tout la rendrait muette au
   * lecteur d'écran comme au robot.
   */
  titrePrincipal?: boolean;
  sousTitre?: ReactNode;
  /** Rang de l'écran, à partir de 1. */
  etape: number;
  total: number;
  /** Absent, le chevron ne s'affiche pas — on est au premier écran. */
  onRetour?: () => void;
  /** Le geste qui fait avancer, posé sous le contenu et centré. */
  action?: ReactNode;
  children: ReactNode;
}) {
  const Titre = titrePrincipal ? "h1" : "h2";

  return (
    <div className="w-full sm:rounded-[var(--r-xl)] sm:border sm:border-border sm:bg-card sm:p-8">
      <div className="flex items-center gap-3">
        {onRetour ? (
          <button
            type="button"
            onClick={onRetour}
            aria-label="Revenir à l'écran précédent"
            className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-700 transition-colors hover:bg-secondary"
          >
            <ChevronLeftIcon className="size-6" aria-hidden="true" />
          </button>
        ) : (
          <span aria-hidden="true" className="-ml-2 size-11 shrink-0" />
        )}
        <div
          role="progressbar"
          aria-valuenow={etape}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={`Étape ${etape} sur ${total}`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
        >
          <div
            className="h-full rounded-full bg-ink-900 transition-[width] duration-300"
            style={{ width: `${Math.round((etape / total) * 100)}%` }}
          />
        </div>
      </div>

      <Titre className="mt-6 font-heading text-3xl font-extrabold text-balance">
        {titre}
      </Titre>
      {sousTitre ? (
        <p className="mt-2 text-pretty text-muted-foreground">{sousTitre}</p>
      ) : null}

      <div className="mt-6">{children}</div>

      {action ? (
        <div className="mt-8 flex justify-center [&>*]:min-w-52">{action}</div>
      ) : null}
    </div>
  );
}

/**
 * Le champ doux d'un tunnel : rempli, sans trait, généreux.
 *
 * Un contour de 1 pixel demande de le viser ; une surface pleine se tape. La
 * hauteur est au-dessus du gabarit tactile de 44 px du système de design, parce
 * qu'un écran qui ne porte qu'une question peut se le permettre.
 */
export const CHAMP_DOUX =
  "min-h-14 w-full rounded-[var(--r-l)] border-0 bg-secondary px-4 text-base outline-none placeholder:text-ink-500 focus-visible:ring-2 focus-visible:ring-teal-600";

/**
 * Un choix d'un écran de tunnel : la même surface pleine, alignée à gauche.
 *
 * `aria-pressed` plutôt qu'un radio : le choix fait avancer, il ne se coche pas
 * pour être validé ensuite.
 */
export function ChoixTunnel({
  libelle,
  actif = false,
  onClick,
}: {
  libelle: string;
  actif?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`min-h-14 w-full rounded-[var(--r-l)] px-4 text-left text-base font-medium transition-colors ${
        actif
          ? "bg-teal-400 text-ink-900"
          : "bg-secondary hover:bg-teal-100 active:bg-teal-100"
      }`}
    >
      {libelle}
    </button>
  );
}
