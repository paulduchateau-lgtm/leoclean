import {
  ArrowRightIcon,
  KeyIcon,
  ShirtIcon,
  SparklesIcon,
  SprayCanIcon,
} from "lucide-react";
import Link from "next/link";

import { formatHourlyRate } from "@/lib/pricing";
import { PUBLIC_RATES } from "@/lib/pricing/public-grid";

/**
 * Les quatre prestations, en cartes de navigation.
 *
 * Chaque carte porte l'une des quatre teintes du tropical punch — la palette
 * entière se lit dans la grille — et un « dès X €/h » lu dans la grille
 * publique, jamais recopié : le ménage et le repassage relèvent du tarif
 * régulier, la fin de bail du ponctuel.
 *
 * Le grand ménage est l'exception documentée du dépôt : c'est une remise à
 * neuf dont la durée s'estime au téléphone — intervention à deux, parfois plus
 * de six heures, le plafond du tunnel. Sa carte mène au rappel plutôt qu'à
 * `/reserver`, faute de quoi elle promettrait une réservation en ligne qui
 * n'aboutirait pas.
 */

const REGULAR_RATE = PUBLIC_RATES.find((rate) => rate.key === "REGULIER");
const ONE_OFF_RATE = PUBLIC_RATES.find((rate) => rate.key === "PONCTUEL");

const SERVICES = [
  {
    title: "Ménage",
    tagline: "Entretien courant, régulier ou ponctuel",
    price:
      REGULAR_RATE !== undefined
        ? `dès ${formatHourlyRate(REGULAR_RATE.hourlyRateCents)}`
        : null,
    href: "/reserver",
    icon: SparklesIcon,
    bubble: "bg-teal-100 text-teal-700",
  },
  {
    title: "Repassage",
    tagline: "Seul, ou ajouté à votre ménage",
    price:
      REGULAR_RATE !== undefined
        ? `dès ${formatHourlyRate(REGULAR_RATE.hourlyRateCents)}`
        : null,
    href: "/reserver",
    icon: ShirtIcon,
    bubble: "bg-papaya-100 text-papaya-700",
  },
  {
    title: "Grand ménage",
    tagline: "De fond en comble, une fois",
    price: "sur devis",
    href: "/etre-rappele",
    icon: SprayCanIcon,
    bubble: "bg-pineapple-100 text-pineapple-700",
  },
  {
    title: "Fin de bail",
    tagline: "Avant l'état des lieux",
    price:
      ONE_OFF_RATE !== undefined
        ? `dès ${formatHourlyRate(ONE_OFF_RATE.hourlyRateCents)}`
        : null,
    href: "/reserver",
    icon: KeyIcon,
    bubble: "bg-mango-100 text-mango-700",
  },
];

export function Services() {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-16">
      <h2 className="text-2xl font-black tracking-tight">
        Ce dont vous avez besoin
      </h2>
      <p className="mt-2 max-w-prose text-muted-foreground">
        Quatre prestations, un seul tarif horaire, et la même personne quand
        vous la reprenez.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SERVICES.map((service) => (
          <Link
            key={service.title}
            href={service.href}
            className="group flex flex-col gap-3 rounded-[var(--r-xl)] border border-border bg-card p-5 shadow-xs transition-all duration-200 ease-brand hover:-translate-y-1 hover:shadow-lg"
          >
            <span
              className={`flex size-14 items-center justify-center rounded-[var(--r-l)] ${service.bubble}`}
            >
              <service.icon className="size-7" aria-hidden />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-lg font-extrabold">{service.title}</span>
              <span className="text-sm text-muted-foreground">
                {service.tagline}
              </span>
            </span>
            {service.price !== null && (
              <span className="mt-auto flex items-center gap-1.5 text-sm font-bold text-brand">
                {service.price}
                <ArrowRightIcon
                  className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
