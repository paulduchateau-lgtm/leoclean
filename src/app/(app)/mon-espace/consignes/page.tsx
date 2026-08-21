import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FormulaireConsignes } from "@/app/(app)/mon-espace/consignes/formulaire";
import { EspaceFerme } from "@/components/espace-ferme";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { espaceClient } from "@/lib/auth/espaces";
import { lireLesLogements } from "@/lib/logement/instructions";

/**
 * Les consignes du logement, écrites en répondant à des questions.
 *
 * **Le modèle existait, la donnée n'avait pas de porte d'entrée.** `Address`
 * portait déjà zones interdites, animaux, matériel et checklist ; seul l'écran
 * de mission les lisait, et aucun écran ne permettait de les remplir. Cette
 * page est cette porte.
 *
 * **Un logement à la fois, tous affichés.** Un client peut en avoir plusieurs —
 * son domicile, celui d'un parent — et le four de l'un n'est pas celui de
 * l'autre. Les fondre en un seul jeu de consignes produirait une instruction
 * fausse dans la moitié des cas.
 */

export const metadata: Metadata = {
  title: "Consignes pour l'intervenant",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ConsignesPage() {
  const espace = await espaceClient();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect("/connexion?callbackUrl=/mon-espace/consignes");
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/mon-compte", libelle: "Mon compte" }}
      />
    );
  }

  const { db, user } = espace;
  const logements = await lireLesLogements(db, user.id);

  return (
    <>
      <SiteHeader variant="tunnel" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <p className="text-sm">
          <Link href="/mon-compte" className="text-brand hover:underline">
            ← Mon compte
          </Link>
        </p>

        <h1 className="mt-4 font-heading text-3xl font-black tracking-tight">
          Consignes pour l&apos;intervenant
        </h1>
        <p className="mt-3 max-w-prose text-pretty text-muted-foreground">
          Quelques questions pour dire ce qu&apos;un champ libre ne dit jamais :
          le produit des façades, le rythme des vitres, la pièce dont on
          n&apos;ouvre pas la porte. Répondez à ce que vous voulez, quand vous
          voulez — vos réponses suivent d&apos;un passage à l&apos;autre et
          l&apos;intervenant les lit avant de venir.
        </p>

        {logements.length === 0 ? (
          <p className="mt-8 rounded-[var(--r-l)] border border-border bg-secondary/40 p-6 text-muted-foreground">
            Vos consignes se rattachent à un logement, et vous n&apos;en avez
            pas encore. Elles vous seront proposées après votre première
            réservation.
          </p>
        ) : (
          logements.map((logement) => (
            <FormulaireConsignes
              key={logement.addressId}
              addressId={logement.addressId}
              libelle={logement.libelle}
              initiales={logement.consignes}
            />
          ))
        )}
      </main>

      <SiteFooter />
    </>
  );
}
