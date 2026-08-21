-- Noter une intervention, et ce que la note déclenche.
--
-- `Review` était modélisée depuis la phase 1 et n'a jamais été écrite : sans
-- clôture de mission, il n'y avait rien à noter. La clôture existe désormais,
-- et la notation ferme la boucle.

-- Les tags de l'avis. Deux taps — les étoiles, puis des tags — et le
-- commentaire reste facultatif : un champ libre obligatoire fait chuter le taux
-- de réponse sans rien apprendre de plus qu'une étoile.
--
-- Un tableau plutôt qu'une table de jointure : le vocabulaire est fermé
-- (`TAGS_AVIS`), il ne porte aucun attribut propre, et personne ne cherche
-- « tous les avis d'un tag » ailleurs que dans une agrégation.
ALTER TABLE "Review"
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Un avis n'est publiable qu'accompagné d'un commentaire et au-dessus de trois
-- étoiles. `isPublic` valait `true` par défaut depuis la migration initiale, ce
-- qui publierait une étoile nue dès la première écriture. La valeur par défaut
-- s'inverse : ce qui se publie est décidé par `estPubliable`, jamais subi.
ALTER TABLE "Review" ALTER COLUMN "isPublic" SET DEFAULT false;

-- Ce qu'une mauvaise note ouvre.
--
-- Trois étoiles ou moins appellent quelqu'un — la règle est sans exception, et
-- c'est délibéré : un seuil modulé par l'ancienneté du client ou la note de
-- l'intervenant serait un seuil que personne ne saurait expliquer à celui qui
-- en fait les frais.
--
-- La table sert aussi aux réclamations ouvertes sans note : un objet cassé se
-- signale que la mission ait été notée ou non.
CREATE TABLE "Reclamation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    -- Nullable : une réclamation peut porter sur un abonnement, une facture ou
    -- un incident sans intervention identifiée.
    "bookingId" TEXT,
    "clientProfileId" TEXT NOT NULL,
    -- PROPRETE | RETARD | COMPORTEMENT | CASSE | AUTRE
    "categorie" TEXT NOT NULL,
    -- OUVERTE | EN_COURS | RESOLUE | CLASSEE
    "statut" TEXT NOT NULL DEFAULT 'OUVERTE',
    -- P0 | P1 | P2 | P3 — la même échelle que la file d'attente ops, pour que
    -- le délai promis soit le même quel que soit le chemin d'entrée.
    "priorite" TEXT NOT NULL DEFAULT 'P2',
    "description" TEXT,
    -- Vrai quand le ticket est né d'une note basse plutôt que d'une démarche du
    -- client. Ce n'est pas cosmétique : on ne relance pas de la même façon
    -- quelqu'un qui a demandé quelque chose et quelqu'un à qui on écrit.
    "ouvertParLaNote" BOOLEAN NOT NULL DEFAULT false,
    "ouverteLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolueLe" TIMESTAMP(3),
    "resolution" TEXT,

    CONSTRAINT "Reclamation_pkey" PRIMARY KEY ("id")
);

-- Une seule réclamation ouverte par intervention : deux tickets sur le même
-- ménage se traitent deux fois et se répondent en double. La contrainte est
-- partielle, si bien qu'un second incident reste possible une fois le premier
-- clos.
CREATE UNIQUE INDEX "Reclamation_bookingId_ouverte_key"
  ON "Reclamation"("bookingId")
  WHERE "statut" IN ('OUVERTE', 'EN_COURS');

CREATE INDEX "Reclamation_organizationId_statut_priorite_idx"
  ON "Reclamation"("organizationId", "statut", "priorite");
CREATE INDEX "Reclamation_clientProfileId_idx" ON "Reclamation"("clientProfileId");

ALTER TABLE "Reclamation"
  ADD CONSTRAINT "Reclamation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Reclamation_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Reclamation_clientProfileId_fkey"
    FOREIGN KEY ("clientProfileId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
