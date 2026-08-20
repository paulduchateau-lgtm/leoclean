import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FormulaireAvis } from "@/app/(app)/mon-espace/noter/formulaire";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser, requireOrganization } from "@/lib/auth/session";
import { interventionsANoter } from "@/lib/mission/avis";
import { DELAI_NOTATION_JOURS } from "@/lib/mission/notation";
import { marketplaceOrganizationId } from "@/lib/organizations";

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
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?callbackUrl=/mon-espace/noter");

  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(organizationId, "booking:read:own");

  const profil = await db.clientProfile.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });

  const interventions = profil
    ? await interventionsANoter(db, profil.id, new Date(), DELAI_NOTATION_JOURS)
    : [];

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
