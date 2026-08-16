import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";

import { DemoBanner } from "@/components/demo-banner";
import { Toaster } from "@/components/ui/sonner";
import { clientEnv } from "@/lib/env";
import { SITE } from "@/lib/site";

import "./globals.css";

/**
 * Polices du design system.
 *
 * Elles sont chargées par `next/font`, qui les auto-héberge et les précharge,
 * plutôt que par l'`@import` Google Fonts du système : celui-ci bloque le
 * rendu, ce qui est rédhibitoire sur des pages dont le référencement est le
 * canal d'acquisition principal.
 */
const sans = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Police d'accent, réservée à un mot par titre marketing. Elle n'est pas
 * préchargée : aucun écran ne la demande au premier rendu, et la précharger
 * coûterait une requête bloquante pour trois mots sur tout le site.
 */
const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  style: "italic",
  weight: ["600"],
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ménage à domicile à Léognan et en Communauté de communes de Montesquieu`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: SITE.name,
    url: SITE.url,
  },
  /**
   * La vitrine statique est un double intégral du futur site : seize pages
   * communes, douze pages d'intention, quatre articles, tous rédigés pour se
   * classer sur les mêmes requêtes. Laissée indexable, elle concurrencerait
   * `leoclean.fr` sur les requêtes mêmes qu'elle sert à gagner.
   */
  robots: clientEnv.NEXT_PUBLIC_DEMO_STATIQUE
    ? { index: false, follow: false }
    : { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    // ink-0 et ink-950 du design system.
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1B16" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${sans.variable} ${display.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {clientEnv.NEXT_PUBLIC_DEMO_STATIQUE ? <DemoBanner /> : null}
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
