import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CarteAbonnement } from "@/app/(app)/mon-espace/abonnement/carte";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { lireAbonnements } from "@/lib/abonnement/gestion";
import { JOURS } from "@/lib/availability/semaine";
import { EspaceFerme } from "@/components/espace-ferme";
import { espaceClient } from "@/lib/auth/espaces";

/**
 * Mon abonnement.
 *
 * **La pause vient avant la résiliation, et elle est plus visible.** C'est le
 * principal outil anti-résiliation : la rendre plus difficile à trouver que le
 * bouton qui fait tout perdre serait un choix contre le client autant que
 * contre l'entreprise.
 *
 * Et **aucun frein artificiel** sur la résiliation : pas d'appel obligatoire,
 * pas de délai caché, pas d'étape non numérique. Le motif est demandé parce
 * qu'il décide de ce qu'on propose une fois, sans insister — jamais pour
 * retenir quelqu'un par la fatigue.
 */

export const metadata: Metadata = {
  title: "Mon abonnement",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const LIBELLES_FREQUENCE: Record<string, string> = {
  WEEKLY: "Chaque semaine",
  BIWEEKLY: "Toutes les deux semaines",
  MONTHLY: "Une fois par mois",
  ONE_OFF: "Une seule fois",
};

function heureLisible(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h${m > 0 ? ` ${String(m).padStart(2, "0")}` : ""}`;
}

export default async function AbonnementPage() {
  /*
   * `espaceClient` traduit l'absence d'appartenance en résultat plutôt
   * qu'en exception. Le cas est nominal : un compte se crée sans
   * appartenance, le rattachement se faisant à la première réservation —
   * cette page rendait donc une erreur 500 à qui venait de se connecter.
   */
  const espace = await espaceClient();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect("/connexion?callbackUrl=/mon-espace/abonnement");
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/mon-espace", libelle: "Mes réservations" }}
      />
    );
  }

  const { db, profil } = espace;

  const abonnements = profil ? await lireAbonnements(db, profil.id) : [];

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
          Mon abonnement
        </h1>

        {abonnements.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-border bg-secondary/40 p-6 text-muted-foreground">
            Vous n&apos;avez pas d&apos;abonnement en cours. Un ménage régulier
            se met en place en réservant, et vous gardez le même intervenant
            d&apos;un passage à l&apos;autre.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {abonnements.map((abonnement) => (
              <CarteAbonnement
                key={abonnement.id}
                abonnement={{
                  ...abonnement,
                  frequenceLisible:
                    LIBELLES_FREQUENCE[abonnement.frequence] ??
                    abonnement.frequence,
                  jourLisible:
                    JOURS.find((jour) => jour.valeur === abonnement.jourSemaine)
                      ?.nom ?? "",
                  heureLisible: heureLisible(abonnement.minuteDebut),
                  dureeLisible: heureLisible(abonnement.dureeMinutes),
                }}
              />
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
