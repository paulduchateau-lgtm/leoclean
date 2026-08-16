import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SemaineForm } from "@/app/(app)/intervenant/disponibilites/semaine-form";
import { getCurrentUser, requireOrganization } from "@/lib/auth/session";
import type { Jour, Plage } from "@/lib/availability/semaine";
import { marketplaceOrganizationId } from "@/lib/organizations";
import { SITE } from "@/lib/site";

/**
 * Les heures déclarées d'un intervenant.
 *
 * C'est la source de vérité du moteur de créneaux : rien n'est proposé à un
 * client en dehors de ce qui est déclaré ici. D'où le ton de l'écran — on
 * n'invite pas à « optimiser sa visibilité », on demande quand la personne
 * accepte de travailler.
 */

export const metadata: Metadata = {
  title: "Mes disponibilités",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DisponibilitesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/connexion?callbackUrl=/intervenant/disponibilites");
  }

  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(
    organizationId,
    "availability:manage:own",
  );

  const profil = await db.cleanerProfile.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!profil) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Mes disponibilités
        </h1>
        <p className="mt-4 rounded-xl border border-border bg-secondary/40 p-5 text-muted-foreground">
          Votre compte n&apos;est pas encore rattaché à un profil
          d&apos;intervenant. Appelez-nous au {SITE.phone} si vous pensez
          qu&apos;il s&apos;agit d&apos;une erreur.
        </p>
      </main>
    );
  }

  /*
   * Seules les règles en vigueur sont chargées : `validUntil: null`. Les
   * anciennes restent en base pour expliquer, plus tard, pourquoi telle mission
   * avait été attribuée à telle personne.
   */
  const regles = await db.availabilityRule.findMany({
    where: { cleanerProfileId: profil.id, validUntil: null },
    orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
    select: { weekday: true, startMinute: true, endMinute: true },
  });

  const initiales: Plage[] = regles.map((regle) => ({
    jour: regle.weekday as Jour,
    debutMinute: regle.startMinute,
    finMinute: regle.endMinute,
  }));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <p className="text-sm">
        <Link href="/intervenant" className="text-primary hover:underline">
          ← Mes missions
        </Link>
      </p>

      <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">
        Mes disponibilités
      </h1>
      <p className="mt-3 max-w-prose text-muted-foreground">
        Vous ne recevrez de propositions que sur ces heures-là. Personne
        d&apos;autre ne peut les modifier — ni nous, ni un gestionnaire.
      </p>

      <div className="mt-8">
        <SemaineForm initiales={initiales} />
      </div>
    </main>
  );
}
