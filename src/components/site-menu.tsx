"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SITE } from "@/lib/site";

/**
 * Le menu du site, derrière un seul bouton.
 *
 * **L'en-tête portait sept destinations et débordait à 360 pixels** : liens de
 * contenu, deux accès, bouton de réservation et numéro de téléphone. Une barre
 * qui déborde pousse la marque hors du champ, et aucun réglage de palier ne
 * répare une barre qui a simplement trop à dire.
 *
 * Ne restent donc à découvert que les trois choses qu'on vient chercher :
 * l'accueil par la marque, l'espace professionnel, et le sien. Le reste —
 * tarifs, conseils, à propos, réservation, téléphone — vit ici, à un geste.
 *
 * Le panneau réutilise le `Sheet` de Base UI, déjà employé par le panneau de
 * contact : piège à focus, fermeture par Échap et par le fond. Il s'ouvre par
 * la droite, d'où vient le bouton.
 */
export function SiteMenu() {
  const [ouvert, setOuvert] = useState(false);

  const liens = [
    { href: "/tarifs", libelle: "Tarifs" },
    { href: "/blog", libelle: "Conseils ménage" },
    { href: "/zones-desservies", libelle: "Communes desservies" },
    { href: "/a-propos", libelle: "À propos" },
    { href: "/etre-rappele", libelle: "Être rappelé" },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        aria-label="Ouvrir le menu"
        className="inline-flex size-11 items-center justify-center rounded-full text-ink-800 transition-colors hover:bg-teal-50 hover:text-teal-800"
      >
        <MenuIcon className="size-6" aria-hidden />
      </button>

      <Sheet open={ouvert} onOpenChange={setOuvert}>
        <SheetContent side="right" className="w-full max-w-sm">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>

          <nav aria-label="Menu du site" className="px-4 pb-6">
            <ul className="divide-y divide-border">
              {liens.map((lien) => (
                <li key={lien.href}>
                  <Link
                    href={lien.href}
                    onClick={() => setOuvert(false)}
                    className="flex min-h-14 items-center font-semibold"
                  >
                    {lien.libelle}
                  </Link>
                </li>
              ))}
            </ul>

            {/* La réservation reste le geste principal du site : elle est dans
                le panneau en bouton plein, pas en ligne de liste. */}
            <Link
              href="/reserver"
              onClick={() => setOuvert(false)}
              className="mt-6 flex min-h-12 items-center justify-center rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-action transition-colors hover:bg-pineapple-400"
            >
              Réserver un ménage
            </Link>

            {/* Le numéro quitte la barre mais pas le site : c'est le canal qui
                convertit le mieux, et le retirer entièrement coûterait plus que
                la place qu'il prenait. */}
            <a
              href={`tel:${SITE.phoneE164}`}
              className="mt-3 flex min-h-12 items-center justify-center rounded-full border-2 border-border font-bold text-brand transition-colors hover:bg-teal-50"
            >
              {SITE.phone}
            </a>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
