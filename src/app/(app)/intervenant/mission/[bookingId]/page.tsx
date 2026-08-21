import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { EcranDeTravail } from "@/app/(app)/intervenant/mission/[bookingId]/ecran-de-travail";
import { PhotosDeMission } from "@/app/(app)/intervenant/mission/[bookingId]/photos";
import { consignesLisibles } from "@/lib/logement/consignes";
import { consignesDeLAdresse } from "@/lib/logement/instructions";
import { lireLesPhotos } from "@/lib/mission/photos";
import { SITE } from "@/lib/site";
import { stockageConfigure } from "@/lib/stockage/resolution";
import { getCurrentUser, requireOrganization } from "@/lib/auth/session";
import { marketplaceOrganizationId } from "@/lib/organizations";

/**
 * L'écran de travail d'une mission.
 *
 * C'est ici que la vie d'une réservation dépasse enfin `CONFIRMED`. Contrainte
 * de conception dominante, reprise du corpus : **utilisable debout, à une main,
 * avec des gants, dans un hall d'immeuble**. D'où un seul geste dominant par
 * état — arriver, puis terminer — et tout le reste en dessous.
 *
 * La consigne d'accès n'est **jamais rendue avec la page** : elle se demande au
 * moment où l'on est devant la porte. Une consigne posée dans le HTML vit dans
 * un cache, un historique et un rendu serveur ; demandée, elle est journalisée
 * et ne sort qu'à l'intérieur de sa fenêtre.
 */

export const metadata: Metadata = {
  title: "Ma mission",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MissionPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/connexion?callbackUrl=/intervenant/mission/${bookingId}`);
  }

  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(
    organizationId,
    "assignment:read:own",
  );

  const profil = await db.cleanerProfile.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!profil) notFound();

  const affectation = await db.assignment.findFirst({
    where: {
      bookingId,
      cleanerProfileId: profil.id,
      status: { in: ["ACCEPTED", "COMPLETED"] },
    },
    select: { status: true },
  });
  if (!affectation) notFound();

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      scheduledStart: true,
      durationMinutes: true,
      actualMinutes: true,
      reportComplete: true,
      clientNotes: true,
      professionalAmountCents: true,
      address: {
        select: {
          street: true,
          complement: true,
          postalCode: true,
          cityName: true,
          floor: true,
          hasElevator: true,
          parkingNotes: true,
          accessNotes: true,
          forbiddenZones: true,
          allergies: true,
          consignes: true,
          accessSecretSetAt: true,
        },
      },
      clientProfile: { select: { user: { select: { name: true } } } },
    },
  });
  if (!booking) notFound();

  const pointages = await db.missionCheck.findMany({
    where: { bookingId },
    select: { kind: true, at: true, deviceAt: true, method: true },
  });

  const taches = await db.missionChecklistItem.findMany({
    where: { bookingId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      room: true,
      label: true,
      addedByClient: true,
      doneAt: true,
    },
  });

  const anomalies = await db.missionAnomaly.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, description: true, adjustmentStatus: true },
  });

  const photos = await lireLesPhotos(db, booking.id);

  const arrivee = pointages.find((p) => p.kind === "ARRIVEE");
  const depart = pointages.find((p) => p.kind === "DEPART");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 pt-6 pb-28">
      <p className="text-sm">
        <Link href="/intervenant" className="text-brand hover:underline">
          ← Mes missions
        </Link>
      </p>

      <EcranDeTravail
        mission={{
          bookingId: booking.id,
          statut: booking.status,
          debut: booking.scheduledStart.toISOString(),
          dureePrevueMinutes: booking.durationMinutes,
          dureeReelleMinutes: booking.actualMinutes,
          rapportComplet: booking.reportComplete,
          remunerationCents: booking.professionalAmountCents,
          clientPrenom: booking.clientProfile.user.name?.split(" ")[0] ?? null,
          adresse: [
            booking.address.street,
            booking.address.complement,
            `${booking.address.postalCode} ${booking.address.cityName}`,
          ]
            .filter(Boolean)
            .join(", "),
          etage: booking.address.floor,
          ascenseur: booking.address.hasElevator,
          stationnement: booking.address.parkingNotes,
          accesNotes: booking.address.accessNotes,
          zonesInterdites: booking.address.forbiddenZones,
          allergies: booking.address.allergies,
          consignesClient: booking.clientNotes,
          /*
           * Les consignes guidées, relues par le module pur : celui qui les a
           * écrites et celui qui les lit voient les mêmes libellés, ce qui est
           * toute la valeur de la fonctionnalité. Une liste vide quand le
           * client a mis l'aide en pause.
           */
          consignesGuidees: consignesLisibles(
            consignesDeLAdresse(booking.address.consignes),
          ),
          consignesMajAt: consignesDeLAdresse(booking.address.consignes).majAt,
          consigneSecreteExiste: Boolean(booking.address.accessSecretSetAt),
          arriveeA: arrivee
            ? (arrivee.deviceAt ?? arrivee.at).toISOString()
            : null,
          departA: depart ? (depart.deviceAt ?? depart.at).toISOString() : null,
        }}
        taches={taches.map((tache) => ({
          id: tache.id,
          piece: tache.room,
          libelle: tache.label,
          ajouteeParLeClient: tache.addedByClient,
          faite: tache.doneAt !== null,
        }))}
        anomalies={anomalies.map((anomalie) => ({
          id: anomalie.id,
          type: anomalie.type,
          description: anomalie.description,
          ajustement: anomalie.adjustmentStatus,
        }))}
      />

      {/*
       * Le rapport photo, débloqué par le coffre. Il ne retient ni la fin de
       * mission ni le paiement : un produit qui empêche de travailler pour
       * protéger une mesure obtient des mesures fausses.
       */}
      <PhotosDeMission
        bookingId={booking.id}
        photos={photos}
        depotOuvert={stockageConfigure()}
        telephone={SITE.phone}
      />
    </main>
  );
}
