import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EspaceFerme } from "@/components/espace-ferme";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { espaceClient } from "@/lib/auth/espaces";
import { facturesDuClient } from "@/lib/facturation/lecture";
import { formatEuros } from "@/lib/pricing";

/**
 * Mes factures.
 *
 * **Deux factures par prestation**, et la page ne le cache pas : Léo Clean est
 * un opérateur de mise en relation, l'intervenant vend sa prestation pour son
 * propre compte. Les fondre en une seule ligne serait plus simple à lire et
 * ferait de la plateforme le prestataire, ce qu'elle n'est pas.
 */

export const metadata: Metadata = {
  title: "Mes factures",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const JOUR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export default async function FacturesPage() {
  const espace = await espaceClient();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect("/connexion?callbackUrl=/mon-compte/factures");
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/mon-compte", libelle: "Mon compte" }}
      />
    );
  }

  const factures = await facturesDuClient(espace.db, espace.profil.id);

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
          Mes factures
        </h1>

        {factures.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-border bg-secondary/40 p-6 text-muted-foreground">
            Aucune facture pour le moment. Elles sont établies une fois le
            ménage terminé.
          </p>
        ) : (
          <>
            <p className="mt-2 text-pretty text-muted-foreground">
              Chaque intervention donne deux factures : celle de votre
              intervenant pour le ménage, la nôtre pour la coordination. Leur
              somme est le prix que vous avez réglé.
            </p>

            <ul className="mt-6 divide-y divide-border border-y border-border">
              {factures.map((facture) => (
                <li
                  key={facture.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-4"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {facture.emetteur}
                    </span>
                    <span className="block font-mono text-sm text-muted-foreground">
                      {facture.numero} ·{" "}
                      {JOUR.format(new Date(facture.emiseLe))}
                    </span>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="font-mono font-semibold tabular-nums">
                      {formatEuros(facture.totalCents)}
                    </span>
                    {facture.imprimable ? (
                      <Link
                        href={`/mon-compte/factures/${facture.id}`}
                        className="text-sm text-primary underline"
                      >
                        Voir
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        indisponible
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
