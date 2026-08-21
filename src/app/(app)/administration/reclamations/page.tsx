import type { Metadata } from "next";
import Link from "next/link";

import { CarteReclamation } from "@/app/(app)/administration/reclamations/carte";
import { lireLesReclamations } from "@/lib/administration/reclamations";
import { asPlatformAdmin } from "@/lib/auth/session";

/**
 * Réclamations.
 *
 * **Les plus anciennes d'abord.** Une réclamation qui vieillit est celle qui se
 * transforme en avis public, en litige, ou en départ ; la trier par date
 * décroissante laisserait au fond exactement celles qui coûtent.
 */

export const metadata: Metadata = {
  title: "Réclamations",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ReclamationsPage() {
  await asPlatformAdmin();

  const [ouvertes, closes] = await Promise.all([
    lireLesReclamations(false),
    lireLesReclamations(true, 20),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <p className="text-sm">
        <Link href="/administration" className="text-primary hover:underline">
          ← Le travail du jour
        </Link>
      </p>

      <h1 className="mt-3 font-heading text-3xl font-black tracking-tight">
        Réclamations
      </h1>
      <p className="mt-2 text-muted-foreground">
        {ouvertes.length} ouverte{ouvertes.length > 1 ? "s" : ""}
      </p>

      {ouvertes.length === 0 ? (
        <p className="mt-8 rounded-xl border border-border bg-secondary/40 p-6 text-muted-foreground">
          Rien en attente.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {ouvertes.map((reclamation) => (
            <CarteReclamation key={reclamation.id} reclamation={reclamation} />
          ))}
        </div>
      )}

      {closes.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-heading text-lg font-extrabold">
            Closes récemment
          </h2>
          <ul className="mt-3 divide-y divide-border border-y border-border text-sm">
            {closes.map((reclamation) => (
              <li key={reclamation.id} className="py-3">
                <p>
                  <span className="font-medium">{reclamation.client}</span> ·{" "}
                  <span className="text-muted-foreground">
                    {reclamation.categorie.toLowerCase()} ·{" "}
                    {reclamation.statut === "RESOLUE"
                      ? "résolue"
                      : "classée sans suite"}
                  </span>
                </p>
                {reclamation.resolution ? (
                  <p className="mt-0.5 text-pretty text-muted-foreground">
                    {reclamation.resolution}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
