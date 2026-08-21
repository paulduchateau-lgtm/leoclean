-- Captation de la demande hors zone.
--
-- Le tunnel rend une réservation hors zone structurellement impossible, et
-- c'est un bon choix. La conséquence est que le produit n'a aucun signal
-- d'expansion : personne ne sait combien de gens ont voulu réserver depuis
-- Pessac, ni combien d'intervenants se sont proposés depuis Talence.
--
-- Aucune coordonnée n'est enregistrée. Une commune suffit à décider d'ouvrir un
-- secteur ; un point désigne un domicile, et le conserver reviendrait à
-- constituer un fichier d'adresses de gens qui ne sont pas clients.
CREATE TABLE "Waitlist" (
    "id" TEXT NOT NULL,
    -- CLIENT | CLEANER : les deux manques ne se comblent pas de la même façon.
    "kind" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "communeName" TEXT NOT NULL,
    "postalCode" TEXT,
    "sourcePath" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Waitlist_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Waitlist_kind_communeName_createdAt_idx"
    ON "Waitlist"("kind", "communeName", "createdAt");
