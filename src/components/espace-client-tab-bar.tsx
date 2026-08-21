"use client";

import {
  CalendarDaysIcon,
  MessageCircleIcon,
  PlusIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { TAB_BAR_HEIGHT } from "@/components/app-tab-bar";

/**
 * La navigation de l'espace client, sous le pouce.
 *
 * **L'espace client se consultait comme une page, pas comme une application.**
 * Une pile de liens en haut, un pied de page en bas, et rien sous le pouce : le
 * geste le plus fréquent — voir sa prochaine intervention, écrire à son
 * intervenant — demandait de remonter en haut de l'écran. La barre d'onglets
 * du site ne s'y affichait pas, `isAppPath` l'excluant à juste titre : elle
 * mène à la vitrine, pas à l'espace.
 *
 * **Quatre destinations, et la réservation au milieu.** Elle est la seule qui
 * ne consulte rien : les trois autres regardent ce qui existe, celle-là crée.
 * D'où la pastille pleine, plus haute que les autres — la même grammaire que
 * le bouton principal d'un écran, et le seul jaune de la barre.
 *
 * **Elle ne s'affiche pas pendant une réservation.** `/reserver` a sa propre
 * progression et son propre bouton d'étape : deux modèles de navigation à la
 * fois obligeraient à choisir lequel fait foi. C'est la règle déjà tenue par
 * l'en-tête, qui s'y réduit à sa variante `tunnel`.
 *
 * **Ni chez l'intervenant, ni à l'administration.** Ces espaces ont leurs
 * propres gestes, et « Réserver une session » n'a aucun sens pour quelqu'un qui
 * en accepte.
 */

const ONGLETS = [
  {
    href: "/mon-espace/messages",
    label: "Messages",
    icon: MessageCircleIcon,
  },
  {
    href: "/mon-espace",
    label: "Mes sessions",
    icon: CalendarDaysIcon,
    /** Seul `/mon-espace` exactement, sinon tous ses enfants s'allumeraient. */
    exact: true,
  },
] as const;

const COMPTE = {
  href: "/mon-compte",
  label: "Mon compte",
  icon: UserRoundIcon,
} as const;

/** Les chemins où la barre a sa place. */
function estEspaceClient(pathname: string): boolean {
  return (
    pathname === "/mon-espace" ||
    pathname.startsWith("/mon-espace/") ||
    pathname === "/mon-compte" ||
    pathname.startsWith("/mon-compte/")
  );
}

/**
 * L'emplacement d'icône, de hauteur identique pour les quatre onglets.
 *
 * La pastille de « Réserver » est plus haute que les trois autres — c'est ce
 * qui la désigne comme l'action — et sans emplacement commun son libellé
 * descendait d'autant : quatre mots sur deux lignes de base. Même défaut que
 * les tuiles du bandeau de chiffres, même remède : on fixe le contenant, pas
 * le contenu.
 *
 * **La hauteur est posée en style, pas en classe.** C'est la seule grandeur du
 * composant qui doit être identique aux quatre onglets sous peine de rendre le
 * défaut qu'on corrige ; la confier à une classe utilitaire la rendrait
 * dépendante de ce que le générateur de CSS a bien voulu émettre, ce qui est
 * beaucoup de confiance pour quatre lignes de base.
 */
const HAUTEUR_ICONE = 36;
const EMPLACEMENT = "flex items-center justify-center";

export function EspaceClientTabBar() {
  const pathname = usePathname();
  if (!estEspaceClient(pathname)) return null;

  const actif = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* Réserve la place en fin de flux plutôt que dans chaque `<main>` : une
          barre fixée ne prend pas de place, et sans cela elle recouvrirait la
          dernière ligne de la page. */}
      <div
        aria-hidden
        className="md:hidden"
        style={{ height: TAB_BAR_HEIGHT }}
      />

      <nav
        aria-label="Espace client"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-lg items-stretch">
          {ONGLETS.map((onglet) => {
            const Icon = onglet.icon;
            const ici = actif(onglet.href, "exact" in onglet);
            return (
              <li key={onglet.href} className="flex-1">
                <Link
                  href={onglet.href}
                  aria-current={ici ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                    ici ? "text-teal-800" : "text-ink-600"
                  }`}
                >
                  <span
                    className={EMPLACEMENT}
                    style={{ height: HAUTEUR_ICONE }}
                  >
                    <span
                      className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                        ici ? "bg-teal-50" : ""
                      }`}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                  </span>
                  {onglet.label}
                </Link>
              </li>
            );
          })}

          {/* La seule qui crée quelque chose. Texte encre sur ananas — le jaune
              ne porte jamais de blanc, 1,2:1. */}
          <li className="flex-1">
            <Link
              href="/reserver"
              className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-bold text-ink-800"
            >
              <span className={EMPLACEMENT} style={{ height: HAUTEUR_ICONE }}>
                <span className="flex h-9 w-14 items-center justify-center rounded-full bg-primary text-ink-900 shadow-action">
                  <PlusIcon className="size-5" strokeWidth={2.5} aria-hidden />
                </span>
              </span>
              Réserver
            </Link>
          </li>

          <li className="flex-1">
            <Link
              href={COMPTE.href}
              aria-current={actif(COMPTE.href) ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${
                actif(COMPTE.href) ? "text-teal-800" : "text-ink-600"
              }`}
            >
              <span className={EMPLACEMENT} style={{ height: HAUTEUR_ICONE }}>
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                    actif(COMPTE.href) ? "bg-teal-50" : ""
                  }`}
                >
                  <COMPTE.icon className="size-5" aria-hidden />
                </span>
              </span>
              {COMPTE.label}
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
}
