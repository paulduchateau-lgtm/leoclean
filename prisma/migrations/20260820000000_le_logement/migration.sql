-- `Address` était un point postal ; la mission a besoin d'un logement.
--
-- Le nom de la table ne change pas, et c'est délibéré : le renommer en
-- `Property` toucherait une cinquantaine de fichiers pour aucun gain visible.
-- Ce qui change est la substance — un logement a des pièces, des consignes, des
-- animaux, un matériel, et un secret qu'il ne faut pas laisser traîner.
ALTER TABLE "Address"
  ADD COLUMN "propertyType"     TEXT,
  ADD COLUMN "rooms"            INTEGER,
  ADD COLUMN "bathrooms"        INTEGER,
  ADD COLUMN "wc"               INTEGER,
  ADD COLUMN "parkingNotes"     TEXT,
  ADD COLUMN "forbiddenZones"   TEXT,
  ADD COLUMN "pets"             JSONB,
  ADD COLUMN "allergies"        TEXT,
  ADD COLUMN "supplies"         JSONB,
  ADD COLUMN "ownProducts"      BOOLEAN,
  ADD COLUMN "defaultChecklist" JSONB,
  -- Consigne sensible : digicode, emplacement d'une clé. Chiffrée en
  -- AES-256-GCM, jamais lisible par une requête ordinaire, jamais écrite dans
  -- un journal. Elle ne se déchiffre que pour un intervenant affecté, dans la
  -- fenêtre J-24 h → J+2 h. Hors de cette fenêtre, un compte compromis ne donne
  -- accès à aucun domicile.
  ADD COLUMN "accessSecretEnc"   BYTEA,
  ADD COLUMN "accessSecretSetAt" TIMESTAMP(3);

-- Journal de remise de clés. Sans lui, une clé perdue est une discussion sans
-- pièce.
CREATE TABLE "PropertyKeyLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "cleanerProfileId" TEXT,
    -- HANDED_OVER | RETURNED | LOST
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "confirmedByClientAt" TIMESTAMP(3),
    "confirmedByCleanerAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyKeyLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PropertyKeyLog_organizationId_addressId_createdAt_idx"
    ON "PropertyKeyLog"("organizationId", "addressId", "createdAt");

-- Journal des lectures de consigne. Obligation RGPD, et protection en cas de
-- litige : le jour où un client signale une entrée qu'il n'attendait pas, « qui
-- a lu le code, et quand » doit avoir une réponse. Les refus y figurent aussi,
-- et ce sont les plus intéressants à relire.
CREATE TABLE "AccessSecretRead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "cleanerProfileId" TEXT,
    "bookingId" TEXT,
    "granted" BOOLEAN NOT NULL,
    "reason" TEXT,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessSecretRead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccessSecretRead_organizationId_addressId_readAt_idx"
    ON "AccessSecretRead"("organizationId", "addressId", "readAt");
CREATE INDEX "AccessSecretRead_cleanerProfileId_readAt_idx"
    ON "AccessSecretRead"("cleanerProfileId", "readAt");

ALTER TABLE "PropertyKeyLog"
    ADD CONSTRAINT "PropertyKeyLog_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "PropertyKeyLog_addressId_fkey" FOREIGN KEY ("addressId")
    REFERENCES "Address"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "PropertyKeyLog_cleanerProfileId_fkey" FOREIGN KEY ("cleanerProfileId")
    REFERENCES "CleanerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccessSecretRead"
    ADD CONSTRAINT "AccessSecretRead_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "AccessSecretRead_addressId_fkey" FOREIGN KEY ("addressId")
    REFERENCES "Address"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "AccessSecretRead_cleanerProfileId_fkey" FOREIGN KEY ("cleanerProfileId")
    REFERENCES "CleanerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
