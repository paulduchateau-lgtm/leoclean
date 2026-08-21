import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { auth, signOut } from "@/lib/auth/config";
import { composerLeMenu } from "@/lib/compte/menu";
import { prisma } from "@/lib/db";
import { canShowTaxCredit } from "@/lib/fiscal";

/**
 * Mon compte.
 *
 * Un sommaire, pas un tableau de bord : on y vient pour atteindre un réglage,
 * jamais pour lire. Les réservations vivent à côté, sur la page qu'un client
 * ouvre réellement tous les jours.
 *
 * **Ce qui n'existe pas n'apparaît pas.** `compte/menu.ts` est pur et compose
 * la liste à partir de ce qui est réellement disponible ; un test lui interdit
 * de proposer une fonction que le produit n'a pas, et de prononcer le mot
 * « fiscal » tant que la déclaration SAP n'est pas obtenue. Une entrée qui
 * déçoit apprend à ne plus faire confiance au menu, et le menu entier perd sa
 * valeur pour une ligne de trop.
 */

export const metadata: Metadata = {
  title: "Mon compte",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();

  // Le proxy a déjà écarté les visiteurs sans cookie ; ce contrôle-ci est
  // celui qui fait foi, sur une session réellement validée.
  if (!session?.user?.id) {
    redirect("/connexion?callbackUrl=/mon-compte");
  }

  const userId = session.user.id;

  /*
   * Deux comptages plutôt que deux chargements : le menu n'a besoin de savoir
   * que si la fonction a lieu d'être proposée, pas de son contenu.
   */
  const [abonnements, profilIntervenant] = await Promise.all([
    prisma.subscription.count({
      where: { clientProfile: { userId }, status: { not: "CANCELLED" } },
    }),
    prisma.cleanerProfile.count({ where: { userId } }),
  ]);

  const groupes = composerLeMenu({
    attestationsFiscales: canShowTaxCredit(),
    abonnement: abonnements > 0,
    administrateurPlateforme: session.user.memberships.some(
      (appartenance) => appartenance.role === "PLATFORM_ADMIN",
    ),
    intervenant: profilIntervenant > 0,
  });

  return (
    <>
      <SiteHeader variant="tunnel" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="font-heading text-3xl font-black tracking-tight">
          Mon compte
        </h1>
        <p className="mt-2 text-muted-foreground">{session.user.email}</p>

        <Link
          href="/mon-espace"
          data-booking-cta
          className="mt-6 inline-flex min-h-12 items-center rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-pineapple-400 hover:shadow-action"
        >
          Voir mes réservations
        </Link>

        {groupes.map((groupe) => (
          <section key={groupe.titre} className="mt-10">
            <h2 className="text-xs tracking-overline text-muted-foreground uppercase">
              {groupe.titre}
            </h2>

            <ul className="mt-3 divide-y divide-border border-y border-border">
              {groupe.entrees.map((entree) => (
                <li key={entree.id}>
                  <Link
                    href={entree.href}
                    className="flex min-h-16 items-center gap-4 py-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {entree.libelle}
                      </span>
                      {entree.detail ? (
                        <span className="mt-0.5 block text-sm text-pretty text-muted-foreground">
                          {entree.detail}
                        </span>
                      ) : null}
                    </span>
                    <ChevronRightIcon
                      className="size-5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <form
          className="mt-12"
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

      <SiteFooter />
    </>
  );
}
