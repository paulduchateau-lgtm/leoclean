import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Identifiants } from "@/app/(app)/mon-compte/connexion/identifiants";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { FOURNISSEURS_ACTIFS } from "@/lib/auth/fournisseurs";
import { lireLetatDeConnexion } from "@/lib/auth/identifiants";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Connexion et sécurité.
 *
 * Trois choses, dans l'ordre de ce qu'on vient y faire : poser ou changer son
 * mot de passe, voir par quels comptes on peut entrer, couper l'accès de tous
 * les appareils.
 *
 * **Le lien de connexion n'est jamais présenté comme un repli.** C'est le
 * chemin d'origine, il fonctionne toujours, et c'est lui qui tient lieu de
 * « mot de passe oublié » — le dire clairement évite qu'on cherche un parcours
 * de récupération qui n'existe pas.
 */

export const metadata: Metadata = {
  title: "Connexion et sécurité",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ConnexionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?callbackUrl=/mon-compte/connexion");

  const etat = await lireLetatDeConnexion(user.id);

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
          Connexion et sécurité
        </h1>
        <p className="mt-2 text-muted-foreground">{user.email}</p>

        <Identifiants
          etat={etat}
          fournisseursDisponibles={FOURNISSEURS_ACTIFS}
        />
      </main>

      <SiteFooter />
    </>
  );
}
