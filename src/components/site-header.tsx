import { PhoneIcon } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";

import { INTERVENANT_PAGE_READY } from "@/lib/facts";
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
    <header className="border-b border-border-subtle bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-6 py-4">
        <Logo className="shrink-0" />

        <nav
          aria-label="Navigation principale"
          className="flex shrink-0 items-center gap-1 text-sm sm:gap-1.5"
        >
          {variant === "site" ? (
            <>
              {/* Les liens de contenu se survolent en pastille sarcelle : c'est
                  la même grammaire que les listes du reste du système. */}
              <Link
                href="/tarifs"
                className="hidden rounded-full px-3.5 py-2.5 font-semibold text-ink-700 transition-colors hover:bg-teal-50 hover:text-teal-800 sm:inline-block"
              >
                Tarifs
              </Link>
              <Link
                href="/blog"
                className="hidden rounded-full px-3.5 py-2.5 font-semibold text-ink-700 transition-colors hover:bg-teal-50 hover:text-teal-800 sm:inline-block"
              >
                Conseils
              </Link>
              <Link
                href="/a-propos"
                className="hidden rounded-full px-3.5 py-2.5 font-semibold text-ink-700 transition-colors hover:bg-teal-50 hover:text-teal-800 sm:inline-block"
              >
                À propos
              </Link>
              {/* La porte côté offre, en desktop seulement : la barre
                  d'onglets mobile reste réservée au parcours client, et un
                  cinquième lien y prendrait la place de ce qui convertit. */}
              {INTERVENANT_PAGE_READY && (
                <Link
                  href="/travailler-avec-nous"
                  className="hidden rounded-full px-3.5 py-2.5 font-semibold text-ink-700 transition-colors hover:bg-teal-50 hover:text-teal-800 lg:inline-block"
                >
                  Devenir intervenant
                </Link>
              )}
              <Link
                href="/reserver"
                className="ml-1.5 inline-flex h-10 items-center rounded-full bg-primary px-5 font-bold whitespace-nowrap text-primary-foreground shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-mango-500 hover:shadow-mango"
              >
                Réserver
              </Link>
            </>
          ) : null}
          <a
            href={`tel:${SITE.phoneE164}`}
            className="inline-flex h-10 items-center rounded-full px-3 font-bold whitespace-nowrap text-brand transition-colors hover:bg-teal-50"
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
