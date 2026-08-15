import "server-only";

import type { KnownAddress, KnownClient } from "@/lib/booking/backend";
import type { TenantClient } from "@/lib/db";
import { isCoveredInsee } from "@/lib/territory";

/**
 * Ce que la plateforme sait déjà d'un client qui revient.
 *
 * Le tunnel était entièrement anonyme : un client venu trois fois retapait son
 * adresse, son prénom, son nom, son email et son téléphone à chaque
 * réservation. Ce module lit ces informations une fois, côté serveur, pour
 * qu'il n'ait plus qu'à confirmer.
 *
 * **Pourquoi pas `requireOrganization`.** Un client de la marketplace n'a pas
 * de `Membership` : la réservation crée un `User` et un `ClientProfile`, pas
 * une appartenance. Exiger une appartenance ici ne protégerait donc rien — elle
 * ne rendrait la lecture impossible pour tout le monde. Ce qui tient lieu
 * d'autorisation est plus simple et plus étroit : on ne lit que les lignes
 * rattachées au `ClientProfile` de la session, sur un client Prisma déjà
 * cloisonné à la marketplace. Personne ne peut désigner le profil qu'il lit.
 *
 * Ce module ne connaît ni Auth.js ni la résolution d'organisation : il reçoit
 * un client cloisonné et une identité. C'est ce qui le rend testable contre
 * une vraie base sans monter une session — la même séparation que celle de
 * `action-result.ts` vis-à-vis de `actions.ts`. Le liant vit dans
 * `known-client-session.ts`.
 */

/** Adresses proposées en un geste. Au-delà, la liste cesse d'aider. */
const MAX_ADDRESSES = 3;

/**
 * Sépare « Camille Durand » en prénom et nom.
 *
 * La base ne stocke qu'un `name`, composé à la réservation. La séparation est
 * approximative pour les noms composés, et c'est acceptable : ces valeurs
 * remplissent deux champs modifiables, elles ne font pas autorité.
 */
function splitName(name: string | null): {
  firstName: string;
  lastName: string;
} {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(" "),
  };
}

/**
 * Lecture du profil, sur un client déjà cloisonné.
 *
 * Séparée de la résolution de session pour rester testable sans Auth.js, comme
 * `action-result.ts` l'est du reste des server actions.
 */
export async function readKnownClient(
  db: TenantClient,
  user: { id: string; email: string; name: string | null },
): Promise<KnownClient | null> {
  const profile = await db.clientProfile.findFirst({
    where: { userId: user.id },
    select: { id: true, phone: true },
  });

  if (!profile) {
    return null;
  }

  /*
   * Chaque réservation crée sa propre ligne d'adresse — c'est ce qui permet à
   * une réservation passée de garder l'adresse telle qu'elle était. Le carnet
   * affiché, lui, doit être dédoublonné, sans quoi un client fidèle se verrait
   * proposer trois fois la même rue.
   */
  const rows = await db.address.findMany({
    where: { clientProfileId: profile.id },
    // `id` départage les créations tombées sur la même milliseconde, sans quoi
    // l'ordre de la liste dépendrait du plan d'exécution.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      banId: true,
      street: true,
      postalCode: true,
      cityName: true,
      inseeCode: true,
      lat: true,
      lng: true,
      accessNotes: true,
    },
    take: 30,
  });

  const seen = new Set<string>();
  const addresses: KnownAddress[] = [];
  for (const row of rows) {
    // Une commune peut sortir du territoire desservi ; proposer une adresse
    // qu'on refusera trois écrans plus loin serait pire que de l'omettre.
    if (!isCoveredInsee(row.inseeCode)) continue;

    const key = `${row.street.trim().toLowerCase()}|${row.inseeCode}`;
    if (seen.has(key)) continue;
    seen.add(key);

    addresses.push({
      banId: row.banId ?? "",
      label: `${row.street}, ${row.postalCode} ${row.cityName}`,
      street: row.street,
      postalCode: row.postalCode,
      cityName: row.cityName,
      inseeCode: row.inseeCode,
      lat: row.lat,
      lng: row.lng,
      accessNotes: row.accessNotes,
    });

    if (addresses.length >= MAX_ADDRESSES) break;
  }

  const lastBooking = await db.booking.findFirst({
    where: { clientProfileId: profile.id, surfaceSqm: { not: null } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { surfaceSqm: true, frequency: true },
  });

  return {
    ...splitName(user.name),
    email: user.email,
    phone: profile.phone ?? "",
    addresses,
    lastChoice:
      lastBooking?.surfaceSqm != null
        ? {
            surfaceSqm: lastBooking.surfaceSqm,
            frequency: lastBooking.frequency,
          }
        : null,
  };
}
