import type { ReactNode } from "react";

/**
 * Gabarit de la console d'exploitation.
 *
 * Sa seule fonction est de poser la densité. Le corpus de spécifications
 * proposait un second thème pour l'administration — rayon 0, monospace partout,
 * palette distincte — et l'arbitrage du 19 août 2026 l'a écarté : une console
 * qui ne ressemble pas à la marque est une console qu'on oublie de tenir à
 * jour, et deux systèmes de design finissent toujours par diverger.
 *
 * Ce qui reste du besoin est réel : une liste de quarante lignes ne se lit pas
 * avec les espacements d'une page de vente. `data-density="compact"` resserre
 * donc les seuls tokens d'espacement, de rayon et d'ombre — les couleurs, elles,
 * ne bougent pas d'un point.
 */
export default function AdministrationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div data-density="compact">{children}</div>;
}
