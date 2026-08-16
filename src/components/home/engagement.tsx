import { Avis } from "@/components/avis";
import { FACTS } from "@/lib/facts";
import { SITE } from "@/lib/site";

/**
 * Ce sur quoi Léo Clean s'engage, à la place des avis clients.
 *
 * Il n'y a aucun avis à afficher aujourd'hui, et en fabriquer serait une
 * pratique commerciale trompeuse au sens de l'article L121-2 du code de la
 * consommation — pour un gain sans rapport avec le risque. Un carrousel vide
 * ou des témoignages inventés diraient de toute façon la même chose à qui sait
 * lire : que le service est neuf.
 *
 * Un engagement signé est l'inverse d'un avis : il n'est pas une preuve du
 * passé mais une promesse vérifiable, et il est tenu par quelqu'un dont le nom
 * et le numéro sont sur la page. C'est la seule forme de confiance qu'un
 * service qui démarre peut offrir honnêtement.
 *
 * Chaque ligne est une promesse que le produit tient réellement : le délai
 * d'annulation est lu dans le barème, pas recopié.
 */
const ENGAGEMENTS: readonly { title: string; body: string }[] = [
  {
    title: "Nous arrivons à l'heure",
    body: "Et si un retard est inévitable, vous êtes prévenu avant l'heure du rendez-vous, pas après.",
  },
  {
    title: "C'est la même personne qui revient",
    body: "Sur une formule régulière, vous ne redécouvrez pas quelqu'un de nouveau chaque semaine.",
  },
  {
    title: `Annulation gratuite jusqu'à ${FACTS.freeCancellationHours} h avant`,
    body: "Sans motif à donner. Au-delà, un barème plafonné s'applique, et il est affiché avant que vous réserviez.",
  },
  {
    title: "Le numéro affiché est le nôtre",
    body: "Vous appelez, quelqu'un décroche. Pas de standard, pas de formulaire resté sans réponse.",
  },
];

export function Engagement() {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-16">
      <h2 className="text-2xl font-black tracking-tight">Nos engagements</h2>
      <p className="mt-2 max-w-prose text-muted-foreground">
        Léo Clean est un service récent : nous n&apos;avons pas encore
        d&apos;avis clients à vous montrer, et nous préférons ne pas en
        inventer. Voici ce sur quoi vous pouvez nous tenir.
      </p>

      <ul className="mt-8 grid gap-5 sm:grid-cols-2">
        {ENGAGEMENTS.map((engagement) => (
          <li
            key={engagement.title}
            className="rounded-[var(--r-l)] border border-border bg-card p-5"
          >
            <h3 className="font-extrabold">{engagement.title}</h3>
            <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
              {engagement.body}
            </p>
          </li>
        ))}
      </ul>

      {SITE.founder !== null && (
        <p className="mt-6 text-sm text-muted-foreground">
          — {SITE.founder}, fondateur de {SITE.name}.
        </p>
      )}

      {/* En place, et muet tant qu'aucun avis réel n'existe. */}
      <Avis />
    </section>
  );
}
