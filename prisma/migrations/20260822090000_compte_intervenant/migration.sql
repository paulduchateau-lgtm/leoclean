-- Le compte de l'intervenant : sa suspension, et la soumission de son dossier.
--
-- `CleanerStatus.SUSPENDED` existait sans dire **qui** avait suspendu. La
-- distinction n'est pas cosmétique : une pause que l'intervenant s'est donnée
-- se reprend d'un bouton, une suspension décidée par la plateforme ne se lève
-- pas soi-même. Sans l'origine, l'écran proposerait « reprendre les missions »
-- à quelqu'un que la plateforme vient d'écarter — c'est-à-dire promettre ce que
-- le produit ne tiendra pas.
CREATE TYPE "SuspensionOrigin" AS ENUM ('CLEANER', 'PLATFORM');

ALTER TABLE "CleanerProfile"
  ADD COLUMN "suspensionOrigin" "SuspensionOrigin",
  ADD COLUMN "suspendedAt"      TIMESTAMP(3),
  -- Motif écrit par la plateforme, lu par l'intervenant. Jamais vide quand
  -- l'origine est `PLATFORM` : une suspension sans motif ne se conteste pas.
  ADD COLUMN "suspensionReason" TEXT,
  -- Instant où le dossier a été soumis à validation, `NULL` tant qu'il ne l'a
  -- pas été. Il distingue « complet mais pas envoyé » de « en cours d'examen »,
  -- deux états qui appellent des gestes opposés : agir, ou attendre.
  ADD COLUMN "dossierSubmittedAt" TIMESTAMP(3);

-- Les comptes déjà suspendus l'ont été par la plateforme : c'est le seul
-- mécanisme qui existait. Les laisser sans origine les rendrait réversibles
-- d'un bouton par leur titulaire.
UPDATE "CleanerProfile"
   SET "suspensionOrigin" = 'PLATFORM', "suspendedAt" = "updatedAt"
 WHERE "status" = 'SUSPENDED';

-- Un compte actif a forcément vu son dossier examiné : le dater à sa date
-- d'activation évite qu'il réclame une soumission déjà faite.
UPDATE "CleanerProfile"
   SET "dossierSubmittedAt" = COALESCE("activatedAt", "createdAt")
 WHERE "status" = 'ACTIVE';

-- La file du back-office : les dossiers soumis, du plus ancien au plus récent.
CREATE INDEX "CleanerProfile_status_dossierSubmittedAt_idx"
  ON "CleanerProfile"("status", "dossierSubmittedAt");
