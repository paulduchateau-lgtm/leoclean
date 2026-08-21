"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { TAB_BAR_HEIGHT } from "@/components/app-tab-bar";
import { formatHourlyRate } from "@/lib/pricing";
import { LOWEST_HOURLY_RATE_CENTS } from "@/lib/pricing/public-grid";

/**
 * Rappel de prix et bouton de réservation, collés au bas de l'écran.
 *
 * Les pages de contenu sont longues : sur mobile, quelqu'un qui a lu la
 * typologie d'habitat de sa commune se trouve à deux écrans du seul bouton qui
 * l'emmène quelque part. La barre remet le prix et l'action à portée de pouce
 * pendant toute la lecture.
 *
 * Deux règles, et rien entre les deux :
 *
 * - **Elle n'apparaît qu'une fois la personne engagée.** Posée d'emblée, elle
 *   recouvrirait le contenu que la page est censée faire lire, et redirait ce
 *   que le héros vient d'annoncer. Le repère est le point de montage du
 *   composant : dès qu'il est sorti par le haut, la lecture a commencé.
 * - **Elle s'efface devant le vrai bouton.** Quand le bloc de réservation de
 *   la page est à l'écran, deux appels à l'action concurrents demanderaient de
 *   choisir lequel compte. Tout élément portant `data-booking-cta` la fait
 *   disparaître.
 *
 * Aucun écouteur de défilement : deux `IntersectionObserver`, qui ne réveillent
 * le fil principal que sur franchissement. Un écouteur de défilement se
 * déclenche à chaque pixel, et c'est le premier suspect d'un INP dégradé.
 *
 * Le composant se monte **après le héros** de la page, jamais dans le gabarit :
 * c'est son emplacement dans le document qui définit « engagé ».
 */
export function StickyBookingCta({
  /** Commune d'arrivée, transmise au tunnel pour éviter de la redemander. */
  communeSlug,
}: {
  communeSlug?: string;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [pastSentinel, setPastSentinel] = useState(false);
  const [bookingCtaOnScreen, setBookingCtaOnScreen] = useState(false);

  useEffect(() => {
    const element = sentinel.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      // Sorti par le haut, et non pas simplement hors champ : un repère encore
      // sous le pli ne signifie pas qu'on a commencé à lire.
      setPastSentinel(
        !entry.isIntersecting && entry.boundingClientRect.top < 0,
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const targets = document.querySelectorAll("[data-booking-cta]");
    if (targets.length === 0) return;

    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      setBookingCtaOnScreen(visible.size > 0);
    });
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const shown = pastSentinel && !bookingCtaOnScreen;

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px" />

      {/*
        Toujours dans le document, jamais démontée : la retirer et la remettre
        ferait sauter la mise en page à chaque franchissement. Elle glisse hors
        de l'écran, et `inert` la retire de l'ordre de tabulation tant qu'elle
        n'est pas là.
      */}
      <div
        data-sticky-cta
        inert={!shown}
        aria-hidden={!shown}
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-background/95 backdrop-blur transition-transform duration-200 ease-brand md:hidden ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
        /*
          Ancrée au bas de la fenêtre et non au-dessus de la barre d'onglets,
          qu'elle dégage par un remplissage. C'est ce qui permet de la faire
          sortir d'un `translateY(100%)` : mesurée depuis le haut de la barre
          d'onglets, la même translation la laissait à cheval sur elle.
        */
        style={{ paddingBottom: TAB_BAR_HEIGHT }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-2.5">
          <p className="text-sm leading-tight font-bold">
            À partir de {formatHourlyRate(LOWEST_HOURLY_RATE_CENTS)}
            <span className="block text-xs font-normal text-muted-foreground">
              Rien à payer aujourd&apos;hui
            </span>
          </p>

          <Link
            href={
              communeSlug ? `/reserver?commune=${communeSlug}` : "/reserver"
            }
            tabIndex={shown ? undefined : -1}
            className="inline-flex h-12 shrink-0 items-center rounded-full bg-primary px-6 font-bold whitespace-nowrap text-primary-foreground shadow-xs transition-colors duration-200 ease-brand hover:bg-pineapple-400"
          >
            Réserver
          </Link>
        </div>
      </div>
    </>
  );
}
