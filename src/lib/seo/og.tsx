import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { formatHourlyRate } from "@/lib/pricing";
import { LOWEST_HOURLY_RATE_CENTS } from "@/lib/pricing/public-grid";
import { OG_SIZE } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";

/**
 * Carte de partage Open Graph.
 *
 * C'est la première impression de la marque hors du site : dans WhatsApp, dans
 * un SMS, dans un message Facebook. Une page sans `og:image` s'y affiche en
 * ligne de texte grise, ce qui coûte des clics sur le canal même par lequel un
 * service de proximité se recommande.
 *
 * L'image est générée à la construction, jamais à la requête : les pages
 * publiques sont prérendues et leur carte l'est avec elles.
 */

export { OG_CONTENT_TYPE, OG_SIZE, ogAlt } from "@/lib/seo/metadata";

/**
 * Polices du design system, en TrueType.
 *
 * `next/font` sert le site en woff2, que le moteur de rendu de `next/og` ne
 * sait pas lire : les fichiers sont donc versionnés dans `assets/fonts/`, avec
 * leur licence. Deux graisses suffisent — le système fait sa hiérarchie par la
 * graisse, 900 pour trancher et 400 pour lire.
 */
const [figtreeRegular, figtreeBlack] = await Promise.all([
  readFile(join(process.cwd(), "assets/fonts/Figtree-Regular.ttf")),
  readFile(join(process.cwd(), "assets/fonts/Figtree-Black.ttf")),
]);

/**
 * Couleurs recopiées du design system plutôt que référencées.
 *
 * Le moteur de `next/og` ne résout pas les variables CSS : il ne voit ni la
 * feuille de styles ni le thème. C'est la même exception que
 * `magic-link-email.tsx`, et pour la même raison — une surface rendue hors du
 * navigateur. Chaque valeur porte le nom de son token, pour qu'une évolution
 * de la palette se retrouve ici.
 */
const COLORS = {
  /* cream-50 */ background: "#fffaf2",
  /* ink-900 */ text: "#16261f",
  /* ink-600 */ textSecondary: "#5a6b65",
  /* ink-500 */ textTertiary: "#74857e",
  /* mint-400 */ brand: "#63e6be",
  /* mint-700 */ brandInk: "#0a7c61",
  /* ink-100 */ border: "#eaf0ed",
} as const;

/**
 * Symbole de la marque, en data URI.
 *
 * Le moteur de rendu traite les images bien mieux que le SVG en ligne, et
 * `currentColor` n'y a de toute façon aucun sens : le tracé porte donc la
 * menthe 700, la seule valeur de la palette qui tienne le contraste sur fond
 * clair.
 */
const SYMBOL = `data:image/svg+xml;base64,${Buffer.from(
  `<svg width="72" height="72" viewBox="165 27 57 57" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M184.59 46.6295C188.186 43.0118 191.333 38.8101 193.667 34.323C195.98 38.8375 199.157 43.0525 202.786 46.6663C206.429 50.295 210.681 53.4715 215.225 55.8017C210.686 58.1462 206.443 61.3392 202.809 64.9748C199.19 68.595 196.019 72.8098 193.704 77.3101C191.373 72.8182 188.223 68.5988 184.625 64.9653C181.015 61.3212 176.807 58.1176 172.288 55.7713C176.789 53.4344 180.985 50.2559 184.59 46.6295Z" stroke="${COLORS.brandInk}" stroke-width="8" stroke-miterlimit="16"/></svg>`,
).toString("base64")}`;

/**
 * Prix d'appel de la carte.
 *
 * Il vient de la grille publique, comme partout ailleurs. Les espaces fines
 * insécables que produit `Intl` en français sont ramenées à l'espace
 * insécable ordinaire : le sous-ensemble latin de Figtree ne couvre pas
 * U+202F, qui se rendrait en carré vide.
 */
const PRICE = `À partir de ${formatHourlyRate(LOWEST_HOURLY_RATE_CENTS).replace(
  /[\u202f\u2009]/g,
  "\u00a0",
)}`;

export interface OgCardContent {
  /** Surtitre en capitales, à la manière de la classe `.overline`. */
  overline: string;
  /** Titre de la carte. Trois à sept mots, comme les titres du système. */
  title: string;
  /** Une phrase, celle qui distingue cette page des autres. */
  subtitle: string;
}

/**
 * Première phrase d'un texte éditorial, pour servir de sous-titre.
 *
 * La carte ne réécrit rien : elle emprunte au contenu de la page, ce qui
 * garantit qu'elle en dit quelque chose de vrai et de propre à cette
 * commune-là. Au-delà de la longueur tenue par la composition, la coupe se
 * fait sur un mot entier plutôt qu'au milieu.
 */
export function ogLead(text: string, maxLength = 130): string {
  const sentence = /^[^.!?]+[.!?]/.exec(text)?.[0]?.trim() ?? text.trim();
  if (sentence.length <= maxLength) return sentence;
  const cut = sentence.slice(0, maxLength);
  const words = cut.slice(0, cut.lastIndexOf(" "));
  // Une virgule ou un tiret suivi de points de suspension se lit comme une
  // coquille : la coupe emporte la ponctuation qu'elle laisse en suspens.
  return `${words.replace(/[\s,;:—–-]+$/, "")}…`;
}

/**
 * Rend la carte de partage.
 *
 * La composition suit le système : surtitre en capitales espacées, titre en
 * graisse 900, une phrase de soutien, et l'action en pilule menthe portant du
 * texte encre — la menthe pleine ne porte jamais de blanc.
 */
export function ogCard({
  overline,
  title,
  subtitle,
}: OgCardContent): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        // Le titre peut tenir sur une ou trois lignes : l'écart minimal
        // empêche le surtitre de venir se coller au logotype quand il en
        // prend trois.
        gap: 40,
        backgroundColor: COLORS.background,
        padding: "72px 80px",
        fontFamily: "Figtree",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SYMBOL} width={72} height={72} alt="" />
        <div
          style={{
            fontSize: 40,
            fontWeight: 900,
            color: COLORS.text,
            letterSpacing: "-0.02em",
          }}
        >
          {SITE.name}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: COLORS.brandInk,
          }}
        >
          {overline}
        </div>
        <div
          style={{
            fontSize: 82,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: COLORS.text,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 34,
            lineHeight: 1.35,
            color: COLORS.textSecondary,
          }}
        >
          {subtitle}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${COLORS.border}`,
          paddingTop: 36,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 32,
            fontWeight: 900,
            color: COLORS.text,
            backgroundColor: COLORS.brand,
            borderRadius: 999,
            padding: "16px 34px",
          }}
        >
          {PRICE}
        </div>
        <div style={{ fontSize: 30, color: COLORS.textTertiary }}>
          {new URL(SITE.url).host}
        </div>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        {
          name: "Figtree",
          data: figtreeRegular,
          style: "normal",
          weight: 400,
        },
        { name: "Figtree", data: figtreeBlack, style: "normal", weight: 900 },
      ],
    },
  );
}
