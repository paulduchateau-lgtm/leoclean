-- ---------------------------------------------------------------------------
-- Contre-proposition de créneau.
--
-- Elle n'existe que dans un cas : personne n'a accepté la mission à l'heure
-- demandée, et la réservation est retombée en `PENDING_ASSIGNMENT`. Plutôt que
-- de laisser le client attendre un appel, un intervenant qui voudrait la
-- prendre à une autre heure le propose, et le client tranche.
--
-- C'est une proposition, pas une modification : rien ne bouge tant que le
-- client n'a pas validé. Déplacer unilatéralement le rendez-vous de quelqu'un
-- romprait la promesse vendue par le tunnel, qui est un créneau ferme.
--
-- La table ne porte pas de contrainte d'exclusion : une proposition n'occupe
-- personne. C'est l'écriture de l'`Assignment`, à la validation du client, qui
-- rencontre `Assignment_no_overlap` — et c'est bien là qu'on veut que le
-- conflit se décide, sur la seule écriture qui engage un intervenant.
-- ---------------------------------------------------------------------------
CREATE TYPE "SlotProposalStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'WITHDRAWN',
    'EXPIRED'
);

CREATE TABLE "SlotProposal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "cleanerProfileId" TEXT NOT NULL,
    "status" "SlotProposalStatus" NOT NULL DEFAULT 'PENDING',
    "proposedStart" TIMESTAMP(3) NOT NULL,
    "proposedEnd" TIMESTAMP(3) NOT NULL,
    "message" TEXT,
    "respondBy" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlotProposal_pkey" PRIMARY KEY ("id")
);

-- Un intervenant ne propose pas deux fois la même heure sur la même
-- réservation : sans cela, un double envoi produirait deux cartes identiques à
-- valider, et valider la seconde après la première déplacerait un rendez-vous
-- déjà déplacé.
CREATE UNIQUE INDEX "SlotProposal_bookingId_cleanerProfileId_proposedStart_key"
    ON "SlotProposal"("bookingId", "cleanerProfileId", "proposedStart");

CREATE INDEX "SlotProposal_organizationId_status_idx"
    ON "SlotProposal"("organizationId", "status");

-- Le client lit les propositions en attente d'une réservation ; l'intervenant
-- lit les siennes. Deux accès, deux index.
CREATE INDEX "SlotProposal_bookingId_status_idx"
    ON "SlotProposal"("bookingId", "status");

CREATE INDEX "SlotProposal_cleanerProfileId_status_idx"
    ON "SlotProposal"("cleanerProfileId", "status");

ALTER TABLE "SlotProposal"
    ADD CONSTRAINT "SlotProposal_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SlotProposal"
    ADD CONSTRAINT "SlotProposal_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SlotProposal"
    ADD CONSTRAINT "SlotProposal_cleanerProfileId_fkey"
    FOREIGN KEY ("cleanerProfileId") REFERENCES "CleanerProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
