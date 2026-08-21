import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EspaceFerme } from "@/components/espace-ferme";
import { espaceIntervenant } from "@/lib/auth/espaces";
import { facturesDeLIntervenant } from "@/lib/facturation/lecture";
import { formatEuros } from "@/lib/pricing";

/**
 * Mes factures, côté intervenant.
 *
 * **Ce sont les siennes**, même si Léo Clean les a établies pour son compte :
 * il vend sa prestation pour lui-même, et c'est son chiffre d'affaires qu'il
 * déclare. La mention d'autofacturation figure sur chaque document — article
 * 289, I-2 du CGI — et son absence rendrait la facture irrégulière.
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

export default async function FacturesIntervenantPage() {
  const espace = await espaceIntervenant();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect("/connexion?callbackUrl=/intervenant/factures");
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/travailler-avec-nous", libelle: "Nous rejoindre" }}
      />
    );
  }

  const factures = await facturesDeLIntervenant(espace.db, espace.profil.id);

  /* Le cumul par année : c'est ce qu'on reporte sur une déclaration. */
  const parAnnee = new Map<number, number>();
  for (const facture of factures) {
    const annee = new Date(facture.emiseLe).getUTCFullYear();
    parAnnee.set(annee, (parAnnee.get(annee) ?? 0) + facture.totalCents);
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <p className="text-sm">
        <Link href="/intervenant" className="text-primary hover:underline">
          ← Mes missions
        </Link>
      </p>

      <h1 className="mt-4 font-heading text-3xl font-black tracking-tight">
        Mes factures
      </h1>

      {factures.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-border bg-secondary/40 p-6 text-muted-foreground">
          Aucune facture pour le moment. Elles sont établies en votre nom une
          fois chaque mission terminée.
        </p>
      ) : (
        <>
          <p className="mt-2 text-pretty text-muted-foreground">
            Établies en votre nom et pour votre compte, dans une série qui vous
            est propre. C&apos;est votre chiffre d&apos;affaires.
          </p>

          {parAnnee.size > 0 ? (
            <dl className="mt-6 divide-y divide-border border-y border-border">
              {[...parAnnee.entries()]
                .sort((a, b) => b[0] - a[0])
                .map(([annee, total]) => (
                  <div key={annee} className="flex justify-between py-3">
                    <dt className="font-medium">
                      Chiffre d&apos;affaires {annee}
                    </dt>
                    <dd className="font-mono font-semibold tabular-nums">
                      {formatEuros(total)}
                    </dd>
                  </div>
                ))}
            </dl>
          ) : null}

          <ul className="mt-8 divide-y divide-border border-y border-border">
            {factures.map((facture) => (
              <li
                key={facture.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-4"
              >
                <span className="font-mono text-sm">
                  {facture.numero}
                  <span className="ml-2 font-sans text-muted-foreground">
                    {JOUR.format(new Date(facture.emiseLe))}
                  </span>
                </span>
                <span className="flex items-center gap-4">
                  <span className="font-mono font-semibold tabular-nums">
                    {formatEuros(facture.totalCents)}
                  </span>
                  {facture.imprimable ? (
                    <Link
                      href={`/intervenant/factures/${facture.id}`}
                      className="text-sm text-primary underline"
                    >
                      Voir
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
