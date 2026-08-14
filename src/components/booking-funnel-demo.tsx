"use client";

import { BookingFunnel, type CommuneOption } from "@/components/booking-funnel";
import { demoBookingBackend } from "@/lib/demo/backend";

/**
 * Tunnel de réservation de la vitrine statique.
 *
 * Ce composant n'existe que pour une raison technique, mais elle est
 * instructive : une fonction ordinaire ne traverse pas la frontière
 * serveur/client. Les server actions le peuvent — ce sont des références que
 * React sait sérialiser — mais un objet de fonctions locales, non. Le backend
 * de démonstration doit donc être assemblé du côté client, et c'est ici que
 * cela se fait.
 */
export function BookingFunnelDemo({
  communes,
}: {
  communes: readonly CommuneOption[];
}) {
  return <BookingFunnel backend={demoBookingBackend} communes={communes} />;
}
