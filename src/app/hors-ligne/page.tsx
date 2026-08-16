import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SITE, whatsappLink } from "@/lib/site";

/**
 * Page servie quand le réseau manque.
 *
 * Ce n'est pas un site de secours, et il ne faut pas essayer d'en faire un :
 * les prix et les créneaux servis depuis un cache seraient périmés, et
 * quelqu'un pourrait réserver une heure qui n'existe plus. Ce qu'il faut à qui
 * voulait réserver et n'a plus de réseau, c'est un numéro.
 *
 * Elle n'est pas indexée : elle ne répond à aucune recherche, et son contenu
 * n'aurait aucun sens dans un résultat.
 */
export const metadata: Metadata = {
  title: "Pas de connexion",
  robots: { index: false, follow: false },
};

export default function HorsLignePage() {
  return (
    <>
      <SiteHeader variant="tunnel" />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16 text-center">
        <h1 className="text-3xl font-black tracking-tight text-balance">
          Vous n&apos;avez plus de réseau
        </h1>
        <p className="mt-4 text-pretty text-muted-foreground">
          Nous préférons ne rien afficher plutôt qu&apos;un tarif ou un créneau
          gardés en mémoire : ils auraient toutes les chances d&apos;être faux.
          Réessayez dans un instant, ou appelez-nous — c&apos;est nous qui
          répondons.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <a
            href={`tel:${SITE.phoneE164}`}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-xs"
          >
            Appeler le {SITE.phone}
          </a>
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-border bg-card px-6 font-bold shadow-xs"
          >
            Écrire sur WhatsApp
          </a>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
