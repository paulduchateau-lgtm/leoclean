import Image from "next/image";
import Link from "next/link";

import { SITE } from "@/lib/site";

/**
 * Logotype.
 *
 * Le symbole est l'étoile à quatre branches fournie par le client, conservée
 * telle quelle. Le nom, lui, est composé dans la police d'affichage plutôt que
 * vectorisé : il reste ainsi sélectionnable, annoncé par un lecteur d'écran, et
 * net à toutes les tailles.
 */
export function Logo({
  href = "/",
  className,
}: {
  /** `null` pour un logotype non cliquable, dans le pied de page par exemple. */
  href?: string | null;
  className?: string;
}) {
  const content = (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <Image
        src="/brand/symbol-vert.svg"
        alt=""
        width={28}
        height={28}
        priority
        aria-hidden
      />
      {/* Le nom s'écrit en deux mots : `whitespace-nowrap` empêche la marque
          de se couper en deux lignes dans un en-tête étroit. */}
      <span className="font-heading text-xl font-semibold tracking-[-0.016em] whitespace-nowrap">
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
