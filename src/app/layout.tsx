import type { Metadata, Viewport } from "next";
import { Epilogue, Figtree } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
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
  robots: { index: true, follow: true },
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
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
