-- ---------------------------------------------------------------------------
-- Facturation en deux lignes.
--
-- En mise en relation, l'intervenant vend sa prestation pour son propre compte
-- et la facture au client ; la plateforme facture séparément sa coordination.
-- Le client reçoit donc deux factures, dont la somme est le prix annoncé.
--
-- Ce n'est pas une présentation. C'est ce qui évite à la plateforme de devenir
-- prestataire au sens de l'article L7232-6, ce qui permet aux deux lignes
-- d'ouvrir droit au crédit d'impôt, et ce qui évite de gonfler le chiffre
-- d'affaires de l'intervenant au regard du plafond de la micro-entreprise.
-- ---------------------------------------------------------------------------

-- Nouveau mode d'engagement : la mise en relation.
ALTER TYPE "EngagementMode" ADD VALUE IF NOT EXISTS 'MISE_EN_RELATION' BEFORE 'MANDATAIRE';

-- La coordination est facturée au client, non prélevée à l'intervenant : le
-- type de facture change donc de sens, et pas seulement de nom.
ALTER TYPE "InvoiceType" RENAME VALUE 'PLATFORM_COMMISSION' TO 'CLIENT_COORDINATION';

-- ---------------------------------------------------------------------------
-- Décomposition du montant client.
--
-- `commissionAmountCents` devient `platformFeeAmountCents` : c'est le même
-- montant, mais il est désormais facturé au client et non retenu à
-- l'intervenant. Le renommage préserve les données existantes.
-- ---------------------------------------------------------------------------
ALTER TABLE "Booking" RENAME COLUMN "commissionAmountCents" TO "platformFeeAmountCents";

ALTER TABLE "Booking" ADD COLUMN "professionalAmountCents" INTEGER;

-- Les réservations existantes se voient attribuer le complément : c'est bien
-- ce que l'intervenant percevait déjà.
UPDATE "Booking"
   SET "professionalAmountCents" = "grossAmountCents" - "platformFeeAmountCents";

ALTER TABLE "Booking" ALTER COLUMN "professionalAmountCents" SET NOT NULL;

-- Les deux lignes doivent toujours recomposer exactement le prix annoncé au
-- client. Un écart d'un centime entre l'affichage et la somme des factures est
-- un litige, et un écart avec l'avance immédiate de l'URSSAF un rejet.
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_gross_equals_two_invoices" CHECK (
    "grossAmountCents" = "professionalAmountCents" + "platformFeeAmountCents"
  ),
  ADD CONSTRAINT "Booking_split_non_negative" CHECK (
    "professionalAmountCents" >= 0 AND "platformFeeAmountCents" >= 0
  );

-- ---------------------------------------------------------------------------
-- Émetteur de la facture.
--
-- Une facture de prestation est émise par l'intervenant, pour son propre
-- compte ; une facture de coordination par l'organisation. Savoir qui émet est
-- nécessaire à l'attestation fiscale annuelle, que chaque organisme déclaré
-- produit pour sa part.
-- ---------------------------------------------------------------------------
ALTER TABLE "Invoice" ADD COLUMN "issuedByCleanerProfileId" TEXT;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_issuedByCleanerProfileId_fkey"
  FOREIGN KEY ("issuedByCleanerProfileId") REFERENCES "CleanerProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Invoice_issuedByCleanerProfileId_idx"
  ON "Invoice" ("issuedByCleanerProfileId");
