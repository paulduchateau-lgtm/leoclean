import Link from "next/link";

import { PrixAvecCreditImpot } from "@/components/prix-avec-credit-impot";
import { Badge } from "@/components/ui/badge";
import { PUBLIC_RATES } from "@/lib/pricing/public-grid";

/**
 * Les trois demandes réelles, et la réponse à chacune.
 *
 * Deux d'entre elles sont des tarifs de la grille publique et sont lues
 * dedans : recopier « 29 € » ici produirait le jour venu une page d'accueil
 * qui annonce un prix et un tunnel qui en facture un autre.
 *
 * La troisième n'est pas un tarif. Le grand ménage est aujourd'hui une option
 * qui allonge la durée d'une intervention, pas une prestation que le tunnel
 * sait vendre : sa carte mène donc au rappel téléphonique et non à
 * `/reserver`, faute de quoi elle promettrait une réservation en ligne qui
 * n'aboutirait pas.
 *
 * Un seul bouton menthe par écran, règle du système : il revient à la formule
 * régulière, qui est l'offre du service et celle que la promesse de récurrence
 * décrit.
 */

const RATE_DETAILS: Record<string, readonly string[]> = {
  REGULIER: [
    "Le même intervenant à chaque passage",
    "Toutes les semaines, tous les quinze jours ou une fois par mois",
    "Sans engagement, annulation gratuite jusqu'à 24 h avant",
  ],
  PONCTUEL: [
    "Une seule intervention, sans suite",
    "Fin de bail, après réception, remise en état",
    "Même tarif dans les seize communes",
  ],
};

const PRIMARY_KEY = "REGULIER";

export function Prestations() {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-16">
      <h2 className="text-2xl font-black tracking-tight">
        Trois besoins, trois réponses
      </h2>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {PUBLIC_RATES.map((rate) => (
          <article
            key={rate.key}
            className="flex flex-col rounded-[var(--r-l)] border border-border bg-card p-6 shadow-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-extrabold">{rate.label}</h3>
              {rate.key === PRIMARY_KEY && (
                <Badge variant="secondary" className="shrink-0">
                  Le plus demandé
                </Badge>
              )}
            </div>

            <p className="mt-2 text-sm text-pretty text-muted-foreground">
              {rate.description}
            </p>

            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {RATE_DETAILS[rate.key]?.map((detail) => (
                <li key={detail} className="flex gap-2">
                  <span className="text-brand" aria-hidden>
                    ·
                  </span>
                  {detail}
                </li>
              ))}
            </ul>

            <PrixAvecCreditImpot
              hourlyRateCents={rate.hourlyRateCents}
              className="mt-6"
            />

            <Link
              href="/reserver"
              className={
                rate.key === PRIMARY_KEY
                  ? "mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-mango-500 hover:shadow-mango"
                  : "mt-4 inline-flex min-h-12 items-center justify-center rounded-full border-2 border-border bg-card px-6 font-bold transition-all duration-200 ease-brand hover:-translate-y-px hover:border-teal-300 hover:bg-teal-50"
              }
            >
              Réserver
            </Link>
          </article>
        ))}

        <article className="flex flex-col rounded-[var(--r-l)] border border-border bg-card p-6 shadow-xs">
          <h3 className="text-lg font-extrabold">Grand ménage</h3>

          <p className="mt-2 text-sm text-pretty text-muted-foreground">
            Remise à neuf complète, vitres, placards et électroménager compris.
            La durée dépend du logement : nous l&apos;estimons avec vous.
          </p>

          <ul className="mt-4 flex-1 space-y-2 text-sm">
            {[
              "Devis établi par téléphone, en quelques minutes",
              "Intervention à deux si le logement le demande",
              "Peut précéder la mise en place d'un passage régulier",
            ].map((detail) => (
              <li key={detail} className="flex gap-2">
                <span className="text-brand" aria-hidden>
                  ·
                </span>
                {detail}
              </li>
            ))}
          </ul>

          <p className="mt-6 text-2xl font-black tracking-tight">Sur devis</p>

          <Link
            href="/etre-rappele"
            className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full border-2 border-border bg-card px-6 font-bold transition-all duration-200 ease-brand hover:-translate-y-px hover:border-teal-300 hover:bg-teal-50"
          >
            Être rappelé
          </Link>
        </article>
      </div>
    </section>
  );
}
