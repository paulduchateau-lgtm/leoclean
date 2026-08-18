import { ChevronDownIcon } from "lucide-react";

import { FACTS } from "@/lib/facts";
import { formatEuros } from "@/lib/pricing";
import { CANCELLATION_TIERS } from "@/lib/pricing/cancellation";

/**
 * Les questions qu'on nous pose avant de réserver.
 *
 * Un `<details>` par question, aucun script. Chaque réponse est
 * autosuffisante — c'est la forme qu'un moteur ou un modèle de langage
 * reprend — et chaque chiffre est lu dans le module qui le détient : le
 * barème d'annulation vient des paliers des CGU, jamais d'une recopie qui
 * divergerait au premier changement.
 *
 * La réponse sur le paiement dit le fonctionnement d'aujourd'hui — rien
 * n'est réglé à la réservation — sans promettre une mécanique de carte qui
 * n'existe pas encore.
 */

/** Les trois paliers payants intermédiaires du barème, pour les citer. */
const TIER_8_24 = CANCELLATION_TIERS[1]!;
const TIER_4_8 = CANCELLATION_TIERS[2]!;
const TIER_2_4 = CANCELLATION_TIERS[3]!;

const QUESTIONS: readonly { question: string; answer: string }[] = [
  {
    question: "Est-ce que ce sera toujours la même personne ?",
    answer: `Sur une formule régulière, oui. Votre intervenant garde votre créneau d'une semaine sur l'autre, et il habite l'une des ${FACTS.communeCount} communes du secteur — c'est ce qui rend cette régularité tenable pour lui. En cas d'empêchement, nous vous proposons quelqu'un d'autre plutôt que d'annuler, et vous restez libre de refuser.`,
  },
  {
    question: "Comment se passe le paiement ?",
    answer: `Rien n'est réglé à la réservation : vous payez après le passage. Et l'annulation reste gratuite jusqu'à ${FACTS.freeCancellationHours} h avant — vous ne payez donc que ce qui a réellement eu lieu.`,
  },
  {
    question: "Puis-je annuler ou déplacer un passage ?",
    answer: `Gratuitement jusqu'à ${FACTS.freeCancellationHours} h avant. En deçà, un barème s'applique, plafonné et public : ${formatEuros(TIER_8_24.capCents)} entre 8 et 24 h, ${formatEuros(TIER_4_8.capCents)} entre 4 et 8 h, puis ${TIER_2_4.rateBp / 100} % du montant — ${formatEuros(TIER_2_4.capCents)} au plus — entre 2 et 4 h. Il existe pour protéger la journée de travail de l'intervenant, pas pour vous sanctionner.`,
  },
  {
    question: "Faut-il fournir les produits et le matériel ?",
    answer:
      "Les produits et l'aspirateur sont les vôtres : c'est votre logement, vos surfaces et vos allergies. Si vous préférez que l'intervenant apporte les siens, dites-le dans vos consignes et nous en tenons compte pour la mise en relation.",
  },
  {
    question: "Que se passe-t-il en cas de casse ?",
    answer:
      "Chaque intervenant est couvert par une responsabilité civile professionnelle, vérifiée avant sa première mission. L'indemnisation va jusqu'à 1 000 €, avec 200 € de franchise et une vétusté de 10 % par an plafonnée à 50 %. Le barème est public avant le sinistre, pas après.",
  },
  {
    question: "Suis-je engagé sur une durée ?",
    answer:
      "Non, et il n'y a rien à résilier. Vous réservez un passage, puis vous décidez de la suite. Nous calons les passages suivants avec vous après le premier ménage, une fois que vous savez si le rythme et la personne vous conviennent.",
  },
];

export function Faq() {
  return (
    <section className="border-t border-border-subtle">
      <div className="mx-auto w-full max-w-4xl px-6 py-16">
        <h2 className="text-2xl font-black tracking-tight">Vos questions</h2>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Si la vôtre n&apos;y est pas, écrivez-nous : la réponse arrive dans la
          journée.
        </p>

        <div className="mt-8 max-w-2xl space-y-3">
          {QUESTIONS.map((entry, index) => (
            <details
              key={entry.question}
              open={index === 0}
              className="group rounded-[var(--r-l)] border border-border bg-card px-5 py-4 open:shadow-md"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-extrabold [&::-webkit-details-marker]:hidden">
                {entry.question}
                <ChevronDownIcon
                  className="size-5 shrink-0 text-brand transition-transform duration-200 ease-brand group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="mt-3 text-sm text-pretty text-muted-foreground">
                {entry.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
