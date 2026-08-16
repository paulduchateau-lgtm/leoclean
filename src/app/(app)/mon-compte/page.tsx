import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { auth, signOut } from "@/lib/auth/config";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Mon compte",
  robots: { index: false, follow: false },
};

/** Libellés destinés aux personnes, pas aux développeurs. */
const ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: "Administration Léo Clean",
  ORG_OWNER: "Responsable",
  ORG_MANAGER: "Gestion",
  CLEANER: "Intervenant",
  CLIENT: "Client",
};

export default async function AccountPage() {
  const session = await auth();

  // Le proxy a déjà écarté les visiteurs sans cookie ; ce contrôle-ci est
  // celui qui fait foi, sur une session réellement validée.
  if (!session?.user?.id) {
    redirect("/connexion?callbackUrl=/mon-compte");
  }

  const memberships = session.user.memberships;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-black tracking-tight">Mon compte</h1>
      <p className="mt-2 text-muted-foreground">{session.user.email}</p>

      <section className="mt-10">
        <h2 className="text-lg font-extrabold">Mes accès</h2>

        {memberships.length === 0 ? (
          /* Un état vide sans issue est un bug : celui-ci dit ce qui manque et
             donne le geste qui le comble. */
          <div className="mt-3 rounded-lg border border-border bg-secondary/40 p-5">
            <p className="text-sm text-muted-foreground">
              Votre compte n&apos;est rattaché à aucun espace pour
              l&apos;instant. Il le sera à votre première réservation.
            </p>
            <Link
              href="/reserver"
              className="mt-4 inline-flex min-h-12 items-center rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-mint-500 hover:shadow-mint"
            >
              Réserver un ménage
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {memberships.map((membership) => (
              <li
                key={membership.organizationId}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
              >
                <span className="font-medium">
                  {membership.organizationName}
                </span>
                <Badge variant="secondary">
                  {ROLE_LABELS[membership.role] ?? membership.role}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        className="mt-10"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <Button type="submit" variant="outline">
          Me déconnecter
        </Button>
      </form>
    </main>
  );
}
