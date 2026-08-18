-- Diffusion d'une mission à plusieurs intervenants, par lots.
--
-- La garantie anti-double-réservation ne disparaît pas : elle change de moment
-- et se dédouble. Jusqu'ici, une proposition réservait la place — le créneau
-- était tenu dès la réservation, par une seule personne. Désormais cinq
-- intervenants reçoivent la même proposition et aucun ne bloque rien : c'est
-- l'acceptation qui tranche.

-- 1. Un statut pour la course perdue.
--
-- Ni DECLINED, qui pèserait sur le taux d'acceptation de quelqu'un qui n'a rien
-- refusé, ni CANCELLED, qui laisserait croire à une décision de la plateforme.
ALTER TYPE "AssignmentStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';

-- 2. Le lot d'où vient la proposition, et l'état de la diffusion.
ALTER TABLE "Assignment" ADD COLUMN "lot" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Booking"
  ADD COLUMN "diffusionLot" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "diffusionLotSentAt" TIMESTAMP(3),
  ADD COLUMN "diffusionDeadlineAt" TIMESTAMP(3);

CREATE INDEX "Booking_diffusionDeadlineAt_status_idx"
  ON "Booking" ("diffusionDeadlineAt", "status");

-- 3. Ce que cette migration ne fait **pas** encore, et pourquoi.
--
-- `Assignment_no_overlap` couvre aujourd'hui `PROPOSED` et `ACCEPTED` : une
-- proposition réserve le créneau. Il faudra l'y retirer, sans quoi un
-- intervenant ne pourra pas recevoir deux propositions qui se chevauchent —
-- c'est-à-dire exactement ce qu'une diffusion cherche à faire.
--
-- Mais `createBooking` s'appuie aujourd'hui sur ce refus pour arbitrer deux
-- réservations concurrentes : il essaie le candidat suivant quand la base
-- refuse le premier. Déplacer la garantie sans avoir réécrit l'attribution
-- laisserait deux clients servis par la même personne. Un test d'intégration
-- le démontre, et c'est lui qui commande l'ordre : la rectification part avec
-- la réécriture, dans la migration suivante.
--
-- Le second verrou, lui, n'a rien demandé : `Assignment_one_accepted_per_booking`
-- — index unique partiel sur `("bookingId") WHERE status = 'ACCEPTED'` — existe
-- depuis la migration initiale. C'est déjà « le premier qui accepte l'emporte »,
-- écrit avant qu'on en ait besoin.
