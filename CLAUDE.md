@AGENTS.md

# LéoClean — guide du dépôt

Plateforme de ménage à domicile hyperlocale couvrant 16 communes du sud de
Bordeaux (Gironde) : les 13 de la Communauté de communes de Montesquieu, plus
Gradignan, Villenave-d'Ornon et Cestas.

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

| Sujet                   | Décision                                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tarification            | Taux horaire × durée estimée depuis la surface, ajustable par le client. Pas de forfait.                                                                 |
| Attribution             | 100 % automatique. Le client réserve un créneau, la plateforme choisit l'intervenant.                                                                    |
| Multi-tenant            | `Organization` sur toutes les tables métier dès la phase 1, scoping imposé par le data layer.                                                            |
| Mode société            | Schéma multi-tenant + page publique `/pro/[slug]` dans le MVP. Back-office société repoussé.                                                             |
| Positionnement          | « Sud Bordeaux » : 16 communes, dont les 13 de la Communauté de communes de Montesquieu. Même grille tarifaire partout.                                  |
| SEO                     | Remonté en phase 4, avant le moteur de réservation : l'indexation d'un domaine neuf prend 4 à 12 semaines.                                               |
| Statut des intervenants | Auto-entrepreneurs. La marketplace opère en `MISE_EN_RELATION`, les sociétés en `PRESTATAIRE`. Le mode `MANDATAIRE` (CESU) est modélisé, non implémenté. |
| Crédit d'impôt          | Toujours calculé et stocké. Affiché seulement si `NEXT_PUBLIC_SAP_DECLARED=true`.                                                                        |

## Modèle juridique et facturation

Relevé des CGU LéoClean rédigées par le porteur du projet, et confirmé par le
fonctionnement observé chez Wecasa.

**La plateforme est un opérateur de mise en relation, pas un prestataire.**
LéoClean n'est pas chargée de la réalisation des prestations. L'intervenant
vend la sienne pour son propre compte.

**Une prestation produit deux factures**, émises par deux entités distinctes :
celle de l'intervenant pour le ménage, celle de LéoClean pour sa coordination.
Leur somme est le prix annoncé au client, et chacune ouvre droit au crédit
d'impôt pour sa part. Trois raisons, toutes structurantes :

- cela évite à la plateforme de devenir prestataire au sens de l'article
  L7232-6, avec la responsabilité de la prestation et le risque de
  requalification de la relation en contrat de travail ;
- cela rend la marge de coordination elle-même éligible au crédit d'impôt, à
  condition que la plateforme soit déclarée SAP pour cette activité ;
- cela évite de gonfler le chiffre d'affaires de l'intervenant : à 29 € payés
  par le client dont 18 € pour lui, il atteint le plafond de la micro-entreprise
  un tiers plus tard que si la totalité transitait par sa facture.

L'avance immédiate impose de toute façon ce découpage : elle fonctionne par
demande de paiement déposée par chaque organisme déclaré, avec son SIRET.

**La rémunération de l'intervenant est un montant proposé qu'il accepte avant
de prendre la mission**, pas un pourcentage appliqué après coup. D'où
`professionalAmountCents` en base ; `commissionRateBp` n'est que le taux
effectif, conservé pour l'audit.

**Côté Stripe**, cela exclut le _destination charge_ avec commission prélevée :
il faut des _separate charges and transfers_, un paiement client se répartissant
entre deux bénéficiaires.

### Grille retenue

Elle vit en base (`PricingRule`) et non en dur. Wecasa affiche 28,90 €/h en
régulier et 32,90 €/h en ponctuel, minimum 2 h, sans frais d'abonnement : la
parité est délibérée, l'avantage de LéoClean n'étant pas le prix mais la
proximité.

- Tarifs : **29 €/h en régulier, 33 €/h en ponctuel**, minimum 2 h, estimation
  à 25 m²/h, +30 min par option.
- Marge de coordination : **38 %** — 29 € payés, 18 € pour l'intervenant, 11 €
  de coordination, conformément à l'exemple des CGU.
- Barème d'annulation des CGU, à six paliers plafonnés : gratuit au-delà de
  24 h, 5 € entre 8 et 24 h, 10 € entre 4 et 8 h, 50 % (max 20 €) entre 2 et
  4 h, 80 % (max 30 €) en deçà de 2 h, 100 % (max 40 €) en cas d'absence.
- Paiement : **préautorisation à H-24, prélèvement à H+24**. Ce n'est pas une
  empreinte prise à la réservation : une autorisation Stripe expire au bout de
  sept jours, ce qui la rendrait caduque sur toute réservation prise à
  l'avance. La préautorisation est donc un travail planifié.
- Reversement aux intervenants : hebdomadaire, avec huit jours de décalage.
- Assurance : Hiscox, indemnisation plafonnée à 1 000 €, franchise 200 €,
  vétusté de 10 % par an dans la limite de 50 %.

## Structure juridique

LéoClean est exploitée par **PAPER PLANE**, SASU immatriculée le 8 avril 2021,
SIREN 898 228 705, siège 2 ter rue Camille Desmoulins à Léognan (33850),
président Paul Duchateau. Le siège se trouvant déjà dans la commune annoncée,
la NAP est cohérente et l'antériorité locale réelle.

**Réserve à lever avant toute communication sur le crédit d'impôt.** Le code
APE de la société est 70.22Z, « conseil pour les affaires et autres conseils de
gestion ». Or la déclaration Services à la personne est soumise à une
**condition d'activité exclusive** : un organisme déclaré ne peut en principe
exercer que des activités de services à la personne. Exploiter LéoClean depuis
une société de conseil compromettrait donc la déclaration — et avec elle le
crédit d'impôt, qui est le premier argument de conversion face à Wecasa. Deux
issues possibles, à trancher avec la DDETS ou un conseil : créer une structure
dédiée, ou vérifier qu'une dérogation s'applique.

`NEXT_PUBLIC_SAP_DECLARED` reste donc à `false`, et rien n'est affiché sur
l'avantage fiscal.

## Canaux de conversion

Quatre portes. Le formulaire de rappel (`/etre-rappele`, également intégré à
chaque page commune avec la commune pré-sélectionnée) est le seul point de
conversion autonome tant que le tunnel de réservation n'est pas ouvert. Les
trois autres sont directes, par ordre d'engagement décroissant : téléphone,
WhatsApp, email.

Le formulaire accepte les numéros tels que les gens les écrivent —
`+33 6.84.36.38.62` comme `06 84 36 38 62` — parce que refuser une forme
valide ferait perdre une demande pour une raison incompréhensible. La
protection anti-robot repose sur un champ piège et un délai minimal de trois
secondes, sans service tiers ni captcha : un envoi automatisé reçoit la même
confirmation qu'un envoi légitime, sans être enregistré, pour ne rien apprendre
au robot.

L'organisation de rattachement est résolue côté serveur et jamais transmise par
le navigateur : une valeur envoyée par le client ne doit pas déterminer dans
quelle organisation une donnée atterrit.
Le lien `wa.me` n'exige **aucune application Meta** — il ouvre une conversation
dans WhatsApp Business gratuitement ; une app n'est nécessaire que pour l'API,
donc pour automatiser des réponses.

La page Facebook existe mais son URL exacte reste à fournir : elle alimentera
le champ `sameAs` du JSON-LD, l'un des signaux de cohérence les plus directs du
référencement local.

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

## Authentification et autorisation

Connexion sans mot de passe : lien envoyé par email, ou Google. Sessions en
base plutôt qu'en jeton signé, afin de pouvoir être révoquées immédiatement
— suspension d'un intervenant, suppression de compte au titre du RGPD.

**Les rôles ne sont pas hiérarchisés sur une échelle unique.** Un intervenant
n'est pas « plus » qu'un client. On raisonne en capacités explicites
(`src/lib/auth/permissions.ts`) et chaque rôle reçoit exactement les siennes.
Conséquence voulue : aucun rôle de gestion ne détient `availability:manage:own`
— personne ne peut imposer un créneau à un indépendant, et le produit ne crée
donc pas de lien de subordination.

**La session ne fait jamais autorité.** Elle transporte les appartenances pour
l'affichage, mais `requireOrganization()` relit l'appartenance en base à chaque
appel : une session émise avant une suspension ne donne plus accès à rien. Elle
renvoie un client Prisma déjà cloisonné, si bien que l'appelant n'a plus
l'occasion d'interroger une autre organisation.

`asPlatformAdmin().scopeTo(orgId, motif)` est **le seul** chemin franchissant la
frontière d'une organisation. Il est volontairement verbeux et journalise
chaque accès de façon nominative et motivée.

**`src/proxy.ts` ne fait pas d'autorisation** — en Next 16, `middleware.ts` est
d'ailleurs renommé `proxy.ts`. Il constate l'absence de cookie et évite un
aller-retour ; il ne sait pas si le cookie est valide ni à qui il appartient.
La vraie vérification a lieu au contact des données.

Toute mutation passe par les constructeurs de `src/lib/actions.ts`, qui
valident avec Zod puis vérifient l'autorisation avant d'exécuter quoi que ce
soit. `src/lib/action-result.ts` en isole la partie pure — forme du résultat et
traduction des erreurs — pour rester testable sans Auth.js.

Sans `RESEND_API_KEY`, les liens de connexion sont écrits dans la console : le
parcours complet est praticable en développement sans service externe.

## Tarification

`src/lib/pricing/` est pur : pas de base, pas d'horloge, pas de session. Il
produit ce que le client paie, ce que l'intervenant perçoit et la base du
crédit d'impôt — d'où une couverture de tests exhaustive.

**Une répartition additionne toujours exactement au total.** On ne calcule
jamais deux parts indépendamment en espérant qu'elles retombent juste : on
calcule l'une et on déduit l'autre. Un test le vérifie sur des milliers de
combinaisons montant/taux.

**Le crédit d'impôt est calculé facture par facture, pas sur le total.** Chaque
organisme déclaré émet sa propre attestation fiscale sur son propre montant.
Conséquence assumée : quand les deux arrondis tombent du même côté, le crédit
dépasse d'un centime celui qu'un calcul global aurait donné. L'écart profite au
client, et vaut mieux que des attestations dont la somme ne retombe pas juste.

**La durée est arrondie au pas de trente minutes supérieur**, jamais au plus
proche : mieux vaut trente minutes de trop que de mettre l'intervenant en
retard sur la mission suivante, ce qui pénaliserait toute sa tournée. Une
intervention est plafonnée à six heures — au-delà, il faut proposer deux
passages plutôt que vendre une mission intenable.

**Les options allongent la durée plutôt que le taux horaire.** Le temps est
facturé une seule fois ; un supplément forfaitaire reste possible pour les
options qui coûtent en fournitures.

Le seed passe par ce moteur au lieu de refaire le calcul : le jeu de données ne
peut donc pas diverger des règles du produit.

## Site public

Toutes les pages publiques sont prérendues, avec revalidation quotidienne :
l'acquisition passe par le référencement, ce qui fait de la vitesse une
contrainte produit et non une optimisation tardive.

**Une page par commune ne vaut que si elle dit ce que les autres ne disent
pas.** `src/lib/communes-content.ts` porte le contenu éditorial, avec une règle
de rédaction : rien de ce qui s'y trouve ne doit pouvoir être écrit pour une
autre commune. `src/lib/communes-content.test.ts` en fait une contrainte
exécutable — aucune phrase en double, chaque intro nomme sa commune, et les
superlatifs de distance n'appartiennent qu'à la commune qui les mérite. Un test
de bout en bout vérifie en plus que titres, descriptions et corps de page
diffèrent réellement.

**Les seize communes sont publiées.**

**Les temps de trajet sont mesurés de mairie à mairie**, par calcul
d'itinéraire routier depuis Léognan. Le premier jeu visait le *centroïde* de
chaque commune, ce qui produit des valeurs fausses sur les communes
forestières : le centroïde de Cestas tombe en pleine pinède, à 24 minutes de
route, alors que Cestas-Bourg est à 11. Le bourg est aussi ce qu'un client
comprend quand il demande « vous êtes à combien de chez moi ». Le test qui
compare distance routière et distance orthodromique rattraperait une rechute.

**Les intentions secondaires sont un déploiement volontairement restreint.**
`src/lib/intentions.ts` porte `/femme-de-menage/<commune>` et
`/repassage/<commune>` : six communes chacune, et pas les mêmes. « Femme de
ménage à X » ne cherche pas une prestation à acheter mais à comprendre qui
emploie qui ; le repassage est une autre prestation, avec ses propres unités.
Multiplier seize communes par deux intentions donnerait trente-deux pages dont
la plupart n'auraient rien à dire — un test borne le nombre de communes par
intention et exige que les deux ensembles diffèrent.

**Le blog répond aux intentions sans nom de ville.** `src/lib/blog.ts` :
articles en blocs typés, jamais en HTML — rien de ce qui est rédigé ne peut
produire une balise. Aucun prix n'y est écrit en dur, tout est dérivé de la
grille publique, et un test refuse tout montant présenté comme un tarif horaire
qui n'en viendrait pas. Toute règle de droit est citée avec son texte.

**L'article sur le crédit d'impôt existe mais n'est pas publié.** Son drapeau
`requiresSapDeclaration` le retire du site, du sitemap, de `llms.txt` et de
`generateStaticParams` tant que `NEXT_PUBLIC_SAP_DECLARED` est faux ; son URL
renvoie 404. Communiquer sur l'avantage fiscal avant la déclaration SAP
reviendrait à promettre un droit que les prestations n'ouvrent pas encore.

**Le cadre narratif est « le sud de Bordeaux »**, pas l'intercommunalité :
Gradignan, Villenave-d'Ornon et Cestas n'appartiennent pas à la Communauté de
communes de Montesquieu. Celle-ci reste nommée — c'est une entité que les
moteurs connaissent — mais elle ne peut plus servir à décrire la zone entière.
Le champ `inMontesquieu` porte la distinction et un test l'impose.

**`src/lib/pricing/public-grid.ts` est la source unique des prix affichés.**
Les pages publiques ne lisent pas la base : un tarif marketing n'a pas à
dépendre d'une connexion. `PricingRule` reste la source opérationnelle, propre
à chaque organisation ; le seed importe la même grille pour que les deux ne
divergent pas.

**Le JSON-LD n'invente rien.** Les champs inconnus sont omis plutôt que remplis.
La note agrégée n'est émise que s'il existe des avis réels — la déclarer à vide
est un motif de sanction manuelle. Le balisage est échappé à la sérialisation :
un avis contenant `</script>` refermerait la balise.

**Les robots des modèles de langage sont explicitement autorisés.** Être cité
en réponse à « qui fait du ménage à Léognan ? » vaut davantage qu'un contenu
verrouillé que personne ne reprend.

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
    territory.ts       les 16 communes (INSEE, CP, population, centroïde)
    communes-content.ts contenu éditorial des 16 pages locales
    intentions.ts      /femme-de-menage et /repassage, par commune
    blog.ts            articles de conseil, en blocs typés
    time.ts            conversions Europe/Paris <-> UTC
    actions.ts         constructeurs de server actions (validation + autorisation)
    action-result.ts   forme du résultat et traduction des erreurs (pur)
    auth/
      config.ts        configuration Auth.js
      permissions.ts   capacités par rôle
      session.ts       vérifications d'accès côté serveur
  proxy.ts             redirection optimiste (ex-middleware.ts)
    catalogue.ts       lecture du catalogue et devis, sur client cloisonné
    pricing/           moteur de tarification, pur et testé
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

Le design system LéoClean fait foi. Ses tokens vivent dans
`src/styles/tokens/` et sont **importés tels quels**, jamais recopiés : une
valeur dupliquée finit toujours par diverger.

`globals.css` câble ensuite les variables sémantiques de shadcn/ui dessus —
`--primary` sur `--action-primary-bg`, `--background` sur `--surface-page`, et
ainsi de suite. Aucun composant ne connaît la marque, ce qui permet de changer
l'identité en un seul fichier. **Ne jamais écrire de couleur en dur.**

Palettes : **vert Léo** (leaf) pour la fraîcheur et l'éco-responsabilité,
**terre** (clay) pour la chaleur humaine, **lin et encre** en neutres chauds,
**ciel** (sky) pour les accents de données. Titres en **Epilogue**, texte en
**Figtree**, chargés par `next/font` plutôt que par l'`@import` Google Fonts du
système, qui bloquerait le rendu.

Le thème sombre n'est pas défini par le système : celui du projet en est une
dérivation, à revoir si le système en fournit un.

**Ton éditorial**, repris du système : vouvoiement du client, « nous » pour ce
que l'entreprise organise, intervenants nommés par prénom. Phrases courtes, une
idée par phrase, titres de 3 à 7 mots. Capitale de phrase uniquement — les
capitales complètes sont réservées aux surtitres, avec la classe `.overline`.
Typographie française : espace insécable avant les unités et la ponctuation
double.

### Divergences avec le système, à arbitrer

Le document du design system décrit un périmètre et des tarifs qui ne
correspondent pas aux décisions prises depuis :

- il cite « Talence, Bègles, Villenave-d'Ornon, Gradignan, Cadaujac » quand la
  zone retenue est de 16 communes sans Talence ni Bègles ;
- il emploie « 23 € / h » dans ses exemples de ton, quand la grille est à
  29 €/h ;
- il décrit LéoClean comme déclarant à l'Urssaf pour le client, ce qui suppose
  la déclaration SAP, non encore obtenue.

Ce sont des exemples de rédaction, pas des tokens : le code suit les décisions
du projet. À reprendre dans le document si le système doit rester la
référence.

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
- [x] **Phase 2 — Auth.js, rôles et appartenance.** Lien magique et Google,
      sessions en base, capacités explicites par rôle, cloisonnement vérifié à
      chaque appel, enveloppe de server action, journalisation des accès
      transverses.
- [x] **Phase 3 — Catalogue et tarification.** Moteur pur surface → durée →
      deux factures → crédit d'impôt → reste à charge, barème d'annulation à
      six paliers, catalogue cloisonné avec tarifs historisés.
- [x] **Phase 4 — Site public, SEO local et GEO/AEO.** Les 16 communes
      publiées, 12 pages d'intention secondaire (`/femme-de-menage/<commune>`,
      `/repassage/<commune>`), 5 articles de conseil dont un retenu jusqu'à la
      déclaration SAP, JSON-LD complet (dont `Article`),
      robots/sitemap/llms.txt, API publique, pages tarifs et à propos,
      formulaire de rappel, système de design appliqué. 49 pages prérendues.
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

- Numéro de déclaration SAP, pour LéoClean **et** pour chaque intervenant :
  la facturation en deux lignes suppose deux organismes déclarés. C'est le
  seul champ qui bloque encore du contenu écrit — l'article sur le crédit
  d'impôt est prêt et attend la déclaration pour être publié.
- Code APE : 70.22Z (conseil) contre la condition d'activité exclusive des
  services à la personne. Arbitrage non tranché.
- Le nom de la page Facebook est « Léo Clean - Ménage à domicile », en deux
  mots, quand la marque s'écrit « LéoClean ». À aligner avant toute campagne :
  la cohérence du nom entre site, Facebook et Google Business Profile est un
  signal de classement local direct.
- Les CGU emploient `bonjour@leoclean.com` : à reprendre, le domaine retenu
  est **leoclean.fr**
- L'accord de coresponsabilité de traitement nomme encore Wecasa et
  `bonjour@wecasa.fr` : à reprendre avant toute publication
- Accès : base Neon ou Supabase, projet Google Cloud, Stripe, Resend, Inngest, nom de domaine
