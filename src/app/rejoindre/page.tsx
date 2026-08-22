import type { Metadata } from "next";

import { FunnelCandidature } from "@/app/rejoindre/funnel";
import { FOURNISSEURS_ACTIFS } from "@/lib/auth/fournisseurs";
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
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-6 sm:py-12">
      <FunnelCandidature fournisseurs={FOURNISSEURS_ACTIFS} />

      {/*
       * **L'argument passe sous le tunnel, il ne le précède plus.** Il tenait
       * cinq cents pixels en tête d'écran, si bien que la première question
       * n'était pas visible sans défiler — sur un parcours qui se joue au
       * pouce, c'est la moitié des gens qui ne voient jamais qu'on leur
       * demandait quelque chose. Le plaidoyer complet vit sur
       * `/travailler-avec-nous`, qui est la page faite pour ça ; ce qui reste
       * ici répond aux deux objections qui arrêtent pendant le parcours.
       */}
      <section className="mt-12 grid gap-4">
        <div className="rounded-[var(--r-l)] bg-secondary p-5">
          <p className="font-semibold">Des missions à moins de vingt minutes</p>
          <p className="mt-1 text-pretty text-muted-foreground">
            Le premier poste de perte de revenu d&apos;un intervenant à domicile
            n&apos;est pas le tarif horaire, c&apos;est le trajet non payé et
            les trous de planning. Nos {COMMUNES.length} communes tiennent dans
            un mouchoir : une journée remplie sans la passer en voiture.
          </p>
        </div>

        <div className="rounded-[var(--r-l)] bg-secondary p-5">
          <p className="font-semibold">Vous n&apos;avez pas de statut ?</p>
          <p className="mt-1 text-pretty text-muted-foreground">
            Ce n&apos;est pas un obstacle. C&apos;est gratuit à créer, il faut
            compter une quinzaine de minutes de démarches et une à trois
            semaines d&apos;attente — et on garde vos missions pendant ce temps.
            La moitié des gens qui nous rejoignent passent par là.
          </p>
        </div>
      </section>
    </main>
  );
}
