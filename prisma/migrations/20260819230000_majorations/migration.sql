-- Majorations de jour et de délai.
--
-- Le dépôt facturait un dimanche au prix d'un mardi. Ce n'est pas seulement une
-- perte de recette : cela demande à quelqu'un de travailler le week-end pour le
-- tarif de la semaine, ce qui finit par se lire dans les refus.
--
-- Une majoration a un bénéficiaire, et il change selon sa cause. Le jour —
-- samedi, dimanche, férié — revient à l'intervenant, qui travaille. Le délai —
-- moins de 48 heures — revient à la plateforme, qui place la mission au forceps
-- dans une journée déjà arrêtée. Ce partage prolonge la règle du dépôt, où la
-- marge est un écart et non un taux, et il évite un pourcentage réparti au
-- prorata que personne ne saurait défendre.
ALTER TYPE "BookingItemKind" ADD VALUE 'SURCHARGE';

-- Les règles vivent en base comme les tarifs, et pour la même raison : une
-- société cliente du SaaS fixe les siennes. `public-grid.ts` porte celles de la
-- marketplace pour que le site les annonce sans lire la base.
CREATE TABLE "PricingSurcharge" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    -- SAMEDI | DIMANCHE_FERIE | COURT_DELAI
    "cause" TEXT NOT NULL,
    "rateBp" INTEGER NOT NULL,
    -- PROFESSIONAL | PLATFORM
    "beneficiary" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    -- Historisées comme `PricingRule` : une réservation passée continue de
    -- pointer sur la règle qui l'a chiffrée.
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingSurcharge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PricingSurcharge_organizationId_cause_validFrom_idx"
    ON "PricingSurcharge"("organizationId", "cause", "validFrom");

ALTER TABLE "PricingSurcharge"
    ADD CONSTRAINT "PricingSurcharge_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
