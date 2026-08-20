import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { rattacherLeDossier } from "@/app/rejoindre/actions";
import { SuiviDossier } from "@/app/rejoindre/dossier/suivi";
import { getCurrentUser } from "@/lib/auth/session";
import { lireDossier } from "@/lib/candidature/dossier";
import {
  LIBELLES_PIECES,
  PIECES,
  PIECES_ENGENDRABLES,
} from "@/lib/candidature/parcours";
import { SITE } from "@/lib/site";
import { stockageConfigure } from "@/lib/stockage/resolution";

/**
 * Où en est mon dossier.
 *
 * **Une seule question à la fois, et toujours la suivante.** Le candidat n'a
 * pas à lire une liste de six manques pour comprendre ce qu'on attend de lui :
 * `ceQuiManque` rend la liste dans l'ordre où on la demandera, et l'écran met
 * le premier élément en avant.
 *
 * La barre de progression ne recule jamais — c'est une garantie de
 * `progression`, pas une précaution d'affichage : quelqu'un qui découvre qu'il
 * doit créer une auto-entreprise lirait « votre dossier a régressé » au moment
 * précis où il a besoin d'être rassuré.
 */

export const metadata: Metadata = {
  title: "Mon dossier",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DossierPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?callbackUrl=/rejoindre/dossier");

  /*
   * L'éligibilité se passe sans compte — c'est ce qui la rend franchissable —
   * et le lien magique crée le compte ensuite. Le rapprochement se fait ici,
   * sur la première page que le lien ouvre : sans lui, `lireDossier` ne
   * trouverait rien et le candidat croirait avoir tout perdu.
   */
  await rattacherLeDossier();

  const dossier = await lireDossier(user.id);

  if (!dossier) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="font-heading text-3xl font-black tracking-tight">
          Aucun dossier à votre nom
        </h1>
        <p className="mt-4 text-pretty text-muted-foreground">
          Votre candidature n&apos;a pas encore été ouverte, ou elle l&apos;a
          été avec une autre adresse email. Vous pouvez la commencer maintenant,
          ou nous appeler au {SITE.phone}.
        </p>
        <Link
          href="/rejoindre"
          className="mt-6 inline-flex min-h-12 items-center rounded-full bg-primary px-6 font-bold text-primary-foreground"
        >
          Commencer ma candidature
        </Link>
      </main>
    );
  }

  const pieces = PIECES.map((kind) => {
    const depose = dossier.pieces.find((piece) => piece.kind === kind);
    return {
      kind,
      libelle: LIBELLES_PIECES[kind],
      statut: depose?.status ?? "ATTENDUE",
      motif: depose?.motif ?? null,
      /* L'avis SIRENE est engendré depuis l'API : on ne le demande pas. */
      engendree: PIECES_ENGENDRABLES.includes(kind),
    };
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="font-heading text-3xl font-black tracking-tight">
        {dossier.prenom ? `Bonjour ${dossier.prenom}` : "Mon dossier"}
      </h1>

      <SuiviDossier
        dossier={dossier}
        pieces={pieces}
        depotOuvert={stockageConfigure()}
        telephone={SITE.phone}
      />
    </main>
  );
}
