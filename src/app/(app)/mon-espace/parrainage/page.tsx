import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ParrainagePanneau } from "@/components/parrainage-panneau";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser, requireOrganization } from "@/lib/auth/session";
import { marketplaceOrganizationId } from "@/lib/organizations";
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
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?callbackUrl=/mon-espace/parrainage");

  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(organizationId, "booking:read:own");

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
          <Link href="/mon-espace" className="text-primary hover:underline">
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
