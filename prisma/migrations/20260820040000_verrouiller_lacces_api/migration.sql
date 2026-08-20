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
