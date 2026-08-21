-- Le client peut avoir un portrait, comme l'intervenant en a un.
--
-- `CleanerProfile` portait `photoUrl` depuis la phase 1 ; `ClientProfile` non,
-- parce que rien ne montrait le client. La messagerie change cela : un fil sans
-- visage se lit comme un guichet, et la promesse du service est justement qu'on
-- se connaît.
--
-- Une URL et non un chemin de coffre : le coffre des portraits est public
-- (arbitrage du porteur du projet, 21 août 2026), et sa lecture ne demande donc
-- pas de signature. Stocker l'URL évite d'avoir à la recomposer à chaque rendu,
-- et rend la colonne lisible telle quelle par n'importe quel écran.
ALTER TABLE "ClientProfile"
  ADD COLUMN "photoUrl" TEXT;
