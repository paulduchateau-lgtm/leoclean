import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ParrainagePanneau } from "@/components/parrainage-panneau";
import { EspaceFerme } from "@/components/espace-ferme";
import { espaceIntervenant } from "@/lib/auth/espaces";
import { reglesLisibles } from "@/lib/referral/annonce";
import { lireLeParrainage, programme } from "@/lib/referral/espace";
import { absoluteUrl } from "@/lib/site";

/**
 * Coopter, côté intervenant.
 *
 * 5 % du chiffre d'affaires du filleul, pendant douze mois, plafonné. Un seul
 * niveau, et il n'est pas seulement interdit : il est **inexprimable** —
 * `Referral` ne porte aucune colonne de parrain, on remonte par
 * `referralCode.ownerUserId`. C'est la seule forme solide de l'interdit posé
 * par l'article L.121-15.
 */

export const metadata: Metadata = {
  title: "Coopter un collègue",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CooptationPage() {
  /*
   * `espaceIntervenant` traduit l'absence d'appartenance en résultat
   * plutôt qu'en exception : `requireOrganization` lève, et l'exception
   * remontait jusqu'au rendu — une erreur 500 sur un état parfaitement
   * ordinaire du produit.
   */
  const espace = await espaceIntervenant();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect("/connexion?callbackUrl=/intervenant/cooptation");
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/travailler-avec-nous", libelle: "Nous rejoindre" }}
      />
    );
  }

  const { db, user, organizationId } = espace;
  const vue = await lireLeParrainage(
    db,
    organizationId,
    user.id,
    "CLEANER",
    user.name ?? undefined,
  );
  const regles = reglesLisibles(programme("CLEANER"));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <p className="text-sm">
        <Link href="/intervenant" className="text-primary hover:underline">
          ← Mes missions
        </Link>
      </p>

      <h1 className="mt-4 font-heading text-3xl font-black tracking-tight">
        Coopter un collègue
      </h1>
      <p className="mt-2 text-pretty text-muted-foreground">
        Vous connaissez quelqu&apos;un de sérieux sur le secteur ? Plus nous
        sommes nombreux à couvrir le même rayon, moins chacun passe de temps en
        voiture.
      </p>

      <div className="mt-8">
        <ParrainagePanneau
          code={vue.code}
          lien={absoluteUrl(`/rejoindre?parrain=${vue.code}`)}
          messageDePartage="Je travaille avec Léo Clean sur le sud de Bordeaux. Si ça t'intéresse, voici mon code :"
          filleuls={vue.filleuls}
          enAttenteCents={vue.enAttenteCents}
          verseCents={vue.verseCents}
          seuil={programme("CLEANER").qualifyingCompletedBookings}
          regles={regles}
        />
      </div>
    </main>
  );
}
