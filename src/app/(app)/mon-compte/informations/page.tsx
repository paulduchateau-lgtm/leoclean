import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Formulaire } from "@/app/(app)/mon-compte/informations/formulaire";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser, requireOrganization } from "@/lib/auth/session";
import { lireLesInformations } from "@/lib/compte/informations";
import { marketplaceOrganizationId } from "@/lib/organizations";

/**
 * Informations personnelles.
 *
 * Ce que la personne corrige elle-même, et rien de plus. **L'adresse email n'y
 * est pas modifiable** : elle identifie le compte et reçoit les liens de
 * connexion, si bien que la changer sur simple saisie permettrait de détourner
 * un compte depuis un poste laissé ouvert.
 */

export const metadata: Metadata = {
  title: "Informations personnelles",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InformationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?callbackUrl=/mon-compte/informations");

  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(organizationId, "booking:read:own");
  const informations = await lireLesInformations(db, user.id);

  return (
    <>
      <SiteHeader variant="tunnel" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <p className="text-sm">
          <Link href="/mon-compte" className="text-primary hover:underline">
            ← Mon compte
          </Link>
        </p>

        <h1 className="mt-4 font-heading text-3xl font-black tracking-tight">
          Informations personnelles
        </h1>

        {informations ? (
          <Formulaire informations={informations} />
        ) : (
          <p className="mt-6 rounded-2xl border border-border bg-secondary/40 p-6 text-muted-foreground">
            Votre compte n&apos;a pas encore d&apos;espace client. Il en aura un
            à votre première réservation.
          </p>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
