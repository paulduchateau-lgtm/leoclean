-- La rémunération de l'intervenant devient une donnée, plus une déduction.
--
-- Jusqu'ici la répartition se calculait en appliquant `Organization.commissionRateBp`
-- au prix client : un taux unique, le même pour toutes les fréquences. La grille
-- retenue ne s'exprime pas ainsi — 23 € pour l'intervenant et 28 € au client en
-- régulier, 21 € et 30 € en ponctuel — soit 5 € et 9 € de coordination, donc
-- deux taux effectifs différents (17,86 % et 30 %).
--
-- Le sens du calcul s'inverse donc, et c'est le modèle juridique qui l'impose :
-- la rémunération est un montant proposé à l'intervenant, qu'il accepte avant de
-- prendre la mission. Un pourcentage appliqué après coup décrirait une relation
-- que les CGU refusent. `commissionRateBp` reste calculé et stocké sur chaque
-- réservation, mais comme taux **effectif**, pour l'audit.
ALTER TABLE "PricingRule"
  ADD COLUMN "professionalHourlyRateCents" INTEGER;

-- Les règles existantes sont reprises au taux qui les gouvernait — 38 % de
-- coordination — pour qu'aucune ligne ne change de valeur du seul fait de la
-- migration. Les nouveaux tarifs sont posés par le socle, pas ici : une
-- migration qui décide d'un prix le rendrait invisible à qui lit la grille.
UPDATE "PricingRule" r
SET "professionalHourlyRateCents" = ROUND(
  r."hourlyRateCents" * (10000 - COALESCE(o."commissionRateBp", 3800)) / 10000.0
)
FROM "Organization" o
WHERE o.id = r."organizationId" AND r."professionalHourlyRateCents" IS NULL;

-- Reste les règles orphelines, s'il en existe : le taux par défaut suffit.
UPDATE "PricingRule"
SET "professionalHourlyRateCents" = ROUND("hourlyRateCents" * 0.62)
WHERE "professionalHourlyRateCents" IS NULL;

ALTER TABLE "PricingRule"
  ALTER COLUMN "professionalHourlyRateCents" SET NOT NULL;

-- Une rémunération ne peut pas dépasser ce que paie le client : la coordination
-- serait négative, et le contrôle applicatif ne résiste pas à un import.
ALTER TABLE "PricingRule"
  ADD CONSTRAINT "PricingRule_remuneration_sous_le_tarif"
  CHECK ("professionalHourlyRateCents" BETWEEN 0 AND "hourlyRateCents");
