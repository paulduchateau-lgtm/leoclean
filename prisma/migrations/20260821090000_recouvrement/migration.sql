-- Le recouvrement appartient au client, pas à chacune de ses réservations.
--
-- `traiterLesImpayes` calculait déjà la liste `aSuspendre` — et personne ne la
-- consommait : aucune réservation ne se gelait, aucun intervenant n'était
-- prévenu. Le site promet pourtant à l'intervenant qu'il ne se déplacera pas
-- pour rien, et cette promesse est publique depuis l'arbitrage des garanties.
--
-- La tentation était de poser un statut `SUSPENDED` sur chaque réservation à
-- venir. Elle a été écartée : il aurait fallu parcourir les réservations au gel
-- **et** au dégel, et un seul oubli au dégel laisserait gelé quelqu'un qui a
-- payé — c'est-à-dire la panne la plus coûteuse du lot, celle qui punit le
-- client redevenu bon. Une seule date sur le client, et le gel de chaque
-- intervention s'en **dérive** : régulariser lève tout, d'un coup, sans
-- parcours.
ALTER TABLE "ClientProfile"
  -- Date d'entrée en recouvrement, `NULL` quand tout est en ordre. Comme
  -- `Payment."firstFailedAt"`, elle ne bouge pas tant que la situation dure :
  -- la remplacer à chaque nouvel échec ferait rajeunir indéfiniment une dette,
  -- et c'est son ancienneté qui décide de l'ordre d'appel au back-office.
  ADD COLUMN "recouvrementDepuis" TIMESTAMP(3);

-- La file du back-office se lit par cet index : les clients en recouvrement,
-- du plus ancien au plus récent. L'index est partiel — il ne porte que les
-- lignes concernées, qui sont l'exception.
CREATE INDEX "ClientProfile_recouvrementDepuis_idx"
  ON "ClientProfile"("recouvrementDepuis")
  WHERE "recouvrementDepuis" IS NOT NULL;
