import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GestionCompte } from "@/app/(app)/intervenant/profil/gestion-compte";
import {
  enregistrerMonPortraitIntervenant,
  retirerMonPortraitIntervenant,
} from "@/app/(app)/intervenant/dossier/actions";
import { EspaceFerme } from "@/components/espace-ferme";
import { BandeauStatut } from "@/components/espace-pro/bandeau-statut";
import { PortraitField } from "@/components/portrait-field";
import { SiteHeader } from "@/components/site-header";
import { espaceIntervenant } from "@/lib/auth/espaces";
import { lireDossier } from "@/lib/cleaner/space";
import { lireMesDemandes } from "@/lib/cleaner/demande-rgpd";
import { missionsQueLaPauseNeRetirePas } from "@/lib/cleaner/suspension";
import { portraitDisponible } from "@/lib/compte/portrait";
import { SITE } from "@/lib/site";

/**
 * Le profil de l'intervenant : qui il est, et ce qu'il décide de son compte.
 *
 * **Distinct du dossier professionnel, et volontairement.** Le dossier porte ce
 * qu'on exige de lui — SIRET, assurance, pièces — et sert à le faire activer.
 * Le profil porte ce qui lui appartient : son visage, sa mise en pause, ses
 * droits sur ses données. Fondre les deux ferait lire une demande d'effacement
 * comme une pièce à fournir.
 */

export const metadata: Metadata = {
  title: "Mon profil",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const espace = await espaceIntervenant();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect("/connexion?callbackUrl=/intervenant/profil");
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/travailler-avec-nous", libelle: "Nous rejoindre" }}
      />
    );
  }

  const { db, user } = espace;
  const [dossier, demandes, missionsAVenir] = await Promise.all([
    lireDossier(db, { id: user.id }, new Date()),
    lireMesDemandes(user.id),
    missionsQueLaPauseNeRetirePas(db, user.id),
  ]);

  const enPause = dossier.etat.motif === "EN_PAUSE";
  /*
   * Une suspension décidée par la plateforme n'est pas une pause : le bouton
   * n'aurait rien à lever, et l'afficher actif promettrait un geste sans effet.
   */
  const peutSePauser =
    dossier.etat.motif !== "SUSPENDU" && dossier.status !== "INACTIVE";

  return (
    <>
      <SiteHeader variant="tunnel" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <p className="text-sm">
          <Link href="/intervenant" className="text-brand hover:underline">
            ← Mon planning
          </Link>
        </p>

        <h1 className="mt-3 font-heading text-3xl font-black tracking-tight">
          Mon profil
        </h1>

        <div className="mt-6">
          <BandeauStatut etat={dossier.etat} />
        </div>

        {dossier.suspensionMotif ? (
          <p className="mt-4 rounded-[var(--r-m)] border border-destructive/40 bg-destructive/5 p-4 text-sm text-pretty">
            <strong>Motif :</strong> {dossier.suspensionMotif}
          </p>
        ) : null}

        <div className="mt-8">
          <PortraitField
            nom={dossier.displayName}
            photoUrl={dossier.photoUrl}
            disponible={portraitDisponible()}
            legende="Elle apparaît sur la confirmation de vos clients et dans vos conversations. Faire entrer quelqu'un chez soi est plus facile quand on l'a vu. Elle n'est pas obligatoire."
            enregistrer={enregistrerMonPortraitIntervenant}
            retirer={retirerMonPortraitIntervenant}
          />
        </div>

        <GestionCompte
          enPause={enPause}
          peutSePauser={peutSePauser}
          missionsAVenir={missionsAVenir}
          demandes={demandes}
          telephone={SITE.phone}
        />
      </main>
    </>
  );
}
