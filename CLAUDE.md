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

## Structure

```
src/
  app/                 routes App Router
  components/ui/       shadcn/ui, non modifiés sauf nécessité
  components/          composants métier
  lib/
    env.ts             variables d'environnement validées par Zod
    site.ts            NAP et identité publique — source unique
    territory.ts       les 13 communes (INSEE, CP, population, centroïde)
    scheduling/        moteur de disponibilité et de trajets (phase 5)
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
```

`npm run typecheck` lance `next typegen` au préalable : les types de routes
(`LayoutProps`, `PageProps`) sont générés et absents d'un dépôt fraîchement
cloné.

## Avancement

- [x] **Phase 0 — Fondations.** Next 16, TypeScript strict, Tailwind 4 +
      shadcn/ui, identité visuelle, validation Zod de l'environnement,
      référentiel des 13 communes, Vitest, Playwright, CI.
- [ ] Phase 1 — Schéma multi-tenant (Prisma + PostGIS, seed)
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
