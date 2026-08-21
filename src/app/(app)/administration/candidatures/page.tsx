import type { Metadata } from "next";
import Link from "next/link";

import { FicheCandidature } from "@/app/(app)/administration/candidatures/fiche";
import { asPlatformAdmin } from "@/lib/auth/session";
import { LIBELLES_SIGNAUX } from "@/lib/candidature/parcours";
import { dossiersEnRevue } from "@/lib/candidature/revue";

/**
 * Revue des candidatures.
 *
 * **Du plus ancien au plus récent, et ce n'est pas cosmétique** : traiter le
 * plus récent d'abord laisse indéfiniment au fond de la pile celui qui attend
 * depuis trois semaines, et c'est celui-là qu'on perd.
 *
 * Les signaux d'attention sont affichés **hors de toute note**. Un doublon
 * d'IBAN ne se compense pas par de bons points ailleurs : les mêler à un score
 * ferait passer une fraude derrière une bonne moyenne.
 */

export const metadata: Metadata = {
  title: "Candidatures",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CandidaturesPage() {
  /* Vérifié à l'entrée de la page, là où cela se lit. */
  await asPlatformAdmin();

  const dossiers = await dossiersEnRevue();
  const bloques = dossiers.filter(
    (dossier) => dossier.signauxBloquants.length > 0,
  );
  const prets = dossiers.filter(
    (dossier) => dossier.activable && dossier.signauxBloquants.length === 0,
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <p className="text-sm">
        <Link href="/administration" className="text-primary hover:underline">
          ← Le travail du jour
        </Link>
      </p>

      <h1 className="mt-3 font-heading text-3xl font-black tracking-tight">
        Candidatures
      </h1>
      <p className="mt-2 text-muted-foreground">
        {dossiers.length} dossier{dossiers.length > 1 ? "s" : ""} en cours ·{" "}
        {prets.length} prêt{prets.length > 1 ? "s" : ""} à activer ·{" "}
        {bloques.length} suspendu{bloques.length > 1 ? "s" : ""}
      </p>

      {bloques.length > 0 ? (
        <div className="mt-6 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-semibold">Examen suspendu</p>
          <ul className="mt-2 space-y-1 text-sm">
            {bloques.map((dossier) => (
              <li key={dossier.id}>
                {dossier.nom} —{" "}
                {dossier.signauxBloquants
                  .map((signal) => LIBELLES_SIGNAUX[signal])
                  .join(", ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dossiers.length === 0 ? (
        <p className="mt-8 rounded-xl border border-border bg-secondary/40 p-6 text-muted-foreground">
          Aucun dossier en cours.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {dossiers.map((dossier) => (
            <FicheCandidature key={dossier.id} dossier={dossier} />
          ))}
        </div>
      )}
    </main>
  );
}
