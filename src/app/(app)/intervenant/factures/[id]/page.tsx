import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DocumentFacture } from "@/components/document-facture";
import { EspaceFerme } from "@/components/espace-ferme";
import { espaceIntervenant } from "@/lib/auth/espaces";
import { lireLaFacture } from "@/lib/facturation/lecture";

export const metadata: Metadata = {
  title: "Facture",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FactureIntervenantPage({
  params,
}: PageProps<"/intervenant/factures/[id]">) {
  const { id } = await params;
  const espace = await espaceIntervenant();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect(`/connexion?callbackUrl=/intervenant/factures/${id}`);
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/travailler-avec-nous", libelle: "Nous rejoindre" }}
      />
    );
  }

  const facture = await lireLaFacture(espace.db, {
    id,
    cleanerProfileId: espace.profil.id,
  });
  if (!facture) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <p className="text-sm print:hidden">
        <Link
          href="/intervenant/factures"
          className="text-primary hover:underline"
        >
          ← Mes factures
        </Link>
      </p>

      <div className="mt-6">
        <DocumentFacture facture={facture} type="CLIENT_SERVICE" />
      </div>

      <p className="mt-6 text-sm text-pretty text-muted-foreground print:hidden">
        Pour l&apos;enregistrer en PDF, imprimez cette page et choisissez «
        Enregistrer au format PDF ».
      </p>
    </main>
  );
}
