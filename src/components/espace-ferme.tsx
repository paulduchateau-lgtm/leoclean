import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { RefusEspace } from "@/lib/auth/espaces";
import { SITE } from "@/lib/site";

/**
 * Ce qu'on affiche quand un espace n'est pas le vôtre.
 *
 * **Trois refus, trois phrases différentes**, parce qu'ils appellent trois
 * gestes différents : réserver, appeler, ou rien. Une page unique disant « accès
 * refusé » ferait appeler les trois, et deux appels sur trois seraient évitables.
 *
 * Aucun n'est une erreur au sens technique : ce sont des états ordinaires du
 * produit — un compte se crée sans appartenance, le rattachement se faisant à la
 * première réservation. Les rendre en 500 faisait passer le fonctionnement
 * normal pour une panne.
 */

const PHRASES: Record<
  Exclude<RefusEspace, "NON_CONNECTE">,
  { titre: string; corps: string }
> = {
  SANS_ACCES: {
    titre: "Cet espace n'est pas le vôtre",
    corps:
      "Votre compte n'a pas accès à cette partie du site. Si vous pensez que c'est une erreur, appelez-nous : on regarde tout de suite.",
  },
  SANS_PROFIL: {
    titre: "Il n'y a encore rien ici",
    corps:
      "Votre espace se remplira à votre première réservation. Rien n'est perdu : vous retrouverez tout ici ensuite.",
  },
};

export function EspaceFerme({
  refus,
  retour,
}: {
  refus: Exclude<RefusEspace, "NON_CONNECTE">;
  /** Le geste qui a du sens depuis ici. */
  retour?: { href: string; libelle: string };
}) {
  const { titre, corps } = PHRASES[refus];

  return (
    <>
      <SiteHeader variant="tunnel" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="font-heading text-3xl font-black tracking-tight">
          {titre}
        </h1>
        <p className="mt-4 max-w-prose text-pretty text-muted-foreground">
          {corps}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          {/*
           * Un état vide sans issue est un bug : celui-ci porte toujours un
           * geste, et le téléphone en second recours.
           */}
          <Link
            href={retour?.href ?? "/reserver"}
            className="inline-flex min-h-12 items-center rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-xs"
          >
            {retour?.libelle ?? "Réserver un ménage"}
          </Link>
          <a href={`tel:${SITE.phoneE164}`} className="text-brand underline">
            Ou appelez le {SITE.phone}
          </a>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
