-- Le fil passe de l'intervention au couple client / intervenant.
--
-- Il suivait la réservation. Un client qui revoyait la même personne chaque
-- semaine ouvrait donc un fil par semaine, et retrouver ce qu'on s'était dit
-- supposait de se rappeler à quelle réservation on avait écrit. La promesse du
-- service étant « la même personne chaque semaine », c'est la relation qui dure
-- — pas la prestation.
--
-- **Changer d'intervenant ouvre un fil neuf, et c'est gratuit** : le couple
-- change, donc la clé change. Le remplaçant n'hérite d'aucun historique, ce qui
-- protège la vie privée du client comme celle de l'intervenant précédent. Rien
-- n'a besoin d'être codé pour cela, c'est la contrainte d'unicité qui le tient.

CREATE TABLE "Conversation" (
  "id"               TEXT NOT NULL,
  "organizationId"   TEXT NOT NULL,
  "clientProfileId"  TEXT NOT NULL,
  "cleanerProfileId" TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Date du dernier message, pour ordonner la liste sans la parcourir.
  "lastMessageAt"    TIMESTAMP(3),
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "Conversation_clientProfileId_fkey"
    FOREIGN KEY ("clientProfileId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "Conversation_cleanerProfileId_fkey"
    FOREIGN KEY ("cleanerProfileId") REFERENCES "CleanerProfile"("id") ON DELETE CASCADE;

-- Un seul fil par couple : c'est cette contrainte qui *fait* la relation, et
-- c'est elle qui rend l'ouverture d'un fil idempotente.
CREATE UNIQUE INDEX "Conversation_org_client_cleaner_key"
  ON "Conversation"("organizationId", "clientProfileId", "cleanerProfileId");
CREATE INDEX "Conversation_organizationId_lastMessageAt_idx"
  ON "Conversation"("organizationId", "lastMessageAt");

CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'SYSTEM');

ALTER TABLE "Message"
  ADD COLUMN "conversationId" TEXT,
  ADD COLUMN "kind" "MessageKind" NOT NULL DEFAULT 'TEXT';

-- Reprise des fils existants : chaque réservation qui porte des messages
-- désigne un client et — par son affectation retenue — un intervenant. C'est
-- ce couple qui devient le fil.
--
-- `COMPLETED` compte autant qu'`ACCEPTED` : une mission terminée a bel et bien
-- eu son intervenant, et l'ignorer laisserait ses messages orphelins.
INSERT INTO "Conversation" ("id", "organizationId", "clientProfileId", "cleanerProfileId", "createdAt", "lastMessageAt")
SELECT
  gen_random_uuid()::text,
  b."organizationId",
  b."clientProfileId",
  a."cleanerProfileId",
  MIN(m."createdAt"),
  MAX(m."createdAt")
FROM "Message" m
JOIN "Booking" b ON b."id" = m."bookingId"
JOIN "Assignment" a ON a."bookingId" = b."id" AND a."status" IN ('ACCEPTED', 'COMPLETED')
GROUP BY b."organizationId", b."clientProfileId", a."cleanerProfileId";

UPDATE "Message" m
SET "conversationId" = c."id"
FROM "Booking" b
JOIN "Assignment" a ON a."bookingId" = b."id" AND a."status" IN ('ACCEPTED', 'COMPLETED')
JOIN "Conversation" c
  ON c."organizationId" = b."organizationId"
 AND c."clientProfileId" = b."clientProfileId"
 AND c."cleanerProfileId" = a."cleanerProfileId"
WHERE b."id" = m."bookingId";

-- Un message qu'on ne sait rattacher à aucun couple n'a plus de fil où vivre :
-- il désignait une réservation sans intervenant retenu, donc une conversation
-- qui n'a jamais eu deux bouts. Le supprimer est préférable à le laisser
-- pendre — une ligne sans fil serait invisible et indélébile.
DELETE FROM "Message" WHERE "conversationId" IS NULL;

ALTER TABLE "Message"
  ALTER COLUMN "conversationId" SET NOT NULL,
  -- L'auteur devient facultatif : un événement système n'en a pas.
  ALTER COLUMN "senderUserId" DROP NOT NULL;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE;

-- La réservation devient un simple pointeur de contexte : sa disparition ne
-- doit plus emporter le message, qui appartient désormais au fil.
ALTER TABLE "Message" DROP CONSTRAINT IF EXISTS "Message_bookingId_fkey";
ALTER TABLE "Message"
  ADD CONSTRAINT "Message_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL;

DROP INDEX IF EXISTS "Message_bookingId_createdAt_idx";
CREATE INDEX "Message_conversationId_createdAt_idx"
  ON "Message"("conversationId", "createdAt");
