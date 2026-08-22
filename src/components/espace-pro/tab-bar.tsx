"use client";

import {
  CalendarDaysIcon,
  FolderCheckIcon,
  MessageCircleIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { TAB_BAR_HEIGHT } from "@/components/app-tab-bar";

/**
 * La navigation de l'espace intervenant, sous le pouce.
 *
 * **Quatre destinations, et aucune n'est une action.** L'espace client porte
 « Réserver » au milieu parce qu'un client vient créer quelque chose ; un
 * intervenant vient consulter — son planning, son dossier, ses messages. Y
 * poser une pastille pleine désignerait une action qui n'existe pas.
 *
 * **Le dossier est dans la barre, et c'est délibéré.** C'est l'écran qui
 * débloque tout le reste tant que le compte est inactif : l'enterrer sous
 * « profil » ferait chercher, au moment précis où l'on cherche déjà.
 *
 * Absente hors de l'espace intervenant, comme les deux autres barres : chacune
 * ne connaît que le sien, et elles sont mutuellement exclusives par
 * construction.
 */

const ONGLETS = [
  {
    href: "/intervenant",
    label: "Planning",
    icon: CalendarDaysIcon,
    /** Seul `/intervenant` exactement, sinon tous ses enfants s'allument. */
    exact: true,
  },
  { href: "/intervenant/messages", label: "Messages", icon: MessageCircleIcon },
  { href: "/intervenant/dossier", label: "Dossier", icon: FolderCheckIcon },
  { href: "/intervenant/profil", label: "Profil", icon: UserRoundIcon },
] as const;

function estEspacePro(pathname: string): boolean {
  return pathname === "/intervenant" || pathname.startsWith("/intervenant/");
}

export function EspaceProTabBar() {
  const pathname = usePathname();
  if (!estEspacePro(pathname)) return null;

  return (
    <>
      {/* Réserve la place en fin de flux : une barre fixée ne prend pas de
          place, et sans cela elle recouvrirait la dernière ligne de la page. */}
      <div
        aria-hidden
        className="md:hidden"
        style={{ height: TAB_BAR_HEIGHT }}
      />

      <nav
        aria-label="Espace intervenant"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-lg items-stretch">
          {ONGLETS.map((onglet) => {
            const Icon = onglet.icon;
            const ici =
              "exact" in onglet
                ? pathname === onglet.href
                : pathname.startsWith(onglet.href);

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
                    className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                      ici ? "bg-teal-50" : ""
                    }`}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {onglet.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
