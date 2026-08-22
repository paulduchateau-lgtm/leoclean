import { ArrowLeftIcon, CircleUserRoundIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { SiteMenu } from "@/components/site-menu";

import { clientEnv } from "@/lib/env";
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
 *
 * **Deux portes de connexion, jamais trois.** L'en-tête portait « Espace
 * client » et « Espace cleaner » côte à côte, ce qui demandait au visiteur de
 * savoir de quel côté du produit il se trouve avant de pouvoir se connecter.
 * Le site public n'a qu'un public : « Se connecter » y mène l'espace client, et
 * « Devenir pro » ouvre la face offre, qui porte sa propre porte
 * professionnelle. L'espace intervenant ne se désigne donc plus depuis la
 * vitrine client — il se rejoint par la section qui explique d'abord le métier.
 *
 * **La variante `pro` est cette face offre.** Elle remplace les liens de
 * contenu client par le retour vers la vitrine, posé tout en haut et en
 * secondaire, et par l'entrée de l'espace professionnel. Personne n'y arrive
 * par hasard : la ramener de force vers « Réserver » lui ferait quitter la
 * seule page qui lui parle.
 */
export function SiteHeader({
  variant = "site",
}: {
  variant?: "site" | "tunnel" | "pro";
}) {
  return (
    <header className="border-b border-border-subtle bg-background/90 backdrop-blur">
      {/* Le retour vers la vitrine client, tout en haut et en secondaire.
          Il est posé au-dessus de la barre plutôt que dedans : quelqu'un qui
          est arrivé là en cherchant un ménage chez lui doit pouvoir repartir
          au premier regard, sans que ce geste concurrence l'espace
          professionnel, qui est la raison d'être de la page. */}
      {variant === "pro" && !clientEnv.NEXT_PUBLIC_DEMO_STATIQUE && (
        <div className="border-b border-border-subtle bg-cream-50">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-end px-6 py-1.5">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-teal-50 hover:text-teal-800"
            >
              <ArrowLeftIcon className="size-3.5" aria-hidden />
              Vous cherchez un ménage chez vous ? Site client
            </Link>
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-6 py-4">
        {/* La face pro porte la pastille et ramène à la page qui dit le
            métier, jamais à la vitrine client — celle-ci a son propre retour,
            posé au-dessus et en secondaire. */}
        <Logo
          className="shrink-0"
          pro={variant === "pro"}
          href={variant === "pro" ? "/travailler-avec-nous" : "/"}
        />

        <nav
          aria-label="Navigation principale"
          className="flex shrink-0 items-center gap-1 text-sm sm:gap-1.5"
        >
          {variant === "site" ? (
            <>
              {/* **Trois choses à découvert, et rien de plus.** L'en-tête en
                  portait sept — tarifs, conseils, à propos, deux accès, bouton
                  de réservation, numéro — et débordait à 360 pixels, poussant la
                  marque hors du champ. Aucun réglage de palier ne répare une
                  barre qui a simplement trop à dire.

                  Ne restent que ce qu'on vient chercher : l'espace
                  professionnel, le sien, et le menu. La réservation et le
                  numéro sont dans le panneau, et « Réserver » reste sous le
                  pouce dans la barre d'onglets — plus près de la main que le
                  haut de l'écran ne l'a jamais été.

                  La vitrine statique n'embarque ni les espaces connectés ni la
                  face offre : les liens y pointeraient vers des pages
                  absentes. */}
              {!clientEnv.NEXT_PUBLIC_DEMO_STATIQUE && (
                <>
                  <Link
                    href="/travailler-avec-nous#espace-professionnel"
                    className="rounded-full px-3 py-2.5 font-semibold whitespace-nowrap text-ink-700 underline-offset-4 transition-colors hover:bg-teal-50 hover:text-teal-800 hover:underline"
                  >
                    Espace pro
                  </Link>
                  {/* L'icône de personnage plutôt que deux mots : c'est le
                      pictogramme que tout le monde cherche pour « chez moi », et
                      il tient là où « Se connecter » faisait déborder la barre.
                      L'intitulé accessible reste écrit en toutes lettres. */}
                  <Link
                    href="/mon-espace"
                    aria-label="Mon espace client"
                    title="Mon espace client"
                    className="inline-flex size-11 items-center justify-center rounded-full text-ink-800 transition-colors hover:bg-teal-50 hover:text-teal-800"
                  >
                    <CircleUserRoundIcon className="size-6" aria-hidden />
                  </Link>
                </>
              )}
              <SiteMenu />
            </>
          ) : null}

          {variant === "pro" ? (
            <>
              <Link
                href="#candidature"
                className="hidden rounded-full px-3.5 py-2.5 font-semibold text-ink-700 transition-colors hover:bg-teal-50 hover:text-teal-800 sm:inline-block"
              >
                Devenir cleaner
              </Link>
              {/* La porte professionnelle : un seul bouton, qui mène au bloc
                  où les deux entrées — se connecter, ou créer son compte —
                  sont posées côte à côte. Envoyer directement sur la connexion
                  fermerait la porte à qui n'a pas encore de compte, et
                  l'inverse renverrait un intervenant déjà inscrit vers un
                  formulaire de candidature. */}
              <Link
                href="#espace-professionnel"
                className="ml-1.5 inline-flex h-10 items-center rounded-full bg-primary px-5 font-bold whitespace-nowrap text-primary-foreground shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-pineapple-400 hover:shadow-action"
              >
                Espace pro
              </Link>
            </>
          ) : null}
          {/* Le numéro reste sur le tunnel et sur la face professionnelle, où
              il est le recours quand le parcours coince. Il quitte la vitrine :
              il y prenait la place des accès, et le panneau le porte à un
              geste. */}
          {variant !== "site" && (
            <a
              href={`tel:${SITE.phoneE164}`}
              className="inline-flex h-10 items-center rounded-full px-3 font-bold whitespace-nowrap text-brand transition-colors hover:bg-teal-50"
              aria-label={`Appeler ${SITE.name} au ${SITE.phone}`}
            >
              <PhoneIcon className="size-5 sm:hidden" aria-hidden />
              <span className="hidden sm:inline">{SITE.phone}</span>
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
