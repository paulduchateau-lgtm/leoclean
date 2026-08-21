import { SITE } from "@/lib/site";

/**
 * Fichier iCalendar d'une intervention.
 *
 * Un rendez-vous qui n'entre pas dans l'agenda du client est un rendez-vous
 * qu'il oubliera — et une absence coûte 100 % du prix au titre du barème des
 * CGU. Le bouton d'ajout au calendrier est donc de la prévention d'annulation
 * autant qu'un confort.
 *
 * Le module est **pur** : pas de base, pas d'horloge, pas de session. Il est
 * donc testable au caractère près, et la vitrine statique produit exactement le
 * même fichier que la production — c'est la même règle que pour la
 * tarification et la disponibilité.
 */

export interface CalendarEvent {
  /** Identifiant de la réservation, qui devient l'UID de l'événement. */
  bookingId: string;
  start: Date;
  end: Date;
  /** Adresse complète, telle qu'elle est lue par un humain. */
  location: string;
  /** Prénom de l'intervenant, s'il est déjà désigné. */
  cleanerFirstName?: string | null;
  /**
   * Un intervenant a accepté la mission.
   *
   * Faux à la sortie du tunnel : la demande vient d'être proposée à cinq
   * personnes et aucune n'a répondu. L'agenda doit le dire — `TENTATIVE` est
   * exactement ce que la RFC 5545 prévoit pour un rendez-vous non confirmé, et
   * la plupart des agendas le rendent visiblement. Écrire `CONFIRMED` sur une
   * recherche en cours mettrait dans l'agenda du client une certitude que le
   * produit n'a pas.
   */
  confirmed: boolean;
  /** Instant d'émission. Passé explicitement : le module n'a pas d'horloge. */
  stampedAt: Date;
}

/**
 * Horodatage iCalendar : UTC, sans séparateur, suffixé `Z`.
 *
 * La base ne stocke que de l'UTC et c'est ce qui part dans le fichier : un
 * agenda qui reçoit un instant absolu l'affiche dans le fuseau de son
 * propriétaire, ce qui est le comportement voulu pour quelqu'un qui réserve
 * depuis l'étranger.
 */
function icsInstant(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/**
 * Échappement du texte iCalendar (RFC 5545, §3.3.11).
 *
 * Une virgule non échappée dans une adresse coupe la valeur en deux et fait
 * rejeter l'événement par certains agendas. C'est le même réflexe que pour le
 * JSON-LD : ce qui vient du contenu est échappé à la sérialisation.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Repli des lignes à 75 octets (RFC 5545, §3.1).
 *
 * Les caractères accentués comptent double en UTF-8 : une ligne pliée sur le
 * nombre de caractères déborde dès qu'une adresse porte un « é ». Le repli se
 * fait donc à l'octet, et jamais au milieu d'un caractère.
 */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const parts: string[] = [];
  let current = "";
  let bytes = 0;

  for (const character of line) {
    const size = encoder.encode(character).length;
    // 74 sur les lignes suivantes : l'espace de continuation en occupe un.
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += character;
    bytes += size;
  }
  parts.push(current);

  return parts.join("\r\n ");
}

/** Fichier iCalendar complet, prêt à être téléchargé. */
export function bookingCalendar(event: CalendarEvent): string {
  const summary = event.cleanerFirstName
    ? `Ménage ${SITE.name} — ${event.cleanerFirstName}`
    : `Ménage ${SITE.name}`;

  const description = event.cleanerFirstName
    ? `${event.cleanerFirstName} vient faire le ménage. Une question : ${SITE.phone}.`
    : `Nous cherchons votre intervenant et vous donnons son prénom sous 24 heures. Une question : ${SITE.phone}.`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${SITE.name}//Reservation//FR`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    // L'UID est celui de la réservation : réémettre le fichier après une
    // modification met l'événement à jour au lieu d'en créer un second.
    `UID:${event.bookingId}@${new URL(SITE.url).host}`,
    `DTSTAMP:${icsInstant(event.stampedAt)}`,
    `DTSTART:${icsInstant(event.start)}`,
    `DTEND:${icsInstant(event.end)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `LOCATION:${escapeText(event.location)}`,
    `URL:${SITE.url}`,
    event.confirmed ? "STATUS:CONFIRMED" : "STATUS:TENTATIVE",
    // Un rappel la veille : c'est la fenêtre où l'annulation est encore
    // gratuite selon le barème des CGU.
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(`Ménage ${SITE.name} demain`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // Les fins de ligne sont des CRLF : la RFC les impose, et les agendas de
  // bureau les plus répandus refusent le fichier sans elles.
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** Nom de fichier proposé au téléchargement. */
export function bookingCalendarFilename(start: Date): string {
  const day = start.toISOString().slice(0, 10);
  return `menage-leoclean-${day}.ics`;
}
