import Link from "next/link";

import type { EtatCompte } from "@/lib/cleaner/etat-compte";

/**
 * L'état du compte, en haut de chaque écran de l'espace intervenant.
 *
 * **Vert ou rouge, et jamais autre chose.** Un intervenant a une seule question
 * en ouvrant l'application : est-ce que je peux travailler ? Une pastille
 * orange, un « en cours », un pourcentage d'avancement répondent à côté.
 *
 * **Le bandeau est cliquable quand un geste existe, et seulement alors.** Un
 * badge rouge qui ne mène nulle part est une punition ; celui-ci porte l'écran
 * où réparer. Quand rien ne peut être fait soi-même — suspension décidée par
 * la plateforme, compte clos — il reste un bloc de texte, et la phrase dit
 * d'appeler.
 */
export function BandeauStatut({ etat }: { etat: EtatCompte }) {
  const contenu = (
    <>
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={`size-2.5 shrink-0 rounded-full ${
            etat.actif ? "bg-success" : "bg-destructive"
          }`}
        />
        <span className="font-extrabold">{etat.libelle}</span>
      </span>
      <span className="text-sm text-pretty">{etat.explication}</span>
      {etat.action ? (
        <span className="text-sm font-bold underline underline-offset-4">
          {etat.action.libelle} →
        </span>
      ) : null}
    </>
  );

  const classes = `flex flex-col gap-1.5 rounded-[var(--r-l)] border-2 p-4 ${
    etat.actif
      ? "border-success/40 bg-success/10"
      : "border-destructive/40 bg-destructive/10"
  }`;

  if (!etat.action) {
    return (
      <div className={classes} role="status">
        {contenu}
      </div>
    );
  }

  return (
    <Link
      href={etat.action.href}
      className={`${classes} transition-colors hover:border-destructive/70`}
    >
      {contenu}
    </Link>
  );
}
