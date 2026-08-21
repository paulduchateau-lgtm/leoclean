-- Un mot de passe, en plus du lien de connexion.
--
-- Le dépôt avait tranché pour une connexion sans mot de passe, et cette
-- décision garde sa raison : un mot de passe qu'on n'a pas ne peut pas fuir.
-- Le mot de passe s'**ajoute** donc, il ne remplace rien — la colonne est
-- nullable, et un compte qui n'en a pas continue de se connecter par lien.
--
-- Il ne se définit que depuis une session déjà ouverte, c'est-à-dire après
-- avoir prouvé qu'on reçoit les emails de l'adresse. Conséquence : il n'y a
-- aucun parcours « mot de passe oublié » en base ni en code, le lien magique
-- en tenant lieu.
ALTER TABLE "User"
  -- Format `scrypt$N$r$p$sel$clef`, paramètres compris : un durcissement futur
  -- n'invalide pas les empreintes existantes, il les fait réencoder à la
  -- connexion suivante.
  ADD COLUMN "passwordHash"      TEXT,
  -- Date du dernier changement, affichée à la personne. Un mot de passe qu'on
  -- ne sait pas dater est un mot de passe qu'on ne pense jamais à changer.
  ADD COLUMN "passwordUpdatedAt" TIMESTAMP(3);
