-- Le rappel de notation, envoyé une fois et une seule.
--
-- L'ordonnanceur repasse toutes les heures : sans marque, il enverrait le même
-- rappel vingt-quatre fois par jour jusqu'à ce que la personne note — ce qui
-- est le plus sûr moyen de la faire se désabonner plutôt que de la faire noter.
--
-- Même dessin que `Payment."lastReminderAt"` : une date, écrite avant l'envoi,
-- qui vaut à la fois marque et journal.
ALTER TABLE "Booking"
  ADD COLUMN "reviewReminderAt" TIMESTAMP(3);

-- La file du rappel se lit par cet index : les interventions terminées, sans
-- rappel encore envoyé.
CREATE INDEX "Booking_status_reviewReminderAt_idx"
  ON "Booking"("status", "reviewReminderAt");
