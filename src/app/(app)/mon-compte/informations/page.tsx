import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Formulaire } from "@/app/(app)/mon-compte/informations/formulaire";
import { PortraitField } from "@/components/portrait-field";
import {
  enregistrerMonPortrait,
  retirerMonPortrait,
} from "@/app/(app)/mon-compte/informations/actions";
import { portraitDisponible } from "@/lib/compte/portrait";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { EspaceFerme } from "@/components/espace-ferme";
import { espaceClient } from "@/lib/auth/espaces";
import { lireLesInformations } from "@/lib/compte/informations";

/**
 * Informations personnelles.
 *
 * Ce que la personne corrige elle-même, et rien de plus. **L'adresse email n'y
 * est pas modifiable** : elle identifie le compte et reçoit les liens de
 * connexion, si bien que la changer sur simple saisie permettrait de détourner
 * un compte depuis un poste laissé ouvert.
 */

export const metadata: Metadata = {
  title: "Informations personnelles",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InformationsPage() {
  /*
   * `espaceClient` traduit l'absence d'appartenance en résultat plutôt
   * qu'en exception. Le cas est nominal : un compte se crée sans
   * appartenance, le rattachement se faisant à la première réservation —
   * cette page rendait donc une erreur 500 à qui venait de se connecter.
   */
  const espace = await espaceClient();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect("/connexion?callbackUrl=/mon-compte/informations");
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/mon-compte", libelle: "Mon compte" }}
      />
    );
  }

  const { db, user } = espace;
  const informations = await lireLesInformations(db, user.id);

  return (
    <>
      <SiteHeader variant="tunnel" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <p className="text-sm">
          <Link href="/mon-compte" className="text-brand hover:underline">
            ← Mon compte
          </Link>
        </p>

        <h1 className="mt-4 font-heading text-3xl font-black tracking-tight">
          Informations personnelles
        </h1>

        {informations ? (
          <>
            {/* Le portrait avant le formulaire : c'est ce qui se voit, et
                c'est le seul champ de cet écran qui sert à quelqu'un d'autre
                qu'à l'administration du compte. */}
            <div className="mt-8">
              <PortraitField
                nom={informations.nom ?? "Vous"}
                photoUrl={informations.photoUrl}
                disponible={portraitDisponible()}
                legende="Elle apparaît dans vos conversations, pour que votre intervenant sache à qui il écrit. Elle n'est pas obligatoire."
                enregistrer={enregistrerMonPortrait}
                retirer={retirerMonPortrait}
              />
            </div>
            <Formulaire informations={informations} />
          </>
        ) : (
          <p className="mt-6 rounded-2xl border border-border bg-secondary/40 p-6 text-muted-foreground">
            Votre compte n&apos;a pas encore d&apos;espace client. Il en aura un
            à votre première réservation.
          </p>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
