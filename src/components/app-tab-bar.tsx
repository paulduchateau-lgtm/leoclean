"use client";

import {
  CalendarIcon,
  CircleHelpIcon,
  EuroIcon,
  HouseIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import dynamic from "next/dynamic";
import { isAppPath } from "@/lib/hosting";

/**
 * Le panneau de contact n'est téléchargé qu'à l'ouverture.
 *
 * Il embarque le `Dialog` de Base UI — piège à focus, gestion du fond, couche
 * de portail — soit plusieurs dizaines de kilo-octets pour un écran que la
 * plupart des visiteurs n'ouvriront jamais. La barre d'onglets vivant dans le
 * gabarit racine, ce poids se serait payé sur chaque page du site.
 */
const ContactSheet = dynamic(() =>
  import("@/components/contact-sheet").then((module) => module.ContactSheet),
);

/**
 * Barre d'onglets, en bas de l'écran, sur mobile seulement.
 *
 * Ce que ça change n'est pas esthétique : une navigation posée sous le pouce
 * dit « application », une navigation posée en haut de page dit « site
 * vitrine ». Le service se consulte debout, dans la rue, à une main — c'est là
 * que la décision de réserver se prend.
 *
 * Trois destinations et une porte de secours. L'aide n'est pas une page : ce
 * serait ajouter un écran entre la question et la réponse, alors que la
 * réponse tient en trois liens. Elle ouvre le panneau de contact.
 *
 * **Absente des espaces applicatifs.** `isAppPath` couvre le tunnel, la
 * connexion et les espaces connectés : pendant une réservation, un seul modèle
 * de navigation à la fois — la progression et le bouton d'étape. La même règle
 * vaut déjà pour l'en-tête, qui s'y réduit à sa variante `tunnel`.
 *
 * **Absente en desktop.** La navigation horizontale de l'en-tête y reste seule
 * maîtresse : deux navigations concurrentes obligeraient à choisir laquelle
 * fait foi.
 */

const TABS = [
  { href: "/", label: "Accueil", icon: HouseIcon },
  { href: "/tarifs", label: "Tarifs", icon: EuroIcon },
  { href: "/reserver", label: "Réserver", icon: CalendarIcon },
] as const;

/**
 * Hauteur réservée sous le contenu, barre système comprise.
 *
 * Exposée en variable pour que la barre de rappel de prix vienne s'empiler
 * juste au-dessus sans que personne ait à recopier une hauteur.
 */
export const TAB_BAR_HEIGHT = "calc(4rem + env(safe-area-inset-bottom))";

export function AppTabBar() {
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);

  if (isAppPath(pathname)) return null;

  return (
    <>
      {/*
        Réserve la place de la barre en fin de flux plutôt que dans chaque
        `<main>`. Une barre fixée ne prend pas de place : sans cela, elle
        recouvrirait la dernière ligne du pied de page, qui porte les mentions
        légales et le téléphone.
      */}
      <div
        aria-hidden
        className="md:hidden"
        style={{ height: TAB_BAR_HEIGHT }}
      />

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-lg items-stretch">
          {TABS.map((tab) => {
            const active =
              tab.href === "/"
                ? pathname === "/"
                : pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                    active ? "text-mint-800" : "text-ink-600"
                  }`}
                >
                  {/* La pastille menthe est la même que celle des liens de
                      l'en-tête : un seul vocabulaire d'état actif. */}
                  <span
                    className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                      active ? "bg-mint-50" : ""
                    }`}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {tab.label}
                </Link>
              </li>
            );
          })}

          <li className="flex-1">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={helpOpen}
              className="flex min-h-16 w-full flex-col items-center justify-center gap-1 text-xs font-bold text-ink-600 transition-colors"
            >
              <span className="flex h-7 w-12 items-center justify-center rounded-full">
                <CircleHelpIcon className="size-5" aria-hidden />
              </span>
              Aide
            </button>
          </li>
        </ul>
      </nav>

      <ContactSheet open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
