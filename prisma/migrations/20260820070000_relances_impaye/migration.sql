-- Ce qui suit un prélèvement refusé.
--
-- `prochaineRelance` et `ECHECS_AVANT_SUSPENSION` sont écrits et testés depuis
-- le jalon E, et personne ne les appelait : un prélèvement refusé restait
-- `FAILED` sans que rien ne se passe. Le client ne savait pas, l'intervenant
-- n'était pas payé, et la mission suivante partait quand même.
--
-- Trois colonnes suffisaient, et leur absence était le seul obstacle : sans
-- date du premier échec ni compteur de tentatives, le calendrier n'a rien à
-- calculer.
ALTER TABLE "Payment"
  -- Date du **premier** échec, et non du dernier : c'est elle qui datte toute
  -- la suite des relances. La remplacer à chaque tentative repousserait
  -- indéfiniment la suspension.
  ADD COLUMN "firstFailedAt" TIMESTAMP(3),
  -- Nombre de tentatives de prélèvement refusées.
  ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  -- Dernière relance envoyée, pour ne pas la renvoyer à chaque passage de
  -- l'ordonnanceur — il repasse toutes les heures, la relance est en jours.
  ADD COLUMN "lastReminderAt" TIMESTAMP(3);

CREATE INDEX "Payment_status_firstFailedAt_idx"
  ON "Payment"("status", "firstFailedAt");
