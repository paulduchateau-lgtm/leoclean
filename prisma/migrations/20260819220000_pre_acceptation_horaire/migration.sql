-- La contre-proposition d'horaire s'ouvre dès l'écran de proposition.
--
-- Jusqu'ici elle n'existait que dans un cas : personne n'avait accepté la
-- mission, la réservation était retombée en `PENDING_ASSIGNMENT`, et le client
-- attendait. Un intervenant à qui l'heure demandée ne convenait que d'une
-- demi-heure n'avait donc qu'une sortie — refuser.
--
-- Il peut désormais répondre « je peux, mais à telle heure » tant qu'il tient
-- l'offre. Sous une heure d'écart, cette réponse vaut pré-acceptation et part
-- au client immédiatement ; au-delà, elle est conservée et n'atteint le client
-- que si le lot expire sans acceptation, c'est-à-dire le comportement qui
-- existait déjà. Un mécanisme, deux vitesses.
--
-- `visibleAt` porte cette différence plutôt qu'un statut : le statut décrit le
-- cycle de la réponse, pas celui de la visibilité. Les mêler rendrait « en
-- attente mais pas encore montrée » inexprimable.
ALTER TABLE "SlotProposal"
  ADD COLUMN "visibleAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Les propositions existantes sont toutes nées du chemin lent, sur une
-- réservation orpheline : elles étaient visibles dès leur création, et le
-- restent. Reprendre leur date de création plutôt que « maintenant » évite de
-- rendre invisible pendant un instant ce qu'un client avait déjà sous les yeux.
UPDATE "SlotProposal" SET "visibleAt" = "createdAt";

CREATE INDEX "SlotProposal_bookingId_status_visibleAt_idx"
  ON "SlotProposal"("bookingId", "status", "visibleAt");
