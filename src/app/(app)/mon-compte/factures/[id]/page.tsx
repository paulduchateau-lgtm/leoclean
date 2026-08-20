import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DocumentFacture } from "@/components/document-facture";
import { EspaceFerme } from "@/components/espace-ferme";
import { espaceClient } from "@/lib/auth/espaces";
import { lireLaFacture } from "@/lib/facturation/lecture";

/**
 * Une facture, telle qu'elle a été émise.
 *
 * Le document se télécharge par l'impression du navigateur — « Imprimer » puis
 * « Enregistrer au format PDF ». Une bibliothèque de PDF ajouterait une
 * dépendance lourde à une construction sans serveur pour produire ce que tous
 * les appareils savent déjà faire.
 */

export const metadata: Metadata = {
  title: "Facture",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FacturePage({
  params,
}: PageProps<"/mon-compte/factures/[id]">) {
  const { id } = await params;
  const espace = await espaceClient();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect(`/connexion?callbackUrl=/mon-compte/factures/${id}`);
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/mon-compte", libelle: "Mon compte" }}
      />
    );
  }

  const facture = await lireLaFacture(espace.db, {
    id,
    clientProfileId: espace.profil.id,
  });

  /* Une facture qui n'est pas la sienne est introuvable, jamais « interdite ». */
  if (!facture) notFound();

  const type = facture.emetteur.autofacturee
    ? "CLIENT_SERVICE"
    : "CLIENT_COORDINATION";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <p className="text-sm print:hidden">
        <Link
          href="/mon-compte/factures"
          className="text-primary hover:underline"
        >
          ← Mes factures
        </Link>
      </p>

      <div className="mt-6">
        <DocumentFacture facture={facture} type={type} />
      </div>

      <p className="mt-6 text-sm text-pretty text-muted-foreground print:hidden">
        Pour l&apos;enregistrer en PDF, imprimez cette page et choisissez «
        Enregistrer au format PDF ».
      </p>
    </main>
  );
}
