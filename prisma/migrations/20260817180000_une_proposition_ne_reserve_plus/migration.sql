-- Une proposition ne réserve plus le créneau.
--
-- Cette rectification attendait son remplaçant, et il est là : `createBooking`
-- ne désigne plus un intervenant, il diffuse la mission aux cinq mieux classés.
-- Tant qu'il s'appuyait sur le refus de la base pour arbitrer deux réservations
-- concurrentes, déplacer la garantie aurait laissé deux clients servis par la
-- même personne — un test d'intégration le démontrait, et c'est lui qui a
-- imposé l'ordre.
--
-- Ce qui change : la contrainte ne couvre plus `PROPOSED`. Sans cela, un
-- intervenant ne pourrait pas recevoir deux propositions qui se chevauchent,
-- c'est-à-dire exactement ce qu'une diffusion cherche à faire — lui soumettre
-- des possibilités dont il ne retiendra qu'une.
--
-- Ce qui ne change pas : personne ne peut être à deux endroits à la fois. La
-- contrainte garde tout son sens sur ce qu'il a accepté, tampons de trajet
-- compris, et c'est désormais l'acceptation qui la rencontre. Avec
-- `Assignment_one_accepted_per_booking`, présent depuis la migration initiale,
-- les deux moitiés du modèle sont tenues par la base : une personne ne prend
-- pas deux missions qui se chevauchent, une mission n'a pas deux personnes.
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_no_overlap";

ALTER TABLE "Assignment"
  ADD CONSTRAINT "Assignment_no_overlap"
  EXCLUDE USING GIST (
    "cleanerProfileId" WITH =,
    tsrange("blockStartAt", "blockEndAt", '[)') WITH &&
  )
  WHERE ("status" = 'ACCEPTED');
