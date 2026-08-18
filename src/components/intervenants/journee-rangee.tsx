import { CalendarIcon, EyeOffIcon, RouteIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  FEATURES,
  SUPPORTED_CALENDARS,
  isAvailable,
  stageLabel,
} from "@/lib/features";

/**
 * « Votre journée, rangée » — et ce qu'on lit de votre agenda.
 *
 * **Les deux blocs n'en font qu'un, volontairement.** Le brief exige qu'ils
 * soient adjacents et qu'aucun autre bloc ne s'intercale ; les réunir dans un
 * seul composant rend la séparation impossible sans réécrire ce fichier, ce
 * qui vaut mieux qu'un test qui constaterait l'erreur après coup. Demander
 * l'accès à l'agenda personnel d'un indépendant est une intrusion réelle : la
 * page promet « vous restez libre » partout ailleurs, et c'est la seconde
 * moitié de ce bloc qui empêche la première de mentir.
 *
 * **Toute la copy est en proposition, jamais en instruction.** Ce n'est pas
 * une préférence de ton : un logiciel qui ordonne la journée d'un indépendant
 * est un indice de subordination s'il le subit, et n'en est pas un s'il le
 * pilote. D'où « on vous propose » et jamais « on vous affecte », « une
 * suggestion de tournée » et jamais « votre tournée ». Le fait que l'ordre
 * proposé soit modifiable est écrit noir sur blanc, parce qu'il est la
 * différence entre les deux situations.
 *
 * Aucune capture d'écran : la fonction n'existe pas encore, et montrer une
 * interface inexistante est la façon la plus rapide de transformer une
 * feuille de route en promesse.
 */

const LU: readonly string[] = [
  "Les heures où vous êtes occupé",
  "Le lieu, uniquement quand vous l'indiquez et si vous activez l'option",
];

const NON_LU: readonly string[] = [
  "Le titre de vos rendez-vous",
  "Leur description",
  "Les participants",
  "Votre historique",
];

const ENGAGEMENTS: readonly string[] = [
  "La connexion est facultative. Ne pas connecter son agenda ne réduit pas les missions proposées.",
  "Déconnexion en un geste, et suppression immédiate de ce qui a été lu.",
  "Aucune donnée d'agenda n'est visible par un client.",
  "Rien n'est conservé au-delà de la fenêtre de planification en cours.",
];

export function JourneeRangee() {
  const calendarBadge = stageLabel(FEATURES.calendarSync);
  const optimizerBadge = stageLabel(FEATURES.routeOptimizer);
  const optimizerLive = isAvailable(FEATURES.routeOptimizer);

  return (
    <>
      <section className="border-y border-border-subtle bg-sky-50">
        <div className="mx-auto w-full max-w-4xl px-6 py-16">
          <h2 className="text-2xl font-black tracking-tight">
            Votre journée, rangée
          </h2>
          <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
            {optimizerLive
              ? "Le temps de route est le premier poste de perte de revenu d'un intervenant à domicile. Voici ce que nous en faisons."
              : "Le temps de route est le premier poste de perte de revenu d'un intervenant à domicile. Voici ce que nous en ferons, et ce que nous ne ferons pas."}
          </p>

          <div className="mt-10 space-y-8">
            <article>
              <h3 className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
                <CalendarIcon
                  className="size-4 shrink-0 text-brand"
                  aria-hidden
                />
                Connectez votre agenda
                {calendarBadge !== null && (
                  <Badge variant="secondary">{calendarBadge}</Badge>
                )}
              </h3>
              <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
                {SUPPORTED_CALENDARS.join(" ou ")}, en une fois, révocable à
                tout moment. Léo Clean voit quand vous êtes occupé, et où si
                vous l&apos;indiquez — jamais ce que vous faites.
              </p>
            </article>

            <article>
              <h3 className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
                <RouteIcon className="size-4 shrink-0 text-brand" aria-hidden />
                On vous propose de quoi remplir les trous
                {optimizerBadge !== null && (
                  <Badge variant="secondary">{optimizerBadge}</Badge>
                )}
              </h3>
              <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
                Un créneau se libère, une mission compatible apparaît à côté :
                elle vous est proposée. Vous acceptez ou vous refusez.
              </p>

              <blockquote className="mt-4 max-w-prose border-l-2 border-teal-400 pl-4 text-pretty text-muted-foreground">
                Mardi, votre client de 14 h annule. Vous avez une intervention à
                11 h à Cadaujac et une autre à 17 h à Léognan. Léo Clean vous
                propose une mission à Martillac à 14 h 30 : sept minutes de
                route depuis Cadaujac, onze jusqu&apos;à Léognan. Vous acceptez,
                ou vous ne faites rien.
              </blockquote>
            </article>

            <article>
              <h3 className="text-lg font-extrabold">
                On vous propose un ordre pour la journée
              </h3>
              <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
                Les interventions d&apos;une même journée sont présentées dans
                un ordre qui réduit la route. C&apos;est une suggestion :
                l&apos;ordre reste modifiable à tout moment, et le modifier
                n&apos;a aucune conséquence. Les contraintes personnelles
                inscrites dans votre agenda <strong>avec un lieu</strong> sont
                traitées comme des points de passage obligés, pas comme des
                cases vides.
              </p>

              <blockquote className="mt-4 max-w-prose border-l-2 border-teal-400 pl-4 text-pretty text-muted-foreground">
                Si votre agenda indique « école, 16 h 30, Gradignan », aucune
                mission ne vous sera proposée à 15 h 45 à l&apos;autre bout du
                secteur.
              </blockquote>
            </article>

            {/* `<details>` natif plutôt que l'accordéon du système : il ne
                coûte pas une ligne de JavaScript sur une page dont le premier
                rendu compte, et il s'ouvre même si le script ne charge pas. */}
            <details className="max-w-prose rounded-[var(--r-m)] border border-border bg-card p-4">
              <summary className="cursor-pointer font-semibold">
                Sous le capot
              </summary>
              <p className="mt-3 text-sm text-pretty text-muted-foreground">
                L&apos;ordonnancement est un problème d&apos;optimisation de
                tournée sous contraintes — une variante du problème du voyageur
                de commerce avec fenêtres de temps. Les temps de trajet employés
                sont des temps de route réels, jamais des distances à vol
                d&apos;oiseau. Un modèle de langage sert à interpréter les
                contraintes que vous écrivez en texte libre dans votre agenda,
                et à rien d&apos;autre.
              </p>
            </details>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight">
          <EyeOffIcon className="size-5 shrink-0 text-brand" aria-hidden />
          Ce qu&apos;on lit, ce qu&apos;on ne lit pas
        </h2>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <div className="rounded-[var(--r-l)] border border-border bg-card p-5">
            <h3 className="font-extrabold">Ce que Léo Clean lit</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {LU.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-[var(--r-l)] border border-border bg-card p-5">
            <h3 className="font-extrabold">Ce que Léo Clean ne lit pas</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {NON_LU.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Deux consentements distincts, pas un seul : accepter que le service
            connaisse vos heures occupées n'est pas accepter qu'il connaisse
            les lieux où vous allez. Les demander ensemble reviendrait à
            obtenir le second sans qu'il ait été posé. */}
        <p className="mt-6 max-w-prose text-pretty text-muted-foreground">
          La lecture des <strong>heures occupées</strong> et celle des{" "}
          <strong>lieux</strong> font l&apos;objet de deux autorisations
          séparées. Vous pouvez accorder la première sans la seconde : les
          missions vous seront proposées de la même façon, sans tenir compte de
          vos points de passage.
        </p>

        <ul className="mt-6 space-y-2">
          {ENGAGEMENTS.map((engagement) => (
            <li key={engagement} className="flex gap-2 text-pretty">
              <span className="text-brand" aria-hidden>
                ·
              </span>
              {engagement}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
