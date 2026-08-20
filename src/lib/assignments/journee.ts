import "server-only";

import type { TenantClient } from "@/lib/db";
import { parisDayKey } from "@/lib/time";

/**
 * La tournée du jour d'un intervenant.
 *
 * L'écran le plus employé du produit, et le seul qui répond à trois questions
 * d'un coup d'œil : *où je vais maintenant*, *combien je gagne aujourd'hui*,
 * *qu'est-ce qui a changé*.
 *
 * **Une tournée est une journée civile française**, et d'elle seule. C'est une
 * correction déjà apprise par le moteur de disponibilité : traiter comme
 * « étape suivante » une mission située trois jours plus tard fait calculer un
 * trajet entre deux adresses que personne n'enchaîne.
 */

export interface EtapeDuJour {
  bookingId: string;
  debut: string;
  fin: string;
  dureeMinutes: number;
  commune: string;
  adresse: string | null;
  clientPrenom: string | null;
  remunerationCents: number;
  trajetAvantMinutes: number;
  statut: string;
  arrivee: string | null;
  depart: string | null;
}

export interface Journee {
  etapes: EtapeDuJour[];
  totalMinutes: number;
  totalCents: number;
  /** Trous de plus de trois quarts d'heure entre deux étapes. */
  trous: { apres: string; avant: string; minutes: number }[];
  /** L'étape en cours, ou la prochaine. C'est elle que l'écran met en tête. */
  maintenant: EtapeDuJour | null;
}

/**
 * Trou à partir duquel on propose de remplir.
 *
 * Quarante-cinq minutes : en deçà, c'est une marge de route et de café ; au
 * -delà, c'est du temps payé nulle part, et c'est le premier poste de perte de
 * revenu d'un intervenant à domicile.
 */
export const TROU_MINUTES = 45;

export async function chargerLaJournee(
  db: TenantClient,
  cleanerProfileId: string,
  maintenant: Date = new Date(),
): Promise<Journee> {
  const jour = parisDayKey(maintenant);

  /*
   * On charge large — de la veille au lendemain — puis on filtre sur la clé de
   * journée française. Comparer des instants à 24 heures d'écart ne suffit pas :
   * les deux nuits de changement d'heure en durent 23 et 25.
   */
  const affectations = await db.assignment.findMany({
    where: {
      cleanerProfileId,
      status: { in: ["ACCEPTED", "COMPLETED"] },
      startAt: {
        gte: new Date(maintenant.getTime() - 36 * 3_600_000),
        lte: new Date(maintenant.getTime() + 36 * 3_600_000),
      },
    },
    orderBy: { startAt: "asc" },
    select: {
      startAt: true,
      endAt: true,
      travelMinutesBefore: true,
      bookingId: true,
      booking: {
        select: {
          status: true,
          durationMinutes: true,
          professionalAmountCents: true,
          address: {
            select: { street: true, postalCode: true, cityName: true },
          },
          clientProfile: { select: { user: { select: { name: true } } } },
          checks: { select: { kind: true, at: true, deviceAt: true } },
        },
      },
    },
  });

  const duJour = affectations.filter(
    (affectation) => parisDayKey(affectation.startAt) === jour,
  );

  const etapes: EtapeDuJour[] = duJour.map((affectation) => {
    const arrivee = affectation.booking.checks.find((c) => c.kind === "ARRIVEE");
    const depart = affectation.booking.checks.find((c) => c.kind === "DEPART");

    return {
      bookingId: affectation.bookingId,
      debut: affectation.startAt.toISOString(),
      fin: affectation.endAt.toISOString(),
      dureeMinutes: affectation.booking.durationMinutes,
      commune: affectation.booking.address.cityName,
      adresse: `${affectation.booking.address.street}, ${affectation.booking.address.postalCode} ${affectation.booking.address.cityName}`,
      clientPrenom:
        affectation.booking.clientProfile.user.name?.split(" ")[0] ?? null,
      remunerationCents: affectation.booking.professionalAmountCents,
      trajetAvantMinutes: affectation.travelMinutesBefore,
      statut: affectation.booking.status,
      arrivee: arrivee ? (arrivee.deviceAt ?? arrivee.at).toISOString() : null,
      depart: depart ? (depart.deviceAt ?? depart.at).toISOString() : null,
    };
  });

  const trous: Journee["trous"] = [];
  for (let index = 1; index < etapes.length; index += 1) {
    const precedente = etapes[index - 1]!;
    const suivante = etapes[index]!;
    const battement =
      (new Date(suivante.debut).getTime() -
        new Date(precedente.fin).getTime()) /
        60_000 -
      suivante.trajetAvantMinutes;

    if (battement >= TROU_MINUTES) {
      trous.push({
        apres: precedente.fin,
        avant: suivante.debut,
        minutes: Math.round(battement),
      });
    }
  }

  /*
   * L'étape « maintenant » est celle qui est commencée et non terminée, ou à
   * défaut la première qui n'est pas finie. Une journée sans rien devant rend
   * `null`, et l'écran dit alors ce qu'il reste à faire plutôt que d'afficher
   * un vide.
   */
  const enCours = etapes.find((etape) => etape.arrivee && !etape.depart);
  const prochaine = etapes.find((etape) => !etape.depart);

  return {
    etapes,
    totalMinutes: etapes.reduce((somme, etape) => somme + etape.dureeMinutes, 0),
    totalCents: etapes.reduce(
      (somme, etape) => somme + etape.remunerationCents,
      0,
    ),
    trous,
    maintenant: enCours ?? prochaine ?? null,
  };
}
