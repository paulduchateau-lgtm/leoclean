import type { Metadata, Viewport } from "next";
import { Figtree, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";

import { AppTabBar } from "@/components/app-tab-bar";
import { EspaceClientTabBar } from "@/components/espace-client-tab-bar";
import { BandeauEnvironnement } from "@/components/bandeau-environnement";
import { DemoBanner } from "@/components/demo-banner";
import { ServiceWorker } from "@/components/service-worker";
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

/**
 * Police de titrage : Alan Sans porte tous les titres et les grands chiffres.
 * Elle est auto-hébergée depuis le dépôt — elle n'est pas disponible chez
 * `next/font/google` — et préchargée : le titre de chaque page la demande au
 * premier rendu.
 */
const sans = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const display = localFont({
  src: "./fonts/alansans-variable.woff2",
  variable: "--font-display",
  display: "swap",
  weight: "300 900",
  preload: true,
});

/**
 * Chiffres posés : prix, codes postaux, horaires. Non préchargée — elle
 * n'apparaît qu'au fil de la lecture, jamais au-dessus de la ligne de
 * flottaison.
 */
const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600"],
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
  /**
   * `url` n'est délibérément pas posé ici. Une valeur héritée est la même
   * pour tout le site : elle rattachait à l'accueil les partages de chaque
   * page qui ne déclarait pas son propre bloc. Chaque page pose le sien, via
   * `pageMetadata()`.
   */
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: SITE.name,
  },
  /**
   * La carte de partage fait 1200 × 630 : en `summary`, X la recadrerait en
   * vignette carrée de 144 pixels, où ni le nom de la commune ni le tarif ne
   * seraient lisibles. `twitter:image` n'est pas renseigné — les moteurs de
   * prévisualisation retombent sur `og:image`, que `opengraph-image.tsx`
   * fournit sur toutes les pages.
   */
  twitter: { card: "summary_large_image" },
  /*
   * Icônes de l'application, versionnées dans `public/` et produites par
   * `scripts/generer-icones.jsx` depuis le symbole du design system.
   */
  icons: {
    icon: [{ url: "/icone-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  /**
   * La vitrine statique est un double intégral du futur site : seize pages
   * communes, douze pages d'intention, quatre articles, tous rédigés pour se
   * classer sur les mêmes requêtes. Laissée indexable, elle concurrencerait
   * `leoclean.fr` sur les requêtes mêmes qu'elle sert à gagner.
   */
  robots:
    clientEnv.NEXT_PUBLIC_DEMO_STATIQUE ||
    clientEnv.NEXT_PUBLIC_ENVIRONMENT !== "production"
      ? { index: false, follow: false }
      : { index: true, follow: true },
};

export const viewport: Viewport = {
  /**
   * La page occupe l'écran jusque sous l'encoche et la barre d'accueil iOS.
   * C'est la condition pour que `env(safe-area-inset-*)` renvoie autre chose
   * que zéro — sans quoi une barre fixée en bas se retrouve à cheval sur la
   * barre système.
   */
  viewportFit: "cover",
  themeColor: [
    // --bg (blanc chaud) et teal-950 du design system tropical punch.
    { media: "(prefers-color-scheme: light)", color: "#FFFCF9" },
    { media: "(prefers-color-scheme: dark)", color: "#022727" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Un seul bandeau à la fois : la vitrine statique dit déjà tout ce
            que dirait celui de l'environnement, et plus précisément. */}
        {clientEnv.NEXT_PUBLIC_DEMO_STATIQUE ? (
          <DemoBanner />
        ) : clientEnv.NEXT_PUBLIC_ENVIRONMENT !== "production" ? (
          <BandeauEnvironnement />
        ) : null}
        {children}
        {/* La coque applicative se pose ici, une fois pour tout le site : elle
            décide seule des écrans où elle n'a rien à faire. */}
        <AppTabBar />
        {/*
          Deux barres, mutuellement exclusives par construction : `AppTabBar` se
          retire des chemins applicatifs, celle-ci ne s'affiche que sur l'espace
          client. Les fondre en une seule aurait demandé un composant qui sait
          tout de tous les espaces ; les poser côte à côte laisse chacune ne
          connaître que le sien.
        */}
        <EspaceClientTabBar />
        {/* La vitrine statique n'enregistre rien : c'est un double du site,
            servi sous un chemin de dépôt. */}
        <ServiceWorker enabled={!clientEnv.NEXT_PUBLIC_DEMO_STATIQUE} />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
