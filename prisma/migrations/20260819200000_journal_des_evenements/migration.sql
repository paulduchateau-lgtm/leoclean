-- Journal des événements de parcours.
--
-- Le dépôt ne mesurait rien. Le module Frictions, les objectifs de conversion du
-- tunnel et les scores de churn liront tous cette table — mais aucun ne peut
-- lire un passé qu'on n'a pas enregistré. C'est le seul chantier dont le coût
-- monte chaque semaine où il n'est pas fait.
--
-- La mesure vit ici plutôt que chez un tiers, et ce n'est pas une économie :
-- le module Frictions interrogera la même base que le reste du produit, et une
-- mesure qui ne dépose aucun cookie et ne suit personne d'un site à l'autre n'a
-- pas à demander un consentement qu'on obtiendrait mal.
--
-- Aucune donnée personnelle n'entre dans cette table : ni nom, ni email, ni
-- téléphone, ni adresse, ni position, ni adresse IP. `CHAMPS_INTERDITS`
-- l'impose à l'écriture et un test l'impose à la définition — sans quoi une
-- table de mesure échapperait à la purge des comptes et deviendrait le dernier
-- endroit où une identité survit.
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    -- Identifiant de parcours engendré par le navigateur, opaque et sans lien
    -- avec une identité. Il ne relie que les écrans d'une même session ; sans
    -- lui, un taux d'abandon par étape n'est pas calculable.
    "journeyId" TEXT,
    -- Renseigné seulement si la personne était connectée, ce qui n'arrive pas
    -- avant l'avant-dernier écran du tunnel.
    "userId" TEXT,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- L'analyse lit « tel événement sur telle période, pour telle organisation ».
CREATE INDEX "AnalyticsEvent_organizationId_name_occurredAt_idx"
    ON "AnalyticsEvent"("organizationId", "name", "occurredAt");

-- Reconstituer un parcours : tous les écrans d'une même session.
CREATE INDEX "AnalyticsEvent_journeyId_idx" ON "AnalyticsEvent"("journeyId");

-- La purge de rétention balaie par date, toutes organisations confondues.
CREATE INDEX "AnalyticsEvent_occurredAt_idx" ON "AnalyticsEvent"("occurredAt");

ALTER TABLE "AnalyticsEvent"
    ADD CONSTRAINT "AnalyticsEvent_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
