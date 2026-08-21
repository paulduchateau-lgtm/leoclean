import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ParrainagePanneau } from "@/components/parrainage-panneau";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { EspaceFerme } from "@/components/espace-ferme";
import { espaceClient } from "@/lib/auth/espaces";
import { reglesLisibles } from "@/lib/referral/annonce";
import { lireLeParrainage, programme } from "@/lib/referral/espace";
import { absoluteUrl } from "@/lib/site";

/**
 * Parrainer, côté client.
 *
 * Une heure de ménage offerte en avoir, une seule fois, dès la première
 * prestation du filleul. Le programme est lu dans `rules.ts` et les phrases
 * sont engendrées : rien de ce qui est affiché ici n'est écrit à la main.
 */

export const metadata: Metadata = {
  title: "Parrainage",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ParrainagePage() {
  /*
   * `espaceClient` traduit l'absence d'appartenance en résultat plutôt
   * qu'en exception. Le cas est nominal : un compte se crée sans
   * appartenance, le rattachement se faisant à la première réservation —
   * cette page rendait donc une erreur 500 à qui venait de se connecter.
   */
  const espace = await espaceClient();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect("/connexion?callbackUrl=/mon-espace/parrainage");
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/mon-espace", libelle: "Mes réservations" }}
      />
    );
  }

  const { db, user, organizationId } = espace;
  const vue = await lireLeParrainage(
    db,
    organizationId,
    user.id,
    "CLIENT",
    user.name ?? undefined,
  );
  const regles = reglesLisibles(programme("CLIENT"));

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
          Parrainage
        </h1>
        <p className="mt-2 text-pretty text-muted-foreground">
          Votre voisine cherche quelqu&apos;un de confiance ? Donnez-lui votre
          code : elle y gagne, vous aussi.
        </p>

        <div className="mt-8">
          <ParrainagePanneau
            code={vue.code}
            lien={absoluteUrl(`/reserver?parrain=${vue.code}`)}
            messageDePartage="Je fais appel à Léo Clean pour le ménage, je te recommande. Avec mon code tu as une réduction sur ton premier ménage :"
            filleuls={vue.filleuls}
            enAttenteCents={vue.enAttenteCents}
            verseCents={vue.verseCents}
            seuil={programme("CLIENT").qualifyingCompletedBookings}
            regles={regles}
          />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
