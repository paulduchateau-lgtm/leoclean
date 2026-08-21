import { LogInIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";

/**
 * La porte de l'espace professionnel : deux entrées, jamais une seule.
 *
 * Le bouton « Espace pro » de l'en-tête mène ici plutôt que directement à la
 * connexion, parce que les deux personnes qui le pressent ne cherchent pas la
 * même chose : celle qui travaille déjà avec nous veut son planning, celle qui
 * vient d'arriver veut savoir comment commencer. Envoyer les deux sur le
 * formulaire de connexion en perdrait une, et l'inverse en perdrait l'autre.
 *
 * **La connexion passe par `/connexion` avec un `callbackUrl`, pas par
 * `/intervenant`.** La différence se voit quand la session existe déjà mais ne
 * porte pas le droit : `/intervenant` sait alors afficher son propre refus,
 * alors qu'un aller-retour par la connexion boucle sur une page qui ne
 * comprend pas ce qu'on lui demande. Le chemin de retour est un chemin
 * interne, seul type que la page de connexion accepte — une URL absolue en
 * ferait une redirection ouverte.
 *
 * **Aucune promesse d'accès n'est écrite.** Se connecter ne donne l'espace
 * qu'à un dossier activé : la copy dit « votre espace » à qui en a un, et
 * renvoie l'autre vers la candidature, plutôt que d'annoncer un tableau de
 * bord que le refus démentirait à l'écran suivant.
 */
export function EspaceProfessionnel() {
  return (
    <section
      id="espace-professionnel"
      className="scroll-mt-24 border-t border-border-subtle bg-teal-900 text-white"
    >
      <div className="mx-auto w-full max-w-4xl px-6 py-16">
        <h2 className="text-2xl font-black tracking-tight text-balance text-white">
          Espace professionnel
        </h2>
        <p className="mt-2 max-w-prose text-pretty text-teal-200">
          Vos missions, vos disponibilités, vos revenus et vos factures. Deux
          façons d&apos;y entrer, selon que vous travaillez déjà avec nous ou
          non.
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <article className="flex flex-col rounded-[var(--r-l)] bg-white/10 p-6">
            <span
              className="flex size-11 items-center justify-center rounded-full bg-pineapple-300 text-ink-900"
              aria-hidden
            >
              <LogInIcon className="size-5" />
            </span>
            <h3 className="mt-4 text-lg font-extrabold text-white">
              J&apos;ai déjà un compte
            </h3>
            <p className="mt-2 grow text-pretty text-teal-200">
              Vous retrouvez les missions qui vous sont proposées, votre semaine
              telle que vous l&apos;avez déclarée, et ce qui vous a été versé.
            </p>
            {/* La pilule ananas, texte encre : l'accent de la bande sombre. */}
            <Link
              href="/connexion?callbackUrl=/intervenant"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-pineapple-300 px-6 font-bold text-ink-900 transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-pineapple-400"
            >
              Se connecter
            </Link>
          </article>

          <article className="flex flex-col rounded-[var(--r-l)] bg-white/10 p-6">
            <span
              className="flex size-11 items-center justify-center rounded-full bg-pineapple-300 text-ink-900"
              aria-hidden
            >
              <UserPlusIcon className="size-5" />
            </span>
            <h3 className="mt-4 text-lg font-extrabold text-white">
              Je n&apos;ai pas encore de compte
            </h3>
            <p className="mt-2 grow text-pretty text-teal-200">
              Le parcours ouvre votre dossier et se reprend depuis
              n&apos;importe quel appareil. Pas encore de statut
              d&apos;auto-entrepreneur ? Ce n&apos;est pas un obstacle, le
              parcours vous accompagne.
            </p>
            <Link
              href="/rejoindre"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full border-2 border-white/40 px-6 font-bold text-white transition-all duration-200 ease-brand hover:-translate-y-px hover:border-white hover:bg-white/10"
            >
              Devenir cleaner
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
