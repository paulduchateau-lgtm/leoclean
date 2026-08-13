@AGENTS.md

# LéoClean — guide du dépôt

Plateforme de ménage à domicile hyperlocale couvrant Léognan et les
13 communes de la Communauté de communes de Montesquieu (Gironde).

Ce fichier est la référence des conventions et des décisions. Il est tenu à
jour à chaque fin de phase. En cas de contradiction entre ce document et le
code, c'est le document qu'il faut corriger — ou le code, mais jamais laisser
les deux diverger en silence.

## Où vit le projet

LéoClean occupe le sous-dossier `leoclean/` d'un dépôt qui héberge par
ailleurs une application sans rapport (`famille`, un tableau de bord
financier). Les deux applications sont indépendantes : dépendances, base de
données et déploiement séparés. `turbopack.root` est ancré sur ce dossier dans
`next.config.ts`, sans quoi Next.js remonte au lockfile parent et compile les
fichiers du voisin.

## Décisions structurantes

Prises avec le porteur du projet, à ne pas rouvrir sans discussion.

| Sujet                   | Décision                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| Tarification            | Taux horaire × durée estimée depuis la surface, ajustable par le client. Pas de forfait.                   |
| Attribution             | 100 % automatique. Le client réserve un créneau, la plateforme choisit l'intervenant.                      |
| Multi-tenant            | `Organization` sur toutes les tables métier dès la phase 1, scoping imposé par le data layer.              |
| Mode société            | Schéma multi-tenant + page publique `/pro/[slug]` dans le MVP. Back-office société repoussé.               |
| SEO                     | Remonté en phase 4, avant le moteur de réservation : l'indexation d'un domaine neuf prend 4 à 12 semaines. |
| Statut des intervenants | Auto-entrepreneurs (`PRESTATAIRE`). Le mode `MANDATAIRE` (CESU) est modélisé mais non implémenté.          |
| Crédit d'impôt          | Toujours calculé et stocké. Affiché seulement si `NEXT_PUBLIC_SAP_DECLARED=true`.                          |

### Valeurs par défaut à confirmer

Elles vivent en base (`PricingRule`) et non en dur, mais alimentent le seed et
les contenus : 32 €/h TTC ponctuel, 29 €/h mensuel ou quinzaine, 27 €/h
hebdomadaire ; durée estimée à 25 m²/h, minimum 2 h ; +30 min par option ;
commission plateforme 25 % ; annulation gratuite jusqu'à H-24 puis 50 % retenus.

## Conventions

**Langue.** Le domaine est français : identifiants métier, contenus, messages
d'erreur et commentaires en français. Les termes techniques restent en anglais
(`Booking`, `Assignment`, `slug`).

**Temps.** La base stocke exclusivement en UTC. `Europe/Paris` n'existe qu'à
l'affichage. Les tests s'exécutent en UTC (`vitest.setup.ts`) : un test qui ne
passe qu'en heure française masque précisément les bugs recherchés.

**Argent.** Montants en centimes, entiers, jamais en flottants. Tout montant
exposé au client se décompose en `grossAmount` / `taxCreditAmount` /
`netAmount`, y compris avant l'obtention de la déclaration SAP.

**Validation.** Zod à chaque frontière : variables d'environnement
(`src/lib/env.ts`), entrées de server action, réponses des API externes
(BAN, Google Calendar, OSRM). Une donnée venue de l'extérieur n'est jamais
typée par assertion.

**Mutations.** Server Actions. Les Route Handlers sont réservés aux webhooks
(Stripe, Google Calendar push, Microsoft Graph) et aux endpoints publics
documentés.

**Erreurs.** Aucun `catch` silencieux. Un `catch` journalise ou remonte ; s'il
avale volontairement une erreur, un commentaire dit pourquoi.

**Autorisation.** Chaque server action vérifie l'appartenance à l'organisation
avant toute lecture. Le scoping est imposé au niveau du data layer, pas laissé
à la discipline de l'appelant.

## Accès aux données

On n'écrit jamais `where: { organizationId }` à la main : on obtient un client
déjà cloisonné par `forOrganization(id)` (`src/lib/db.ts`) et toute requête
qu'il émet est filtrée. La liste des modèles concernés est dérivée du DMMF —
tout modèle portant un `organizationId` est protégé — et `db.test.ts` échoue si
un modèle échappe au périmètre sans justification écrite dans `GLOBAL_MODELS`.

Trois limites, documentées plutôt que masquées :

- **Les types d'entrée de Prisma ne peuvent pas être modifiés par une
  extension.** `organizationId` reste donc exigé à la création. La valeur
  écrite n'a aucune importance : l'extension l'écrase, y compris si l'appelant
  fournit celle d'une autre organisation — un test le prouve.
- **Les écritures imbriquées** (`create: { items: { create: [...] } }`) ne sont
  pas réécrites. Ce n'est pas une faille : la colonne est NOT NULL, donc
  l'oubli échoue bruyamment.
- **`$queryRaw` contourne l'extension** par construction. Toute requête brute
  sur une table cloisonnée doit porter son propre filtre.

Le client non cloisonné `prisma` est réservé à l'authentification, à
l'administration plateforme sur un chemin explicite, et aux scripts.

## Base de données

PostgreSQL 15+ avec **PostGIS** et **btree_gist**. Deux garanties vivent en SQL
parce qu'aucun contrôle applicatif n'y résiste :

- `Address.geog` est une **colonne générée** dérivée de `lat`/`lng` : elle ne
  peut pas diverger, et porte l'index GIST des requêtes de proximité.
- `Assignment_no_overlap` est une **contrainte d'exclusion** qui interdit à un
  intervenant deux missions qui se chevauchent. Elle porte sur
  `blockStartAt`/`blockEndAt`, c'est-à-dire créneau **plus temps de trajet** :
  deux ménages jointifs à quinze kilomètres l'un de l'autre sont refusés par la
  base. Les statuts terminaux sont hors du filtre, sinon l'historique gèlerait
  le planning.

On emploie `tsrange` et non `tstzrange` dans cette contrainte : Prisma projette
`DateTime` sur `timestamp without time zone` et y écrit de l'UTC ; une
conversion vers `timestamptz` dépendrait du paramètre de session et serait
refusée dans une expression d'index.

Les tests d'intégration exigent une base dont le nom se termine par `_test` —
ils tronquent des tables.

## Structure

```
src/
  app/                 routes App Router
  components/ui/       shadcn/ui, non modifiés sauf nécessité
  components/          composants métier
  lib/
    db.ts              client Prisma et cloisonnement multi-tenant
    env.ts             variables d'environnement validées par Zod
    site.ts            NAP et identité publique — source unique
    territory.ts       les 13 communes (INSEE, CP, population, centroïde)
    time.ts            conversions Europe/Paris <-> UTC
    scheduling/        moteur de disponibilité et de trajets (phase 5)
prisma/
  schema.prisma        31 modèles, tous cloisonnés sauf exception justifiée
  migrations/          migrations versionnées, SQL PostGIS écrit à la main
  seed.ts              3 organisations, 12 intervenants, 60 réservations
  fixtures/streets.ts  156 voies réelles issues de la Base Adresse Nationale
test/                  amorçage des tests d'intégration
e2e/                   Playwright
```

`src/lib/territory.ts` est une constante du projet. Ses données proviennent de
`geo.api.gouv.fr` et alimentent le contrôle de couverture, le géocodage, les
pages SEO et `llms.txt` : elles doivent rester exactes.

`src/lib/site.ts` porte la NAP. Sa cohérence avec Google Business Profile et
les annuaires est un facteur de classement local direct : aucune de ces valeurs
ne doit être ressaisie en dur dans une page.

## Design

Vert des Graves en primaire, terre cuite en accent, fond crème plutôt que
blanc, arrondis à 0.875rem. Titres en Fraunces (serif humaniste), interface en
Inter. On fait entrer quelqu'un chez soi : le registre est local et chaleureux,
jamais corporate ni clinique. Mobile d'abord — c'est là que se prennent les
réservations.

Les tokens sont définis dans `src/app/globals.css`. Ne pas écrire de couleur en
dur dans un composant.

## Commandes

```bash
npm run dev          # serveur de développement
npm run check        # typecheck + lint + tests unitaires
npm run test         # Vitest
npm run e2e          # Playwright (construit et démarre l'app)
npm run format       # Prettier

npm run db:migrate      # applique une nouvelle migration
npm run db:seed         # remplit la base de développement
npm run test:integration # tests exigeant PostgreSQL + PostGIS
```

`npm run typecheck` lance `next typegen` au préalable : les types de routes
(`LayoutProps`, `PageProps`) sont générés et absents d'un dépôt fraîchement
cloné.

## Avancement

- [x] **Phase 0 — Fondations.** Next 16, TypeScript strict, Tailwind 4 +
      shadcn/ui, identité visuelle, validation Zod de l'environnement,
      référentiel des 13 communes, Vitest, Playwright, CI.
- [x] **Phase 1 — Schéma multi-tenant.** 31 modèles Prisma, PostGIS, verrou
      anti-double-réservation en base, extension de cloisonnement, seed
      réaliste, 24 tests d'intégration.
- [ ] Phase 2 — Auth.js, rôles et appartenance
- [ ] Phase 3 — Catalogue et tarification
- [ ] Phase 4 — Site public, SEO local et GEO/AEO
- [ ] Phase 5 — Moteur de disponibilité
- [ ] Phase 6 — Tunnel de réservation
- [ ] Phase 7 — Paiement Stripe
- [ ] Phase 8 — Espace intervenant _(mise en production visée ici)_
- [ ] Phase 9 — Synchronisation d'agenda externe
- [ ] Phase 10 — Optimisation des temps de trajet
- [ ] Phase 11 — Page `/pro/[slug]`
- [ ] Phase 12 — Back-office plateforme
- [ ] Phase 13 — Durcissement et conformité

## En attente d'informations

Bloquant à terme, pas immédiatement. Les champs concernés valent `null` dans
`src/lib/site.ts` et sont masqués à l'affichage plutôt que remplis d'un
espace réservé : une NAP incomplète est neutre, une NAP inexacte est pénalisée.

- Raison sociale, SIRET, adresse du siège, date de création, fondateur
- Numéro de téléphone local
- Numéro de déclaration SAP (conditionne toute communication sur le crédit d'impôt)
- Accès : base Neon ou Supabase, projet Google Cloud, Stripe, Resend, Inngest, nom de domaine
