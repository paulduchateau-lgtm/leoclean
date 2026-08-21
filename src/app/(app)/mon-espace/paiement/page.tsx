import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Cartes } from "@/app/(app)/mon-espace/paiement/cartes";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { EspaceFerme } from "@/components/espace-ferme";
import { espaceClient } from "@/lib/auth/espaces";
import { PREAUTORISATION_HEURES_AVANT } from "@/lib/paiement/calendrier";
import { lireLesMoyens } from "@/lib/paiement/moyen";
import { stripeEstConfigure } from "@/lib/paiement/stripe";
import { SITE } from "@/lib/site";

/**
 * Mon moyen de paiement.
 *
 * **La saisie a lieu chez Stripe**, sur son domaine : le numéro de carte ne
 * traverse jamais notre application et ne figure dans aucun de nos journaux.
 * Le coût est un aller-retour de navigation ; le bénéfice est de ne jamais
 * avoir à répondre de la fuite d'un champ qu'on n'a pas écrit.
 *
 * La page dit **quand** la carte sera débitée, pas seulement qu'elle le sera :
 * une empreinte prise sans qu'on annonce l'échéance se lit comme un
 * prélèvement immédiat.
 */

export const metadata: Metadata = {
  title: "Mon moyen de paiement",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PaiementPage({
  searchParams,
}: PageProps<"/mon-espace/paiement">) {
  const { carte } = await searchParams;

  /*
   * `espaceClient` traduit l'absence d'appartenance en résultat plutôt qu'en
   * exception. Le cas est nominal : un compte se crée sans appartenance, le
   * rattachement se faisant à la première réservation — cette page rendait donc
   * une erreur 500 à qui venait de se connecter.
   */
  const espace = await espaceClient();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect("/connexion?callbackUrl=/mon-espace/paiement");
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/mon-espace", libelle: "Mes réservations" }}
      />
    );
  }

  const { db, profil } = espace;
  const moyens = await lireLesMoyens(db, profil.id);

  return (
    <>
      <SiteHeader variant="tunnel" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <p className="text-sm">
          <Link href="/mon-espace" className="text-brand hover:underline">
            ← Mes réservations
          </Link>
        </p>

        <h1 className="mt-4 font-heading text-3xl font-black tracking-tight">
          Mon moyen de paiement
        </h1>

        {carte === "enregistree" ? (
          <p
            role="status"
            className="mt-4 rounded-xl border border-success/40 bg-success/10 p-4 font-semibold"
          >
            Votre carte est enregistrée.
          </p>
        ) : carte === "annulee" ? (
          <p className="mt-4 rounded-xl border border-border bg-secondary/40 p-4">
            L&apos;enregistrement a été interrompu. Rien n&apos;a été retenu.
          </p>
        ) : null}

        {/*
         * L'échéance est annoncée avant l'enregistrement, jamais découverte au
         * relevé : une empreinte prise sans qu'on dise quand elle est débitée
         * se lit comme un prélèvement immédiat.
         */}
        <p className="mt-4 text-pretty text-muted-foreground">
          Rien n&apos;est débité à l&apos;enregistrement. Votre carte est
          contrôlée {PREAUTORISATION_HEURES_AVANT} heures avant chaque
          intervention, et débitée seulement une fois le ménage fait.
        </p>

        {!stripeEstConfigure() ? (
          <p className="mt-6 rounded-xl border border-warning-border bg-warning-bg p-4 text-sm text-warning-dark">
            L&apos;enregistrement de carte n&apos;est pas encore ouvert. Nous
            vous appelons au {SITE.phone} avant votre première intervention.
          </p>
        ) : (
          <Cartes moyens={moyens} />
        )}

        <p className="mt-10 text-sm text-pretty text-muted-foreground">
          Le numéro de votre carte est saisi chez notre prestataire de paiement
          et ne passe jamais par nos serveurs.
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
