import Link from "next/link";

import { SITE } from "@/lib/site";

/**
 * Logotype.
 *
 * Le symbole est l'étoile à quatre branches fournie par le client, conservée
 * telle quelle. Il est incrusté plutôt que chargé comme image : son tracé suit
 * `currentColor`, ce qui lui fait prendre l'encre sur fond clair et la sarcelle
 * sur fond sombre — le système interdit le monochrome sarcelle sur blanc, où le
 * contraste ne tient pas.
 *
 * Le nom, lui, est composé plutôt que vectorisé : il reste ainsi sélectionnable,
 * annoncé par un lecteur d'écran, et net à toutes les tailles.
 */
export function Logo({
  href = "/",
  className,
  inverse = false,
}: {
  /** `null` pour un logotype non cliquable, dans le pied de page par exemple. */
  href?: string | null;
  className?: string;
  /** Sur une surface sombre — le pied de page sarcelle — tout passe en blanc. */
  inverse?: boolean;
}) {
  const content = (
    <span
      className={`inline-flex items-center gap-2.5 ${inverse ? "text-white" : ""} ${className ?? ""}`}
    >
      <svg
        viewBox="165 27 57 57"
        className={`size-7 shrink-0 ${inverse ? "text-white" : "text-ink-900 dark:text-teal-300"}`}
        aria-hidden
      >
        <path
          d="M184.59 46.6295C188.186 43.0118 191.333 38.8101 193.667 34.323C195.98 38.8375 199.157 43.0525 202.786 46.6663C206.429 50.295 210.681 53.4715 215.225 55.8017C210.686 58.1462 206.443 61.3392 202.809 64.9748C199.19 68.595 196.019 72.8098 193.704 77.3101C191.373 72.8182 188.223 68.5988 184.625 64.9653C181.015 61.3212 176.807 58.1176 172.288 55.7713C176.789 53.4344 180.985 50.2559 184.59 46.6295Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeMiterlimit="16"
        />
      </svg>
      {/* Le nom s'écrit en deux mots : `whitespace-nowrap` empêche la marque
          de se couper en deux lignes dans un en-tête étroit. */}
      <span className="text-xl font-black tracking-[-0.04em] whitespace-nowrap">
        {SITE.name}
      </span>
    </span>
  );

  if (href === null) {
    return content;
  }

  return (
    <Link href={href} aria-label={`${SITE.name}, retour à l'accueil`}>
      {content}
    </Link>
  );
}
