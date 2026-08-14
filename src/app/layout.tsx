import type { Metadata, Viewport } from "next";
import { Epilogue, Figtree } from "next/font/google";

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
const heading = Epilogue({
  variable: "--font-heading-family",
  subsets: ["latin"],
  display: "swap",
});

const sans = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
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
    // linen-50 et ink-900 du design system.
    { media: "(prefers-color-scheme: light)", color: "#FBF9F5" },
    { media: "(prefers-color-scheme: dark)", color: "#23211D" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${sans.variable} ${heading.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {clientEnv.NEXT_PUBLIC_DEMO_STATIQUE ? <DemoBanner /> : null}
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
