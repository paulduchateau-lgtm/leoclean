-- Fermer la porte que Supabase ouvre par défaut.
--
-- Le cloisonnement multi-tenant de ce dépôt vit dans une extension Prisma
-- (`forOrganization`), et cela reste vrai. Mais l'extension ne protège que ce
-- qui passe par l'application — or **Supabase expose une seconde porte** :
-- PostgREST sur `https://<ref>.supabase.co/rest/v1/<Table>`, atteignable avec la
-- clé anonyme, laquelle est publique par construction puisqu'elle est destinée
-- à être livrée dans un navigateur.
--
-- Supabase pose par ailleurs, sur le schéma `public`, des privilèges par défaut
-- qui accordent `ALL` aux rôles `anon` et `authenticated` sur toute table
-- nouvellement créée. Les tables engendrées par `prisma migrate` en héritent
-- donc silencieusement. Sans RLS, la conséquence est nette : n'importe qui
-- muni de la clé anonyme lit `User`, `Address`, `Booking`, `CleanerProfile` —
-- noms, téléphones, adresses de domicile, consignes d'accès.
--
-- Trois verrous, du plus fort au plus faible, parce qu'aucun ne suffit seul :
--
--   1. RLS activée sans aucune politique : le refus est le défaut, et il
--      s'applique même si un privilège est réaccordé par erreur.
--   2. Privilèges retirés à `anon` et `authenticated` : PostgREST ne voit plus
--      les tables du tout, et n'a donc rien à refuser.
--   3. Privilèges par défaut annulés : une table créée par une migration
--      future ne repart pas ouverte.
--
-- **`FORCE ROW LEVEL SECURITY` n'est volontairement pas posée.** Le propriétaire
-- d'une table contourne la RLS, et c'est exactement ce qu'on veut : l'application
-- se connecte avec ce rôle, et son cloisonnement est déjà assuré par
-- l'extension. Forcer la RLS couperait l'application sans rien ajouter contre la
-- porte qu'on ferme ici.

-- --- 1. RLS sur toutes les tables du schéma public --------------------------
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      -- La table de Prisma n'est pas exposée par PostgREST et son verrouillage
      -- gênerait les outils de migration sans rien protéger.
      AND c.relname <> '_prisma_migrations'
      -- Tables système de PostGIS, dont la lecture est nécessaire au
      -- fonctionnement de l'extension elle-même.
      AND c.relname NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END
$$;

-- --- 2 et 3. Privilèges des rôles Supabase ----------------------------------
-- Les rôles n'existent pas sur une base locale ni en intégration : le bloc est
-- gardé plutôt que conditionné à l'hébergeur, pour que la même migration
-- s'applique partout sans variante.
DO $$
DECLARE
  r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE USAGE ON SCHEMA public FROM %I', r);

      -- Les privilèges par défaut sont attachés au rôle qui crée les objets.
      -- On les annule pour `postgres` et pour le rôle courant, qui sont les
      -- deux identités sous lesquelles une migration s'exécute ici.
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
      END IF;
    END IF;
  END LOOP;
END
$$;

-- --- 4. Garde-fou : l'application doit rester propriétaire ------------------
-- La RLS sans politique refuse **tout le monde sauf le propriétaire de la
-- table**. C'est exactement ce qu'on veut : l'application se connecte avec le
-- rôle propriétaire, et son cloisonnement est déjà assuré par l'extension
-- Prisma.
--
-- Mais cette hypothèse est invérifiable depuis le dépôt : elle dépend du rôle
-- que l'hébergeur donne à la chaîne de connexion. S'il n'est pas propriétaire,
-- la migration passerait sans bruit et **le site entier deviendrait aveugle**
-- au premier déploiement, sans qu'aucune erreur ne désigne la cause.
--
-- On vérifie donc le privilège, et **non le nombre de lignes lues** : quand la
-- RLS bloque, elle bloque toutes les tables, si bien que deux comptages nuls se
-- confirmeraient l'un l'autre et ne prouveraient rien. Trois façons de passer
-- outre la RLS, et on les accepte toutes les trois : être propriétaire (ou
-- membre du rôle propriétaire), être superutilisateur, porter `BYPASSRLS`.
--
-- Un échec ici fait échouer la migration, donc le déploiement, et laisse la
-- version précédente en ligne. Un arrêt nommé vaut mieux qu'un site muet.
DO $$
DECLARE
  contourne BOOLEAN;
  orpheline TEXT;
BEGIN
  SELECT rolsuper OR rolbypassrls INTO contourne
  FROM pg_roles WHERE rolname = current_user;

  IF contourne THEN RETURN; END IF;

  SELECT c.relname INTO orpheline
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity
    AND NOT pg_has_role(current_user, c.relowner, 'USAGE')
  LIMIT 1;

  IF orpheline IS NOT NULL THEN
    RAISE EXCEPTION
      'RLS activée sur "%" mais le rôle % n''en est pas propriétaire : '
      'l''application ne lirait plus rien. Voir docs/SECURITE-ACCES.md.',
      orpheline, current_user;
  END IF;
END
$$;
