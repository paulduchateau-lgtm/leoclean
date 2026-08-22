-- Rayon d'action de l'intervenant, en kilomètres à vol d'oiseau depuis son
-- domicile. C'est lui qui décide si une mission lui est proposée.
--
-- Vingt kilomètres par défaut : c'est l'ordre de grandeur du territoire — la
-- commune la plus éloignée est à 21 minutes de route de Léognan — si bien que
-- la valeur par défaut ne retire personne de la circulation le jour de la
-- migration. Un défaut plus court aurait coupé des intervenants actifs sans
-- que personne ne l'ait demandé.
ALTER TABLE "CleanerProfile"
  ADD COLUMN "serviceRadiusKm" INTEGER NOT NULL DEFAULT 20;
