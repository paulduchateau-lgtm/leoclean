import { CheckIcon, RepeatIcon, SprayCanIcon } from "lucide-react";
import Link from "next/link";

import { PrixAvecCreditImpot } from "@/components/prix-avec-credit-impot";
import { Badge } from "@/components/ui/badge";
import {
  MINIMUM_BILLABLE_MINUTES,
  PUBLIC_RATES,
  STANDARD_SQM_PER_HOUR_AFFICHE,
} from "@/lib/pricing/public-grid";

/**
 * L'offre : deux tarifs, et c'est tout.
 *
 * Les montants sont lus dans la grille publique : recopier « 28 € » ici
 * produirait le jour venu une page d'accueil qui annonce un prix et un tunnel
 * qui en facture un autre. Le libellé ne promet pas d'abonnement — le tunnel
 * vend un tarif, et les passages suivants se calent avec le client après le
 * premier ménage, ce qui est le fonctionnement réel.
 *
 * Un seul bouton mangue par écran, règle du système : il revient à la formule
 * régulière, l'offre du service et celle que la promesse de récurrence décrit.
 */

const MINIMUM_HOURS = MINIMUM_BILLABLE_MINUTES / 60;

const RATE_CARDS = [
  {
    key: "REGULIER",
    title: "Ménage régulier",
    body: "Chaque semaine ou tous les quinze jours, avec un intervenant attitré. Sans engagement : vous arrêtez quand vous voulez.",
    details: [
      `Minimum ${MINIMUM_HOURS} h par passage`,
      "Le même intervenant à chaque fois",
      "Les passages suivants se calent avec vous après le premier ménage",
    ],
    icon: RepeatIcon,
    bubble: "bg-teal-100 text-teal-700",
    primary: true,
  },
  {
    key: "PONCTUEL",
    title: "Intervention ponctuelle",
    body: "Une seule fois : fin de bail, remise en état après réception. Rien à résilier, rien à prévoir ensuite.",
    details: [
      `Minimum ${MINIMUM_HOURS} h, jusqu'à 6 h en une fois`,
      "Repassage, vitres ou four : 30 min de plus par option",
      `Estimation : environ ${STANDARD_SQM_PER_HOUR_AFFICHE} m² à l'heure`,
    ],
    icon: SprayCanIcon,
    bubble: "bg-papaya-100 text-papaya-700",
    primary: false,
  },
] as const;

export function Prestations() {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 pb-16">
      <h2 className="text-2xl font-black tracking-tight">
        Deux tarifs, et c&apos;est tout
      </h2>
      <p className="mt-2 max-w-prose text-muted-foreground">
        Le prix, c&apos;est le taux horaire multiplié par la durée. Vous
        choisissez la durée, nous vous disons la surface qu&apos;elle couvre
        habituellement.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {RATE_CARDS.map((card) => {
          const rate = PUBLIC_RATES.find((entry) => entry.key === card.key);
          if (rate === undefined) return null;

          return (
            <article
              key={card.key}
              className="flex flex-col rounded-[var(--r-xl)] border border-border bg-card p-6 shadow-xs sm:p-8"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`flex size-14 items-center justify-center rounded-[var(--r-m)] ${card.bubble}`}
                >
                  <card.icon className="size-6" aria-hidden />
                </span>
                {card.primary && (
                  <Badge className="shrink-0 bg-pineapple-300 text-ink-900">
                    Le + choisi
                  </Badge>
                )}
              </div>

              <h3 className="mt-4 text-lg font-extrabold">{card.title}</h3>

              <p className="mt-2 text-sm text-pretty text-muted-foreground">
                {card.body}
              </p>

              <PrixAvecCreditImpot
                hourlyRateCents={rate.hourlyRateCents}
                className="mt-4"
              />

              <ul className="mt-4 flex-1 space-y-2.5 text-sm">
                {card.details.map((detail) => (
                  <li key={detail} className="flex gap-2">
                    <CheckIcon
                      className="mt-0.5 size-4 shrink-0 text-brand"
                      aria-hidden
                    />
                    {detail}
                  </li>
                ))}
              </ul>

              <Link
                href="/reserver"
                className={
                  card.primary
                    ? "mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-pineapple-400 hover:shadow-action"
                    : "mt-6 inline-flex min-h-12 items-center justify-center rounded-full border-2 border-border bg-card px-6 font-bold transition-all duration-200 ease-brand hover:-translate-y-px hover:border-teal-300 hover:bg-teal-50"
                }
              >
                Voir mes créneaux
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
