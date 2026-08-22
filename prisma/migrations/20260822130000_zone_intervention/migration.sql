-- Zone d'intervention dessinée à la main par l'intervenant.
--
-- Nullable, et elle le reste : le rayon demeure le réglage par défaut, un
-- cercle se comprenant sans rien dessiner. Poser une zone par défaut
-- reviendrait à décider du périmètre de quelqu'un à sa place.
ALTER TABLE "CleanerProfile"
  ADD COLUMN "serviceAreaPolygon" JSONB;
