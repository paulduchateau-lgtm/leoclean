import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SemaineForm } from "@/app/(app)/intervenant/disponibilites/semaine-form";
import { EspaceFerme } from "@/components/espace-ferme";
import { espaceIntervenant } from "@/lib/auth/espaces";
import type { Jour, Plage } from "@/lib/availability/semaine";

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
  /*
   * `espaceIntervenant` traduit l'absence d'appartenance en résultat
   * plutôt qu'en exception : `requireOrganization` lève, et l'exception
   * remontait jusqu'au rendu — une erreur 500 sur un état parfaitement
   * ordinaire du produit.
   */
  const espace = await espaceIntervenant();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect("/connexion?callbackUrl=/intervenant/disponibilites");
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/travailler-avec-nous", libelle: "Nous rejoindre" }}
      />
    );
  }

  const { db, profil } = espace;

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
