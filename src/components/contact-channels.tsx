import { MailIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";

import { SITE, whatsappLink } from "@/lib/site";

/**
 * Canaux de contact.
 *
 * Trois portes plutôt qu'une. Appeler demande le plus d'engagement et convertit
 * le mieux ; WhatsApp lève la barrière de l'appel, ce qui compte pour un
 * service qu'on fait entrer chez soi et sur lequel on veut poser trois
 * questions avant de se décider ; l'email reste le recours de ceux qui
 * écrivent le soir.
 */
export function ContactChannels({
  communeName,
  className,
}: {
  communeName?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <a
          href={`tel:${SITE.phoneE164}`}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-mango-500 hover:shadow-mango"
        >
          <PhoneIcon className="size-4" aria-hidden />
          {SITE.phone}
        </a>

        <a
          href={whatsappLink(communeName)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-border bg-card px-6 font-bold shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:border-teal-300 hover:bg-teal-50"
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
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-border bg-card px-6 font-bold shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:border-teal-300 hover:bg-teal-50"
        >
          <MailIcon className="size-4" aria-hidden />
          Envoyer un email
        </a>
      </div>
    </div>
  );
}
