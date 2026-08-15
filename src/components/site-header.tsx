import { PhoneIcon } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";

import { SITE } from "@/lib/site";

/**
 * En-tête du site.
 *
 * L'arbitrage sur mobile est un arbitrage de conversion, pas de place : à
 * 390 pixels, seuls tiennent le logotype, le bouton de réservation et le
 * téléphone. Les liens de contenu — tarifs, conseils, à propos — réapparaissent
 * dès qu'il y a de quoi les afficher.
 *
 * Le numéro s'y réduit à son icône : écrit en toutes lettres, il occupait deux
 * lignes et poussait la marque sous le reste de la barre. L'intitulé
 * accessible, lui, énonce toujours le numéro complet.
 *
 * **La variante `tunnel` ne porte que la marque et le téléphone.** Un seul
 * modèle de navigation à la fois : pendant une réservation, les liens de
 * contenu et le bouton « Réserver » ne servent qu'à sortir du parcours en
 * cours. Le téléphone reste, parce qu'il n'en fait pas sortir — c'est l'autre
 * façon de réserver.
 */
export function SiteHeader({
  variant = "site",
}: {
  variant?: "site" | "tunnel";
}) {
  return (
    <header className="border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-6 py-4">
        <Logo className="shrink-0" />

        <nav
          aria-label="Navigation principale"
          className="flex shrink-0 items-center gap-4 text-sm sm:gap-5"
        >
          {variant === "site" ? (
            <>
              <Link
                href="/tarifs"
                className="hidden hover:text-primary sm:inline"
              >
                Tarifs
              </Link>
              <Link
                href="/blog"
                className="hidden hover:text-primary sm:inline"
              >
                Conseils
              </Link>
              <Link
                href="/a-propos"
                className="hidden hover:text-primary sm:inline"
              >
                À propos
              </Link>
              <Link
                href="/reserver"
                className="rounded-lg bg-primary px-3 py-1.5 font-medium whitespace-nowrap text-primary-foreground"
              >
                Réserver
              </Link>
            </>
          ) : null}
          <a
            href={`tel:${SITE.phoneE164}`}
            className="font-medium whitespace-nowrap text-primary"
            aria-label={`Appeler ${SITE.name} au ${SITE.phone}`}
          >
            <PhoneIcon className="size-5 sm:hidden" aria-hidden />
            <span className="hidden sm:inline">{SITE.phone}</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
