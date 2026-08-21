import type { Metadata } from "next";

import { FunnelCandidature } from "@/app/rejoindre/funnel";
import { COMMUNES } from "@/lib/territory";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * L'entrée du funnel d'inscription intervenant.
 *
 * **Deux portes de même taille.** « Je suis déjà auto-entrepreneur » et « je
 * veux me lancer, aidez-moi » mènent au même parcours et pré-positionnent
 * seulement l'aiguillage. La seconde doit être aussi grosse que la première :
 * c'est là qu'est le vivier réel au sud de Bordeaux — quelqu'un qui sait faire
 * le travail mais que l'administratif arrête.
 *
 * La page reste `noindex` tant que la rémunération n'est pas publiable, comme
 * `/travailler-avec-nous` : se classer sur « missions ménage Gironde » sans
 * pouvoir dire ce qu'on paie ferait venir exactement les gens qu'on décevrait.
 */

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Rejoindre Léo Clean",
    description:
      "Devenir intervenant Léo Clean au sud de Bordeaux : missions à moins de vingt minutes, paiement hebdomadaire, accompagnement administratif complet.",
    path: "/rejoindre",
  }),
  robots: { index: false, follow: false },
};

export default function RejoindrePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="font-heading text-4xl font-black tracking-tight text-balance">
        Des missions à moins de vingt minutes de chez vous
      </h1>

      <p className="mt-5 max-w-prose text-lg text-pretty text-muted-foreground">
        Le premier poste de perte de revenu d&apos;un intervenant à domicile
        n&apos;est pas le tarif horaire, c&apos;est le trajet non payé et les
        trous de planning. Nos {COMMUNES.length} communes tiennent dans un
        mouchoir : une journée remplie sans la passer en voiture.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-secondary/40 p-5">
        <p className="font-semibold">Vous n&apos;avez pas de statut ?</p>
        <p className="mt-1 text-muted-foreground">
          Ce n&apos;est pas un obstacle. C&apos;est gratuit à créer, il faut
          compter une quinzaine de minutes de démarches et une à trois semaines
          d&apos;attente — et on garde vos missions pendant ce temps. La moitié
          des gens qui nous rejoignent passent par là.
        </p>
      </div>

      <FunnelCandidature className="mt-10" />
    </main>
  );
}
