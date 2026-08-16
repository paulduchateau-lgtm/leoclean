import "server-only";

import type { TenantClient } from "@/lib/db";

/**
 * Droit d'accès : ce que la plateforme sait d'une personne.
 *
 * L'article 15 du RGPD ouvre un droit d'accès aux données, pas un droit à un
 * résumé : on rend ce qui est stocké, sous une forme lisible, sans trier ce
 * qui arrangerait.
 *
 * Deux limites assumées, et dites plutôt que masquées :
 *
 * - **Les données d'autrui n'y figurent pas.** Le nom de l'intervenant qui est
 *   venu est une donnée le concernant lui ; on rend son prénom, celui que le
 *   client a de toute façon vu, pas son identité complète.
 * - **Les montants restent.** Ils relèvent de la comptabilité, pas du
 *   consentement.
 */

export interface DonneesPersonnelles {
  exporteLe: string;
  compte: {
    email: string;
    nom: string | null;
    creeLe: string;
  };
  profil: {
    telephone: string | null;
    consignesAcces: string | null;
  } | null;
  adresses: {
    rue: string;
    codePostal: string;
    commune: string;
    consignesAcces: string | null;
    creeLe: string;
  }[];
  reservations: {
    debut: string;
    duree: number;
    commune: string;
    statut: string;
    montantTotalCents: number;
    vosNotes: string | null;
    intervenant: string | null;
  }[];
  avisDeposes: {
    note: number;
    commentaire: string | null;
    deposeLe: string;
  }[];
  demandesDeRappel: {
    nom: string;
    telephone: string;
    email: string | null;
    message: string | null;
    recueLe: string;
  }[];
}

/**
 * Rassemble tout ce qui concerne une personne dans cette organisation.
 *
 * Les demandes de rappel sont rattachées par email et par téléphone : elles
 * précèdent la création du compte et n'ont donc pas d'identifiant d'utilisateur.
 * Les omettre reviendrait à cacher les données les plus anciennes, souvent les
 * seules dont la personne a oublié l'existence.
 */
export async function rassemblerDonnees(
  db: TenantClient,
  user: { id: string; email: string },
  maintenant: Date = new Date(),
): Promise<DonneesPersonnelles> {
  const compte = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { email: true, name: true, createdAt: true },
  });

  const profil = await db.clientProfile.findFirst({
    where: { userId: user.id },
    select: { id: true, phone: true, accessNotes: true },
  });

  const adresses = profil
    ? await db.address.findMany({
        where: { clientProfileId: profil.id },
        orderBy: { createdAt: "desc" },
        select: {
          street: true,
          postalCode: true,
          cityName: true,
          accessNotes: true,
          createdAt: true,
        },
      })
    : [];

  const reservations = profil
    ? await db.booking.findMany({
        where: { clientProfileId: profil.id },
        orderBy: { scheduledStart: "desc" },
        select: {
          scheduledStart: true,
          durationMinutes: true,
          status: true,
          grossAmountCents: true,
          clientNotes: true,
          address: { select: { cityName: true } },
          assignments: {
            where: { status: { in: ["ACCEPTED", "COMPLETED"] } },
            select: { cleaner: { select: { displayName: true } } },
            take: 1,
          },
        },
      })
    : [];

  const avis = profil
    ? await db.review.findMany({
        where: { clientProfileId: profil.id },
        orderBy: { createdAt: "desc" },
        select: { rating: true, comment: true, createdAt: true },
      })
    : [];

  const demandes = await db.lead.findMany({
    where: { email: user.email.toLowerCase() },
    orderBy: { createdAt: "desc" },
    select: {
      name: true,
      phone: true,
      email: true,
      message: true,
      createdAt: true,
    },
  });

  return {
    exporteLe: maintenant.toISOString(),
    compte: {
      email: compte.email,
      nom: compte.name,
      creeLe: compte.createdAt.toISOString(),
    },
    profil: profil
      ? { telephone: profil.phone, consignesAcces: profil.accessNotes }
      : null,
    adresses: adresses.map((adresse) => ({
      rue: adresse.street,
      codePostal: adresse.postalCode,
      commune: adresse.cityName,
      consignesAcces: adresse.accessNotes,
      creeLe: adresse.createdAt.toISOString(),
    })),
    reservations: reservations.map((reservation) => ({
      debut: reservation.scheduledStart.toISOString(),
      duree: reservation.durationMinutes,
      commune: reservation.address.cityName,
      statut: reservation.status,
      montantTotalCents: reservation.grossAmountCents,
      vosNotes: reservation.clientNotes,
      // Le prénom seul : l'identité complète de l'intervenant est une donnée
      // le concernant, pas une donnée du client.
      intervenant: reservation.assignments[0]?.cleaner.displayName ?? null,
    })),
    avisDeposes: avis.map((avisDepose) => ({
      note: avisDepose.rating,
      commentaire: avisDepose.comment,
      deposeLe: avisDepose.createdAt.toISOString(),
    })),
    demandesDeRappel: demandes.map((demande) => ({
      nom: demande.name,
      telephone: demande.phone,
      email: demande.email,
      message: demande.message,
      recueLe: demande.createdAt.toISOString(),
    })),
  };
}
