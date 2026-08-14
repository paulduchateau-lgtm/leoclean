-- ---------------------------------------------------------------------------
-- Attention : `Address.geog` et son index GIST ne sont pas déclarés dans
-- schema.prisma — Prisma ne sait pas exprimer une colonne générée PostGIS.
--
-- Toute migration produite par `prisma migrate diff` les voit donc comme une
-- dérive et propose de les supprimer. Ces instructions ont été retirées ici, et
-- doivent l'être de toute migration future. Le test d'intégration
-- « dérive automatiquement la géométrie » échoue si elles passent.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Parrainage et cooptation.
--
-- Deux mécaniques, un seul niveau. Un client qui en parraine un autre reçoit un
-- avoir unique équivalent à une heure de ménage ; un intervenant qui en coopte
-- un autre perçoit une commission sur le chiffre d'affaires réellement réalisé
-- par la personne qu'il a fait venir, pendant une durée bornée.
--
-- L'absence de toute colonne rattachant un parrainage à un autre est
-- délibérée : elle rend structurellement impossible de rémunérer les filleuls
-- d'un filleul, ce qui ferait dépendre le gain du recrutement plutôt que de
-- l'activité — la définition même de la vente à la boule de neige, interdite
-- par l'article L.121-15 du Code de la consommation.
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "ReferrerKind" AS ENUM ('CLIENT', 'CLEANER');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReferralRewardKind" AS ENUM ('CREDIT', 'CASH');

-- CreateEnum
CREATE TYPE "ReferralRewardStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "kind" "ReferrerKind" NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "refereeUserId" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "completedBookings" INTEGER NOT NULL DEFAULT 0,
    "qualifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "kind" "ReferralRewardKind" NOT NULL,
    "status" "ReferralRewardStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "basisAmountCents" INTEGER,
    "cappedByMonthlyLimit" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE INDEX "ReferralCode_organizationId_isActive_idx" ON "ReferralCode"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_organizationId_ownerUserId_kind_key" ON "ReferralCode"("organizationId", "ownerUserId", "kind");

-- CreateIndex
CREATE INDEX "Referral_organizationId_status_idx" ON "Referral"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Referral_referralCodeId_idx" ON "Referral"("referralCodeId");

-- CreateIndex
CREATE INDEX "Referral_expiresAt_idx" ON "Referral"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_refereeUserId_key" ON "Referral"("refereeUserId");

-- CreateIndex
CREATE INDEX "ReferralReward_organizationId_status_idx" ON "ReferralReward"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralReward_referralId_periodStart_key" ON "ReferralReward"("referralId", "periodStart");

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_refereeUserId_fkey" FOREIGN KEY ("refereeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Garde-fous.
--
-- Ces règles vivent en base parce qu'elles protègent de l'argent : un contrôle
-- applicatif ne résisterait pas à deux traitements mensuels concurrents.
-- ---------------------------------------------------------------------------

-- Une récompense n'est jamais négative.
ALTER TABLE "ReferralReward"
  ADD CONSTRAINT "ReferralReward_amount_non_negative" CHECK ("amountCents" >= 0);

-- Une période de commission est ordonnée, ou absente pour une récompense unique.
ALTER TABLE "ReferralReward"
  ADD CONSTRAINT "ReferralReward_period_ordered" CHECK (
    ("periodStart" IS NULL AND "periodEnd" IS NULL)
    OR ("periodStart" IS NOT NULL AND "periodEnd" > "periodStart")
  );

-- Le compteur de prestations qualifiantes ne décroît pas dans le négatif.
ALTER TABLE "Referral"
  ADD CONSTRAINT "Referral_completed_bookings_non_negative"
  CHECK ("completedBookings" >= 0);
