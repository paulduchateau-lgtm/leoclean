import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MesDonnees } from "@/app/(app)/mon-compte/mes-donnees/mes-donnees";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Droits d'accès et d'effacement, à l'endroit où on les cherche.
 *
 * La page dit ce qui sera effacé et ce qui devra être conservé **avant** le
 * geste, pas après. Une suppression de compte qui laisserait croire à un
 * effacement total serait un mensonge tenu à l'écran et démenti en base.
 */

export const metadata: Metadata = {
  title: "Mes données personnelles",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MesDonneesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/connexion?callbackUrl=/mon-compte/mes-donnees");
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <p className="text-sm">
        <Link href="/mon-compte" className="text-brand hover:underline">
          ← Mon compte
        </Link>
      </p>

      <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">
        Mes données personnelles
      </h1>
      <p className="mt-3 max-w-prose text-muted-foreground">
        Le règlement européen vous donne deux droits sur vos données : en
        obtenir une copie, et en demander l&apos;effacement. Les deux
        s&apos;exercent ici, sans avoir à nous écrire.
      </p>

      <div className="mt-10">
        <MesDonnees />
      </div>
    </main>
  );
}
