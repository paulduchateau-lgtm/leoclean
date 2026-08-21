"use client";

import { MailIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";
import { useRef, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SITE, whatsappLink } from "@/lib/site";

/**
 * Panneau de contact, ouvert par le bas.
 *
 * Mêmes trois portes que `ContactChannels`, dans le même ordre d'engagement —
 * appeler convertit le mieux, WhatsApp lève la barrière de l'appel, l'email
 * reste le recours de ceux qui écrivent le soir. Ce qui change est le moment :
 * la page en garde un bloc à lire, la coque applicative en donne un accès
 * permanent, à portée de pouce.
 *
 * Le composant s'appuie sur le `Dialog` de Base UI, qui apporte le piège à
 * focus, la fermeture par Échap et par le fond. Le glissé vers le bas est
 * ajouté ici : c'est le geste qu'on essaie d'abord sur un panneau de ce genre,
 * et ne pas y répondre donne l'impression d'un écran bloqué.
 */
export function ContactSheet({
  open,
  onOpenChange,
  communeName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Commune connue, reprise dans le message WhatsApp et l'objet du mail. */
  communeName?: string;
}) {
  /* Déplacement en cours du panneau, en pixels. Jamais négatif : on ne tire
     pas un panneau vers le haut au-delà de sa position ouverte. */
  const [dragOffset, setDragOffset] = useState(0);
  const dragStart = useRef<number | null>(null);

  /** Au-delà, le geste est une intention de fermer, pas une hésitation. */
  const DISMISS_THRESHOLD_PX = 80;

  function endDrag() {
    if (dragStart.current === null) return;
    const travelled = dragOffset;
    dragStart.current = null;
    setDragOffset(0);
    if (travelled > DISMISS_THRESHOLD_PX) onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="rounded-t-[var(--r-xl)] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        style={
          dragOffset > 0
            ? { transform: `translateY(${dragOffset}px)`, transition: "none" }
            : undefined
        }
      >
        {/* La poignée porte le geste. Elle est décorative pour les
            technologies d'assistance, qui disposent d'Échap. */}
        <div
          aria-hidden
          className="cursor-grab px-4 pt-3 pb-1 active:cursor-grabbing"
          onPointerDown={(event) => {
            dragStart.current = event.clientY;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragStart.current === null) return;
            setDragOffset(Math.max(0, event.clientY - dragStart.current));
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-border-strong" />
        </div>

        <SheetHeader className="pt-1 pb-0">
          <SheetTitle>Une question avant de réserver ?</SheetTitle>
          <SheetDescription>
            Quelqu&apos;un répond, dans le secteur. Ce n&apos;est pas un
            standard.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4 pt-2 pb-2">
          <a
            href={`tel:${SITE.phoneE164}`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-xs transition-colors duration-200 ease-brand hover:bg-pineapple-400"
            onClick={() => onOpenChange(false)}
          >
            <PhoneIcon className="size-4" aria-hidden />
            Appeler {SITE.phone}
          </a>

          <a
            href={whatsappLink(communeName)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-border bg-card px-6 font-bold shadow-xs transition-colors duration-200 ease-brand hover:border-teal-300 hover:bg-teal-50"
            onClick={() => onOpenChange(false)}
          >
            <MessageCircleIcon className="size-4" aria-hidden />
            Écrire sur WhatsApp
          </a>

          <a
            href={`mailto:${SITE.email}${
              communeName
                ? `?subject=${encodeURIComponent(`Ménage à domicile à ${communeName}`)}`
                : ""
            }`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-border bg-card px-6 font-bold shadow-xs transition-colors duration-200 ease-brand hover:border-teal-300 hover:bg-teal-50"
            onClick={() => onOpenChange(false)}
          >
            <MailIcon className="size-4" aria-hidden />
            Envoyer un email
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
