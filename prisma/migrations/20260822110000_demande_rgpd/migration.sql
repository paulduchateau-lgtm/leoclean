-- La demande RGPD d'un intervenant part chez un humain.
--
-- **Pourquoi elle ne s'exécute pas toute seule, contrairement à celle du
-- client.** Un client efface ses données depuis son espace : le module sait
-- exactement quoi neutraliser, et ce qui reste — factures, montants — est
-- détaché de son identité. Un intervenant, lui, a émis des factures **en son
-- nom**, encaissé des reversements, signé des chartes, et son SIRET figure sur
-- des documents que le code de commerce impose de conserver dix ans. Effacer
-- sur simple clic produirait des factures sans émetteur, c'est-à-dire des
-- factures irrégulières.
--
-- La demande est donc enregistrée, datée, et traitée par quelqu'un — ce que le
-- RGPD autorise expressément dans le délai d'un mois. Ce que le produit doit
-- garantir, c'est qu'elle ne se perde pas : d'où une table, et non un email.
CREATE TYPE "DemandeRgpdType" AS ENUM ('ACCES', 'EFFACEMENT');
CREATE TYPE "DemandeRgpdStatut" AS ENUM ('RECUE', 'EN_COURS', 'TRAITEE', 'REFUSEE');

CREATE TABLE "DemandeRgpd" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "type"           "DemandeRgpdType" NOT NULL,
  "statut"         "DemandeRgpdStatut" NOT NULL DEFAULT 'RECUE',
  -- Ce que la personne a écrit, quand elle a précisé sa demande.
  "message"        TEXT,
  -- Ce que la plateforme a fait, et pourquoi. Exigé pour clore, comme pour une
  -- réclamation : « on n'a rien fait » est une décision qui se justifie.
  "resolution"     TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  "traiteeLe"      TIMESTAMP(3),
  "traiteeParId"   TEXT,
  CONSTRAINT "DemandeRgpd_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DemandeRgpd"
  ADD CONSTRAINT "DemandeRgpd_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "DemandeRgpd_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "DemandeRgpd_traiteeParId_fkey"
    FOREIGN KEY ("traiteeParId") REFERENCES "User"("id") ON DELETE SET NULL;

-- La file du back-office : ce qui attend, du plus ancien au plus récent. Le
-- délai légal court à compter de la réception, donc c'est l'ancienneté qui
-- décide de l'ordre — jamais la dernière arrivée.
CREATE INDEX "DemandeRgpd_statut_createdAt_idx"
  ON "DemandeRgpd"("statut", "createdAt");

-- Une seule demande ouverte par personne et par type : recliquer ne doit pas
-- empiler des demandes identiques dans la file de quelqu'un.
CREATE UNIQUE INDEX "DemandeRgpd_ouverte_unique"
  ON "DemandeRgpd"("userId", "type")
  WHERE "statut" IN ('RECUE', 'EN_COURS');
