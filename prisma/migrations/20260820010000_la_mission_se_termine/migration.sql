-- La vie d'une réservation s'arrêtait à `CONFIRMED`.
--
-- `IN_PROGRESS`, `COMPLETED` et `NO_SHOW` étaient modélisés depuis la phase 1 et
-- n'ont jamais été écrits. Sans clôture de mission : pas de facture émise, pas
-- d'avis à demander, pas de reversement à déclencher, pas de passage suivant à
-- caler. C'est le maillon qui manquait pour que le service tourne au quotidien,
-- et il ne dépendait d'aucun tiers.
ALTER TABLE "Booking"
  -- Durée réellement passée. Elle ne refacture rien : le montant reste celui
  -- qui a été annoncé, et un ajustement passe par une anomalie validée.
  ADD COLUMN "actualMinutes"  INTEGER,
  -- Deux photos avant, deux après. Faux ne bloque ni le check-out ni le
  -- paiement : un intervenant qui ne peut pas finir sa journée à cause d'une
  -- photo manquante finit par photographier n'importe quoi.
  ADD COLUMN "reportComplete" BOOLEAN NOT NULL DEFAULT false;

-- Pointage d'arrivée ou de départ. La position est capturée au tap seulement,
-- jamais en continu : c'est une preuve de réalisation, pas une surveillance.
CREATE TABLE "MissionCheck" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "cleanerProfileId" TEXT NOT NULL,
    -- ARRIVEE | DEPART
    "kind" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    -- Conservé même hors tolérance : c'est ce qui permet de relire une
    -- contestation.
    "distanceMeters" INTEGER,
    -- POSITION | MANUEL | CODE_CLIENT | HORS_LIGNE
    "method" TEXT NOT NULL,
    -- Instant relevé par l'appareil quand le pointage a été fait hors ligne.
    "deviceAt" TIMESTAMP(3),

    CONSTRAINT "MissionCheck_pkey" PRIMARY KEY ("id")
);

-- Un seul pointage de chaque sens par mission : la contrainte est en base parce
-- qu'un double tap sur un réseau lent produit deux requêtes.
CREATE UNIQUE INDEX "MissionCheck_bookingId_kind_key" ON "MissionCheck"("bookingId", "kind");
CREATE INDEX "MissionCheck_organizationId_at_idx" ON "MissionCheck"("organizationId", "at");

CREATE TABLE "MissionPhoto" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    -- AVANT | APRES
    "phase" TEXT NOT NULL,
    "room" TEXT,
    -- Chemin dans le coffre, jamais une URL : elles se périment en soixante
    -- secondes et se demandent au moment de l'affichage.
    "storagePath" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionPhoto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MissionPhoto_bookingId_phase_idx" ON "MissionPhoto"("bookingId", "phase");

CREATE TABLE "MissionAnomaly" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "storagePath" TEXT,
    -- Une seule catégorie peut en proposer, et la proposition ne facture rien :
    -- elle attend une validation.
    "proposedExtraMinutes" INTEGER,
    -- PENDING | ACCEPTED | REFUSED
    "adjustmentStatus" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionAnomaly_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MissionAnomaly_organizationId_adjustmentStatus_idx"
    ON "MissionAnomaly"("organizationId", "adjustmentStatus");
CREATE INDEX "MissionAnomaly_bookingId_idx" ON "MissionAnomaly"("bookingId");

-- La checklist n'est pas un instrument de contrôle : c'est un mémo et une
-- preuve. Rien ne bloque au check-out.
CREATE TABLE "MissionChecklistItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "room" TEXT,
    "label" TEXT NOT NULL,
    "addedByClient" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MissionChecklistItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MissionChecklistItem_bookingId_position_idx"
    ON "MissionChecklistItem"("bookingId", "position");

ALTER TABLE "MissionCheck"
    ADD CONSTRAINT "MissionCheck_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "MissionCheck_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "MissionCheck_cleanerProfileId_fkey" FOREIGN KEY ("cleanerProfileId") REFERENCES "CleanerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MissionPhoto"
    ADD CONSTRAINT "MissionPhoto_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "MissionPhoto_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MissionAnomaly"
    ADD CONSTRAINT "MissionAnomaly_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "MissionAnomaly_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MissionChecklistItem"
    ADD CONSTRAINT "MissionChecklistItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "MissionChecklistItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
