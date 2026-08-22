import type { Metadata } from "next";
import Link from "next/link";

import {
  FileRgpd,
  ListeComptes,
} from "@/app/(app)/administration/intervenants/liste";
import { lireLesComptes } from "@/lib/administration/comptes-intervenants";
import { lireLaFileRgpd } from "@/lib/cleaner/demande-rgpd";
import { asPlatformAdmin } from "@/lib/auth/session";

/**
 * Les comptes intervenants.
 *
 * **Trois files, dans l'ordre du délai qui court.** Les dossiers soumis
 * attendent quelqu'un qui ne peut pas travailler ; les demandes RGPD ont un
 * délai légal d'un mois ; le reste est une liste de consultation. Les mettre
 * sur un pied d'égalité ferait traiter en premier ce qui n'attendait pas.
 */

export const metadata: Metadata = {
  title: "Comptes intervenants",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ComptesIntervenantsPage() {
  await asPlatformAdmin();

  const [aValider, tous, rgpd] = await Promise.all([
    lireLesComptes("A_VALIDER"),
    lireLesComptes("TOUS"),
    lireLaFileRgpd(),
  ]);

  const enAttente = new Set(aValider.map((compte) => compte.cleanerProfileId));
  const autres = tous.filter(
    (compte) => !enAttente.has(compte.cleanerProfileId),
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <p className="text-sm">
        <Link href="/administration" className="text-brand hover:underline">
          ← Le travail du jour
        </Link>
      </p>

      <h1 className="mt-3 font-heading text-3xl font-black tracking-tight">
        Comptes intervenants
      </h1>
      <p className="mt-2 text-pretty text-muted-foreground">
        Un compte se clôt, il ne se supprime pas : les factures émises se
        conservent dix ans.
      </p>

      <section className="mt-8" aria-labelledby="a-valider">
        <h2 id="a-valider" className="font-heading text-xl font-extrabold">
          Dossiers soumis ({aValider.length})
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Du plus ancien au plus récent.
        </p>
        <ListeComptes comptes={aValider} />
      </section>

      <section className="mt-10" aria-labelledby="rgpd">
        <h2 id="rgpd" className="font-heading text-xl font-extrabold">
          Demandes RGPD ({rgpd.length})
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Le délai légal est d&apos;un mois à compter du dépôt.
        </p>
        <FileRgpd demandes={rgpd} />
      </section>

      <section className="mt-10" aria-labelledby="tous">
        <h2 id="tous" className="font-heading text-xl font-extrabold">
          Tous les comptes ({autres.length})
        </h2>
        <ListeComptes comptes={autres} />
      </section>
    </main>
  );
}
