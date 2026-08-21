import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FormulaireAvis } from "@/app/(app)/mon-espace/noter/formulaire";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { EspaceFerme } from "@/components/espace-ferme";
import { espaceClient } from "@/lib/auth/espaces";
import { interventionsANoter } from "@/lib/mission/avis";
import { DELAI_NOTATION_JOURS } from "@/lib/mission/notation";

/**
 * Noter ses interventions.
 *
 * Une page plutôt qu'une notification isolée : le client arrive souvent avec
 * deux ou trois ménages en retard de notation, et lui en présenter un seul le
 * ferait revenir autant de fois qu'il en reste.
 */

export const metadata: Metadata = {
  title: "Noter mes interventions",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NoterPage() {
  /*
   * `espaceClient` traduit l'absence d'appartenance en résultat plutôt
   * qu'en exception. Le cas est nominal : un compte se crée sans
   * appartenance, le rattachement se faisant à la première réservation —
   * cette page rendait donc une erreur 500 à qui venait de se connecter.
   */
  const espace = await espaceClient();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect("/connexion?callbackUrl=/mon-espace/noter");
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/mon-espace", libelle: "Mes réservations" }}
      />
    );
  }

  const { db, profil } = espace;

  const interventions = profil
    ? await interventionsANoter(db, profil.id, new Date(), DELAI_NOTATION_JOURS)
    : [];

  return (
    <>
      <SiteHeader variant="tunnel" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <p className="text-sm">
          <Link href="/mon-espace" className="text-brand hover:underline">
            ← Mes réservations
          </Link>
        </p>

        <h1 className="mt-4 font-heading text-3xl font-black tracking-tight">
          Noter mes interventions
        </h1>

        {interventions.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-border bg-secondary/40 p-6 text-muted-foreground">
            Rien à noter pour le moment. On vous le proposera après votre
            prochain ménage — vous avez {DELAI_NOTATION_JOURS} jours pour
            répondre.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {interventions.map((intervention) => (
              <FormulaireAvis
                key={intervention.bookingId}
                intervention={intervention}
              />
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
