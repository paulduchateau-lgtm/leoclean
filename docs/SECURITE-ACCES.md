# Accès aux données et aux secrets

État au 20 août 2026. Ce document décrit **par où on entre**, et ce qui ferme
chaque porte. Il est tenu à jour avec le code : une porte ouverte qu'on ne sait
pas nommer est une porte qu'on a oublié de fermer.

## Il y a deux portes, et une seule était gardée

Le cloisonnement multi-tenant de ce dépôt vit dans une extension Prisma
(`forOrganization`, `src/lib/db.ts`). Elle est solide et testée — mais elle ne
protège **que ce qui passe par l'application**.

Supabase en ouvre une seconde, indépendante : **PostgREST**, sur
`https://<ref>.supabase.co/rest/v1/<Table>`. Elle s'atteint avec la clé
anonyme, laquelle est publique par construction puisqu'elle est destinée à être
livrée dans un navigateur. Supabase pose en outre, sur le schéma `public`, des
privilèges par défaut accordant `ALL` aux rôles `anon` et `authenticated` sur
toute table nouvellement créée : **les tables engendrées par `prisma migrate`
en héritent silencieusement**.

Sans RLS, la conséquence est nette : quiconque dispose de la clé anonyme lit
`User`, `Address`, `Booking`, `CleanerProfile` — noms, téléphones, adresses de
domicile, consignes d'accès. Aucune ligne de code du dépôt ne s'en aperçoit,
parce que rien de tout cela ne passe par le dépôt.

### Ce que la migration `20260820040000_verrouiller_lacces_api` fait

Trois verrous, du plus fort au plus faible, parce qu'aucun ne suffit seul :

1. **RLS activée sur toutes les tables, sans aucune politique.** Le refus est
   le défaut, et il s'applique même si un privilège est réaccordé par erreur.
2. **Privilèges retirés à `anon` et `authenticated`.** PostgREST ne voit plus
   les tables du tout, et n'a donc rien à refuser.
3. **Privilèges par défaut annulés.** Une table créée par une migration future
   ne repart pas ouverte.

**`FORCE ROW LEVEL SECURITY` n'est volontairement pas posée.** Le propriétaire
d'une table contourne la RLS, et c'est exactement ce qu'on veut : l'application
se connecte avec ce rôle, son cloisonnement étant déjà assuré par l'extension.
Forcer la RLS couperait l'application sans rien ajouter contre la porte qu'on
ferme ici.

`src/lib/acces-api.integration.test.ts` est le seul endroit où un oubli se voit :
`prisma migrate` n'active pas la RLS sur les tables qu'il crée, et rien d'autre
ne le signalerait. Le test échoue en nommant la table et le SQL à ajouter.

### À faire dans la console Supabase, une fois

La migration ferme la porte ; ces réglages la murent. Ils ne peuvent pas être
écrits en SQL versionné, d'où cette liste.

- [ ] **Retirer `public` des schémas exposés** (Settings → API → Exposed
      schemas). Le produit n'emploie aucun client Supabase : il parle à
      PostgreSQL par Prisma. La Data API ne lui sert donc à rien, et la
      désactiver supprime la porte plutôt que de la garder.
- [ ] **Vérifier qu'aucune clé `service_role` n'est déployée.** Elle contourne
      la RLS par conception. Le dépôt n'en a aucun usage : elle n'a pas à
      exister dans les variables d'environnement de Vercel.
- [ ] **Faire tourner le mot de passe de la base** si l'URL de connexion a pu
      circuler (capture d'écran, presse-papiers, journal de build). Elle porte
      l'identité qui, elle, contourne la RLS.
- [ ] **Restreindre les IP autorisées** si l'offre le permet — la connexion
      applicative vient de Vercel, pas d'un poste.

## Secrets : où ils vivent, et ce qui les empêche de sortir

`src/lib/env.ts` est la seule frontière. Deux jeux, séparés par construction :

- **`clientEnv`** ne contient que des `NEXT_PUBLIC_*`, tous destinés au
  navigateur. La seule clé qui s'y trouve est la clé **publiable** Stripe, dont
  le schéma exige le préfixe `pk_` : une clé secrète collée à cet endroit fait
  échouer le démarrage.
- **`serverEnv`** est un `Proxy` qui **lève dès qu'on y touche côté client**.
  C'est ce qui empêche un secret d'arriver dans le bundle par inadvertance —
  sans lui, Next remplacerait l'accès par `undefined`, en silence.

Aucun module portant `"use client"` n'importe `serverEnv`. Les modules qui
manipulent un secret portent `server-only`, qui échoue à la compilation s'ils
sont tirés dans un graphe client.

### Surface publique

Quatre routes seulement, et chacune sait pourquoi elle est ouverte :

| Route                      | Ce qui la garde                                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `/api/auth/[...nextauth]`  | Auth.js. Sessions en base, révocables immédiatement.                                                                         |
| `/api/public/informations` | Statique, aucune donnée personnelle : offre et territoire.                                                                   |
| `/api/taches`              | `CRON_SECRET` en `Authorization: Bearer`. **Refuse si le secret manque** — un oubli qui ouvre un déclencheur ne se voit pas. |
| `/api/webhooks/stripe`     | Signature Stripe vérifiée, idempotence par insertion-verrou.                                                                 |

Les formulaires ouverts à tout le monde passent par `src/lib/securite/limitation.ts` :
compteur en base — un déploiement sans serveur n'a pas de mémoire partagée —
et IP condensée avec `AUTH_SECRET`, jamais stockée en clair.

## Stockage objet : Scaleway, bucket privé

`STOCKAGE_PROVIDER="scaleway"` (`src/lib/stockage/s3.ts`). Object Storage
compatible S3, hébergé en France : les pièces d'identité ne quittent pas
l'Union européenne, ce qui évite d'avoir à documenter un transfert.

**Rien n'est jamais servi en direct.** Le bucket est privé et le reste ; une
lecture passe par une URL signée de soixante secondes, engendrée à la demande
et jamais mise en cache — une URL signée mise en cache est une URL publique à
retardement.

Deux coffres, séparés par la politique (`src/lib/stockage/politique.ts`) :
`missions/` pour les photos, `kyc/` pour les pièces. Le type est reconnu par
les octets et non par le nom, et les métadonnées sont retirées au dépôt : sans
cela, une photo de salon arriverait avec les coordonnées GPS du domicile d'un
client.

### À faire côté Scaleway

- [ ] Bucket **privé**, sans visibilité publique ni site web statique activé.
- [ ] Clé d'API **restreinte à ce seul bucket**, en lecture-écriture, et à
      aucun autre service du projet.
- [ ] Politique de cycle de vie sur `missions/` : les photos suivent la
      rétention de treize mois de `src/lib/rgpd/retention.ts`. Une purge en base
      qui laisserait les fichiers ferait mentir la promesse d'effacement.
- [ ] Versionnement **désactivé** sur `kyc/` : une version antérieure d'une
      pièce d'identité survivrait à sa suppression, ce que le droit à
      l'effacement interdit.

## Ce qui n'est pas encore fait

- Le chiffrement au repos côté Scaleway (SSE-C) n'est pas activé : le
  chiffrement par défaut du fournisseur s'applique. Les données les plus
  sensibles — codes d'accès au domicile — ne sont pas dans le stockage objet
  mais en base, chiffrées en AES-256-GCM par `src/lib/logement/chiffrement.ts`,
  avec une fenêtre de lecture J-24 h → J+2 h.
- Aucune rotation automatique des secrets. Elle se fait à la main, et
  `AUTH_SECRET` ne peut pas tourner sans invalider les sessions en cours.
