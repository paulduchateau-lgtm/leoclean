import Link from "next/link";

import { Logo } from "@/components/brand/logo";

import { SITE } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-6 py-4">
        <Logo />

        <nav
          aria-label="Navigation principale"
          className="flex items-center gap-5 text-sm"
        >
          <Link href="/tarifs" className="hover:text-primary">
            Tarifs
          </Link>
          {/* Masqués sur mobile : l'espace revient au numéro, qui convertit. */}
          <Link href="/blog" className="hidden hover:text-primary sm:inline">
            Conseils
          </Link>
          <Link
            href="/a-propos"
            className="hidden hover:text-primary sm:inline"
          >
            À propos
          </Link>
          <Link
            href="/etre-rappele"
            className="hidden hover:text-primary sm:inline"
          >
            Être rappelé
          </Link>
          <Link
            href="/reserver"
            className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground"
          >
            Réserver
          </Link>
          <a
            href={`tel:${SITE.phoneE164}`}
            className="font-medium text-primary"
            aria-label={`Appeler LéoClean au ${SITE.phone}`}
          >
            {SITE.phone}
          </a>
        </nav>
      </div>
    </header>
  );
}
