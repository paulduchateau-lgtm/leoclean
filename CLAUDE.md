@AGENTS.md

# Léo Clean — guide du dépôt

Plateforme de ménage à domicile hyperlocale couvrant 16 communes du sud de
Bordeaux (Gironde) : les 13 de la Communauté de communes de Montesquieu, plus
Gradignan, Villenave-d'Ornon et Cestas.

Ce fichier est la référence des conventions et des décisions. Il est tenu à
jour à chaque fin de phase. En cas de contradiction entre ce document et le
code, c'est le document qu'il faut corriger — ou le code, mais jamais laisser
les deux diverger en silence.

## Où vit le projet

Léo Clean occupe la racine de son propre dépôt, `paulduchateau-lgtm/leoclean`.

Il a d'abord vécu dans le sous-dossier `leoclean/` du dépôt `famille`, un
tableau de bord financier sans rapport. Les dix-neuf commits de cette période
ont été promus à la racine par `git subtree split` : l'historique est complet,
mais les chemins d'avant la promotion portent encore le préfixe `leoclean/`.
Le dossier a été retiré de `famille`, où rien ne subsiste du projet.

## Décisions structurantes

Prises avec le porteur du projet, à ne pas rouvrir sans discussion.

| Sujet                   | Décision                                                                                                                                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tarification            | Taux horaire × durée estimée depuis la surface, ajustable par le client. Pas de forfait.                                                                                                                                                                                    |
| Attribution             | **Diffusion par lots, acceptation explicite.** Le client demande un créneau ; la mission est proposée aux 5 mieux classés, et le premier qui accepte l'emporte. Sans acceptation sous 24 h, elle est élargie au secteur ; la recherche dure une semaine.                    |
| Multi-tenant            | `Organization` sur toutes les tables métier dès la phase 1, scoping imposé par le data layer.                                                                                                                                                                               |
| Promesse de récurrence  | Le tunnel vend un **tarif**, pas un abonnement : `createBooking` n'écrit pas de `Subscription`. On annonce que les passages suivants sont calés avec le client après le premier ménage, ce qui est le fonctionnement réel. À reprendre le jour où les abonnements existent. |
| Mode société            | Schéma multi-tenant + page publique `/pro/[slug]` dans le MVP. Back-office société repoussé.                                                                                                                                                                                |
| Positionnement          | « Sud Bordeaux » : 16 communes, dont les 13 de la Communauté de communes de Montesquieu. Même grille tarifaire partout.                                                                                                                                                     |
| SEO                     | Remonté en phase 4, avant le moteur de réservation : l'indexation d'un domaine neuf prend 4 à 12 semaines.                                                                                                                                                                  |
| Statut des intervenants | Auto-entrepreneurs. La marketplace opère en `MISE_EN_RELATION`, les sociétés en `PRESTATAIRE`. Le mode `MANDATAIRE` (CESU) est modélisé, non implémenté.                                                                                                                    |
| Crédit d'impôt          | Toujours calculé et stocké. Affiché seulement si `NEXT_PUBLIC_SAP_DECLARED=true`.                                                                                                                                                                                           |
| Écriture de la marque   | **« Léo Clean », en deux mots**, partout où un humain la lit. Les identifiants techniques restent en un mot et sans accent : `leoclean.fr`, `menage@leoclean.fr`, le slug `leoclean`, le dossier du projet.                                                                 |

## Modèle juridique et facturation

Relevé des CGU Léo Clean rédigées par le porteur du projet, et confirmé par le
fonctionnement observé chez Wecasa.

**La plateforme est un opérateur de mise en relation, pas un prestataire.**
Léo Clean n'est pas chargée de la réalisation des prestations. L'intervenant
vend la sienne pour son propre compte.

**Une prestation produit deux factures**, émises par deux entités distinctes :
celle de l'intervenant pour le ménage, celle de Léo Clean pour sa coordination.
Leur somme est le prix annoncé au client, et chacune ouvre droit au crédit
d'impôt pour sa part. Trois raisons, toutes structurantes :

- cela évite à la plateforme de devenir prestataire au sens de l'article
  L7232-6, avec la responsabilité de la prestation et le risque de
  requalification de la relation en contrat de travail ;
- cela rend la marge de coordination elle-même éligible au crédit d'impôt, à
  condition que la plateforme soit déclarée SAP pour cette activité ;
- cela évite de gonfler le chiffre d'affaires de l'intervenant : à 28 € payés
  par le client dont 23 € pour lui, il atteint le plafond de la micro-entreprise
  plus tard que si la totalité transitait par sa facture.

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
parité est délibérée, l'avantage de Léo Clean n'étant pas le prix mais la
proximité.

- Tarifs : **28 €/h en régulier, 30 €/h en ponctuel**, minimum 2 h, estimation
  à **100 m² pour trois heures** — soit 33 m²/h — +30 min par option. Le
  rendement était de 25 m²/h jusqu'au 21 août 2026 ; le relever raccourcit les
  durées estimées d'un quart, donc les prix, et c'est un arbitrage commercial du
  porteur du projet. La valeur est écrite `100 / 3` et non `33.3`, qui casserait
  l'aller-retour de `surfaceForDuration` — trois heures y rendraient 99 m². Les
  pages qui la citent en prose lisent `STANDARD_SQM_PER_HOUR_AFFICHE`, arrondi
  une seule fois.

  **Changer ce rendement ne suffit pas à changer ce qu'on facture**, exactement
  comme pour les tarifs : le devis serveur chiffre depuis `Service.sqmPerHour`,
  et le tunnel affiche la surface qu'il tire de la constante. Les laisser
  diverger fait afficher « 3 h, idéal pour 100 m² » et facturer quatre heures,
  sans qu'aucune erreur ne remonte. `socle.ts` lit donc la grille, et
  `npm run db:tarifs` répare les bases déjà installées.

  **Les durées citées dans le blog sont dérivées, plus recopiées.** Le
  relèvement a rendu faux d'un coup trois tableaux et deux phrases — la page
  annonçait encore 3 h 30 pour 80 m² quand le tunnel en chiffrait 2 h 30. Deux
  tests le rattrapent désormais : tout rendement présenté comme le nôtre doit
  être celui de la grille, et tout couple « surface → durée » du corpus est
  repassé dans le moteur.

- Marge de coordination : **un écart, pas un taux** — 23 €/h pour l'intervenant
  en régulier et 21 €/h en ponctuel, soit 5 € et 9 € de coordination. Une
  mission unique coûte davantage à placer : trajet non amorti, aucune tournée à
  remplir, aucune récurrence pour rentabiliser la mise en relation. Les taux
  effectifs qui en découlent — 17,9 % et 30 % — ne sont jamais saisis : ils sont
  calculés et stockés sur la réservation pour l'audit.
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

Léo Clean est exploitée par **PAPER PLANE**, SASU immatriculée le 8 avril 2021,
SIREN 898 228 705, siège 2 ter rue Camille Desmoulins à Léognan (33850),
président Paul Duchateau. Le siège se trouvant déjà dans la commune annoncée,
la NAP est cohérente et l'antériorité locale réelle.

**Réserve à lever avant toute communication sur le crédit d'impôt.** Le code
APE de la société est 70.22Z, « conseil pour les affaires et autres conseils de
gestion ». Or la déclaration Services à la personne est soumise à une
**condition d'activité exclusive** : un organisme déclaré ne peut en principe
exercer que des activités de services à la personne. Exploiter Léo Clean depuis
une société de conseil compromettrait donc la déclaration — et avec elle le
crédit d'impôt, qui est le premier argument de conversion face à Wecasa. Deux
issues possibles, à trancher avec la DDETS ou un conseil : créer une structure
dédiée, ou vérifier qu'une dérogation s'applique.

**La déclaration est déposée, elle n'est pas obtenue** (porteur du projet,
16 août 2026). C'est ce qui autorise le site à écrire « Déclaration SAP en
cours » : la mention décrit un dossier déposé et non instruit, et une
affirmation sur une situation administrative est vraie ou ne s'écrit pas. La
réserve ci-dessus n'est pas levée pour autant — la condition d'activité
exclusive gouverne l'**obtention**, et c'est elle qui décidera du passage en
`declared`.

`NEXT_PUBLIC_SAP_DECLARED` reste donc à `false` : aucun numéro, aucun montant
après réduction, rien sur l'avantage fiscal au-delà du statut du dossier. La
règle complète et son unique point de bascule vivent dans `src/lib/fiscal.ts`.

## Canaux de conversion

Cinq portes. Le **tunnel de réservation** (`/reserver`) est la principale : le
client donne son adresse, voit son prix, choisit son heure et repart avec un
rendez-vous ferme. Le formulaire de rappel (`/etre-rappele`, également intégré à
chaque page commune avec la commune pré-sélectionnée) reste pour ceux qui ne
veulent pas réserver seuls. Les trois autres sont directes, par ordre
d'engagement décroissant : téléphone, WhatsApp, email.

Le formulaire accepte les numéros tels que les gens les écrivent —
`+33 6.84.36.38.62` comme `06 84 36 38 62` — parce que refuser une forme
valide ferait perdre une demande pour une raison incompréhensible. La
protection anti-robot repose sur un champ piège et un délai minimal de trois
secondes, sans service tiers ni captcha : un envoi automatisé reçoit la même
confirmation qu'un envoi légitime, sans être enregistré, pour ne rien apprendre
au robot.

**Le champ piège et le délai n'arrêtent qu'un robot naïf**, d'où une limitation
de débit en base (`src/lib/securite/limitation.ts`) sur les formulaires ouverts
à tout le monde. Trois choix, tous conséquents : le compteur vit en base et non
en mémoire, parce qu'un déploiement sans serveur n'a pas de mémoire partagée et
qu'un compteur par instance laisse passer autant de requêtes qu'il y a
d'instances ; l'adresse IP n'est jamais stockée en clair mais condensée avec
`AUTH_SECRET`, un compteur n'ayant pas besoin de savoir qui mais combien ; la
fenêtre est fixe et non glissante, une fenêtre glissante exigeant une ligne par
requête. La purge des compteurs périmés (`purger()`) est écrite et **n'est
appelée par personne** : elle attend l'ordonnanceur.

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

**L'extension ne protège que ce qui passe par l'application, et il y a une
seconde porte.** Supabase expose PostgREST sur `/rest/v1/<Table>`, atteignable
avec la clé anonyme — publique par construction — et accorde par défaut `ALL`
aux rôles `anon` et `authenticated` sur toute table nouvellement créée du
schéma `public` : les tables engendrées par `prisma migrate` en héritent
silencieusement. Sans RLS, quiconque a la clé anonyme lit `User`, `Address`,
`Booking` — noms, téléphones, adresses de domicile, consignes d'accès, sans
qu'aucune ligne du dépôt ne s'en aperçoive.

La migration `20260820040000_verrouiller_lacces_api` pose trois verrous : RLS
activée partout **sans aucune politique**, privilèges retirés à `anon` et
`authenticated`, privilèges par défaut annulés pour les tables futures.
`FORCE ROW LEVEL SECURITY` n'est volontairement pas posée — le propriétaire
contourne la RLS, et c'est exactement ce qu'on veut : l'application se connecte
avec ce rôle et son cloisonnement est déjà assuré par l'extension. La forcer
couperait l'application sans rien ajouter contre la porte qu'on ferme.

`src/lib/acces-api.integration.test.ts` est le seul endroit où l'oubli se voit :
`prisma migrate` n'active pas la RLS sur les tables qu'il crée, et rien d'autre
ne le signalerait. Le reste — retirer `public` des schémas exposés, ne jamais
déployer de clé `service_role` — ne s'écrit pas en SQL versionné et vit dans
[docs/SECURITE-ACCES.md](docs/SECURITE-ACCES.md).

## Authentification et autorisation

Trois moyens de se connecter : lien envoyé par email, fournisseur social, et
mot de passe. Sessions en base plutôt qu'en jeton signé, afin de pouvoir être
révoquées immédiatement — suspension d'un intervenant, suppression de compte au
titre du RGPD.

**Le mot de passe s'ajoute, il ne remplace rien.** Il est facultatif, et un
compte qui n'en a pas continue de se connecter par lien : la raison d'origine
tient toujours, un mot de passe qu'on n'a pas ne peut pas fuir. Ce qu'il
apporte est de ne plus réclamer un aller-retour par la boîte mail à chaque
connexion, ce qui compte pour un intervenant qui ouvre l'application tous les
matins.

**Il ne se définit que depuis une session déjà ouverte**, donc après avoir
prouvé qu'on reçoit les emails de l'adresse. Conséquence : il n'y a **aucun
parcours « mot de passe oublié »**, et c'est délibéré — le lien magique en
tient lieu, déjà à usage unique, expirant et limité en débit. Un second
mécanisme de récupération serait une deuxième surface à sécuriser, pas un
raccourci. Changer un mot de passe existant exige l'ancien, en revanche : un
poste laissé ouvert ne doit pas permettre de verrouiller le compte de son
propriétaire.

**scrypt plutôt qu'Argon2id**, qui vient pourtant en tête des recommandations
de l'OWASP : Argon2 exige une dépendance native, et une dépendance native est
ce qui casse une construction sans serveur le jour où l'exécuteur change
d'architecture. `N = 2^15` demande 32 Mio — `2^17`, la valeur citée pour un
serveur dédié, en réclamerait 128, et quelques connexions simultanées
épuiseraient la mémoire de l'instance. Les paramètres sont **écrits dans
l'empreinte**, si bien qu'un durcissement futur n'invalide rien : les
empreintes se réencodent à la connexion suivante, seul moment où le mot de
passe en clair est disponible.

**Aucune règle de composition** — ni majuscule, ni chiffre, ni caractère
spécial. Le NIST 800-63B les décourage explicitement parce qu'elles produisent
`Motdepasse1!` et non de l'entropie. Dix caractères minimum, une liste des
mots de passe les plus courants comparée après aplatissement des substitutions
naïves (`M0td3p@sse` vaut `motdepasse`), et refus de tout ce qui contient
l'adresse ou le nom.

**Auth.js n'écrit pas de session en base pour le fournisseur `Credentials`** :
il bascule sur un jeton signé, quelle que soit la stratégie déclarée. L'accepter
donnerait deux régimes de session — révocable pour le lien, non révocable pour
le mot de passe — et ferait tomber la garantie dont dépend tout le reste.
`authConfig.jwt.encode` intercepte donc l'encodage et rend le jeton d'une vraie
ligne `Session`, créée par `auth/session-connexion.ts`. Ce montage s'appuie sur
un comportement interne, donc il casse en silence à une mise à jour : un test
d'intégration vérifie l'écriture, et un test de bout en bout vérifie qu'Auth.js
passe bien par là — le cookie doit contenir un identifiant de session, pas un
jeton à trois segments.

**Le message d'échec est unique** et ne dit jamais laquelle des deux valeurs
est fausse, ni si l'adresse existe. La durée de réponse non plus : quand le
compte est inconnu, on dérive contre une empreinte factice, sans quoi une
réponse instantanée d'un côté et soixante millisecondes de l'autre suffiraient
à énumérer les comptes. La limitation de débit vit dans `authorize` et non dans
la server action, parce que le point d'entrée réel est la route d'Auth.js,
qu'un script appelle sans passer par notre écran.

**Les fournisseurs sociaux ne sont déclarés que s'ils sont configurés**
(`auth/fournisseurs.ts`, pur et lu deux fois) : l'écran de connexion n'affiche
donc jamais un bouton menant à une erreur, et la server action valide contre la
même liste. `allowDangerousEmailAccountLinking` est activé — le nom dit un vrai
risque, mais Google, Apple et Facebook vérifient tous l'adresse avant de la
transmettre, et sans cette option quelqu'un qui a réservé par lien puis revient
par Google trouverait un compte vide.

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

**Un compte se crée sans appartenance, et les espaces doivent le supporter.**
`requireOrganization` lève quand elle manque — la bonne conception pour une
primitive de sécurité, un appelant qui oublie d'attraper une exception fermant
la porte plutôt que de l'ouvrir. Mais une page qui laisse remonter l'exception
rend une **erreur 500** là où la réponse juste tient en une phrase, et le cas
est nominal : quelqu'un qui se connecte par lien magique avant d'avoir réservé
n'a de droit nulle part. `auth/espaces.ts` traduit donc le refus en résultat,
sans rien relâcher — même vérification, et seule `ForbiddenError` est attrapée,
une panne de base devant continuer de remonter. Trois refus, trois phrases,
parce qu'ils appellent trois gestes différents.

Sur un environnement de test, cette règle rend les espaces inatteignables :
`npm run db:roles -- vous@exemple.fr --admin` accorde ce qu'il faut, et refuse
de s'exécuter en production — accorder `PLATFORM_ADMIN` ouvre la lecture de
toutes les organisations.

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

**La part calculée est celle de l'intervenant**, et la coordination est le
reste. Ce sens-là n'est pas comptable mais juridique : la rémunération est un
montant proposé et accepté avant la mission, jamais un pourcentage appliqué
après coup. `PricingRule.professionalHourlyRateCents` la porte donc, par
prestation et par fréquence — et non `Organization.commissionRateBp`, qui ne
pouvait exprimer qu'un taux unique et n'est plus lu par le devis. Le supplément
forfaitaire d'une option suit l'intervenant : il paie des fournitures, pas de la
coordination.

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
d'itinéraire routier depuis Léognan. Le premier jeu visait le _centroïde_ de
chaque commune, ce qui produit des valeurs fausses sur les communes
forestières : le centroïde de Cestas tombe en pleine pinède, à 24 minutes de
route, alors que Cestas-Bourg est à 11. Le bourg est aussi ce qu'un client
comprend quand il demande « vous êtes à combien de chez moi ». Le test qui
compare distance routière et distance orthodromique rattraperait une rechute.

**Les intentions secondaires sont un déploiement volontairement restreint.**
`src/lib/intentions.ts` porte `/femme-de-menage/<commune>` et
`/repassage/<commune>` sur **trois communes chacune, les mêmes** : Léognan, le
siège, et Gradignan et Villenave-d'Ornon, les deux plus peuplées du territoire
et les plus proches parmi elles. « Femme de ménage à X » ne cherche pas une
prestation à acheter mais à comprendre qui emploie qui ; le repassage est une
autre prestation, avec ses propres unités. Multiplier seize communes par deux
intentions donnerait trente-deux pages dont la plupart n'auraient rien à dire.

Le périmètre était de six communes par intention jusqu'au 16 août 2026 : le
relevé de duplication les donnait à 84 % identiques entre elles, parce que le
chapeau, les sections et la FAQ commune sont écrits une fois pour l'intention
et que seule une centaine de mots sur neuf cents changeait de commune en
commune. **Trois pages fortes valent mieux que six tièdes** — le recouvrement
est retombé à 62 %, sans qu'aucune paire du site ne dépasse plus 70 %. Les six
URL retirées redirigent en 301 vers leur page commune, qui traite le même lieu :
elles étaient indexables, et un 404 perdrait sèchement ce qu'elles avaient
acquis.

Un test exige désormais trois paragraphes, trois questions et **plus du tiers
de texte propre** par commune. Il interdit surtout d'ajouter une quatrième
commune à moindres frais que les trois existantes, ce qui est exactement la
pente qui avait produit l'écart. Journal complet :
[docs/AUDIT-DUPLICATION.md](docs/AUDIT-DUPLICATION.md).

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
à chaque organisation ; le socle, le seed et `facts.ts` importent la même grille
pour que rien ne diverge.

**Changer la grille ne suffit pas à changer les prix facturés.** Le socle ne
crée une règle que s'il n'en existe aucune : sur une base vivante, une
modification de `public-grid.ts` ne toucherait que le site, qui afficherait un
tarif pendant que le tunnel en chiffrerait un autre. `npm run db:tarifs` fait le
pont — il montre l'écart, puis, avec `--confirmer`, ferme les règles en vigueur
par un `validUntil` et en ouvre de nouvelles. Rien n'est écrasé : une
réservation passée continue de pointer sur le tarif qui l'a chiffrée. Seule la
marketplace est touchée, une société cliente fixant ses propres prix.

### L'accueil raconte ce qu'on n'aura plus à faire

**La promesse est qu'on s'occupe du reste.** Quelqu'un dont la maison est sale
n'achète pas un intervenant attitré : il achète de ne plus avoir à y penser.
L'accueil ouvrait auparavant sur « la seule promesse qui compte vraiment : la
même personne chez vous, à chaque passage » — arbitrage revu le 20 août 2026
avec le porteur du projet. La continuité est un **moyen**, pas la promesse :
elle reste écrite dans les engagements, à sa place de conséquence. Le titre
dit « Votre ménage à domicile, simplement », le chapeau « Des professionnels
sélectionnés près de chez vous. Léo Clean s'occupe du reste. »

**La proximité reste la thèse, elle n'est plus l'accroche.** Le périmètre est
petit exprès : une vingtaine de minutes de route est la limite qui rend
tenable « la même personne chaque semaine », et c'est un mécanisme, pas une
couverture en construction. Elle a désormais son bloc à elle — « Nous ne
venons pas de loin » — au lieu d'occuper la première phrase.

**La pastille dit le territoire, pas son décompte.** « Les pros du ménage au
sud de Bordeaux », et non plus « 16 communes au sud de Bordeaux » : un chiffre
en tête de page se lit comme une limite là où un lieu se lit comme une
adresse. Le décompte n'est pas perdu — il vit dans le paragraphe d'identité et
dans le bloc des communes, aux deux endroits où il sert de preuve.

**L'ordre des blocs** est repris du prototype à la refonte d'août
2026 : thèse (avec la réassurance sous le geste), preuves chiffrées,
paragraphe d'identité, quatre prestations, offre à deux tarifs, déroulé sur la
bande sombre — « Vous réservez. Nous nous occupons du reste. » —, comparatif
des modèles, engagements (« Ce que ça change chez
vous », fusion des anciennes promesses et du bloc de confiance), communes,
conseils lus dans `blog.ts`, questions fréquentes aux chiffres dérivés du
barème, formulaire de contact (le `LeadForm` de `/etre-rappele`, distingué par
son `sourcePath`), sortie. Le visiteur comprend _pourquoi_ avant qu'on lui
demande _où_ — l'accueil s'ouvrait auparavant sur « Où habitez-vous ? » et
seize liens, soit un effort de sélection réclamé avant le premier argument.
Les engagements précèdent les communes, seule entorse à l'ordre du prototype :
le test de la page impose qu'aucun lien commune n'apparaisse avant les
conséquences de la thèse.

**Le déroulé raconte ce que le client fait — presque rien.** Il détaillait la
mécanique interne : cinq intervenants sollicités, le premier qui accepte
l'emporte. C'est vrai, et cela reste écrit **là où cela engage** — au
récapitulatif, juste avant le geste qui réserve, et sur l'écran de
confirmation. L'accueil n'a pas à faire porter au visiteur le fonctionnement
de l'attribution. Une ligne sous la liste garde en revanche la promesse
exacte, et un test l'impose : « vous êtes prévenu sous 24 h ». Sans elle,
« vous profitez de votre maison » se lirait comme un rendez-vous acquis à la
seconde, et se découvrirait à la première réservation.

**Les seize communes n'ont pas disparu, elles ont changé de fonction.**
Placées en fin de page et groupées en deux familles, chaque pastille portant
son temps de trajet, elles ne sont plus un menu mais la preuve de la thèse.
Aucun lien interne n'est perdu et `src/app/page.test.tsx` le vérifie sur le
HTML rendu, pas sur les constantes : une donnée juste qui n'atteint pas la
page ne vaut rien.

**Un champ de code postal ouvre le bloc des communes.** Seize pastilles
répondent à qui sait déjà lire une carte ; « est-ce que vous venez chez
moi ? » se répond mieux en tapant cinq chiffres. `CouvertureCheck` est le seul
composant client de l'accueil : il reçoit le référentiel réduit à quatre
champs par commune — importer `territory.ts` embarquerait des coordonnées et
des codes INSEE dont l'écran n'a rien à faire — nomme **toutes** les communes
d'un code postal partagé (33650 en couvre sept) et ne transmet aucune commune
au tunnel, qui demande désormais l'adresse. Un refus donne le numéro plutôt
qu'un champ qui ne rend rien.

**`src/lib/facts.ts` n'est pas une source de vérité, c'est un agrégateur.** Un
bandeau de crédibilité rassemble en quatre nombres ce que quatre modules
détiennent séparément ; sans point de rassemblement ils seraient écrits en dur
dans le JSX. Chaque valeur y est dérivée — territoire, grille publique, NAP,
barème d'annulation — et **aucune métrique d'activité n'y figure**. Nombre de
clients, note moyenne, interventions réalisées : tant qu'elles n'existent pas
elles ne sont pas dans le module, donc pas affichables. Un test l'impose.

**Le maximum affiché est 21 minutes, pas 20.** Saint-Morillon est la commune
la plus éloignée. La prose garde « une vingtaine de minutes », qui reste vraie,
mais un chiffre présenté comme un maximum doit en être un : il est calculé
depuis `communes-content.ts`, jamais écrit, et un test vérifie que les deux
formulations peuvent coexister.

**Il n'y a aucun avis client, et rien ne le maquille.** Fabriquer un
témoignage est une pratique commerciale trompeuse au sens de l'article L121-2
du code de la consommation, pour un gain sans rapport avec le risque. Le bloc
d'engagements tient ce rôle : des promesses **vérifiables** — SIRET actif,
attestation de responsabilité civile, pièce d'identité et RIB contrôlés avant
la première intervention, un vrai numéro où quelqu'un décroche — ce qui est la
seule forme de confiance qu'un service neuf peut offrir honnêtement. `<Avis />`
est en place et muet, gardé par `FACTS.hasReviews` — le même drapeau que le
`aggregateRating` du JSON-LD.

**Le fondateur n'est plus nommé, ni sur la page ni dans le balisage.** Le bloc
d'engagements écrivait « Prénom Nom, <rue> à <ville> », et le JSON-LD déclarait
`founder` dans le même objet que `address` : le siège étant le domicile du
porteur du projet, cela publiait une identité associée à une adresse
d'habitation — et le balisage étant émis sur toutes les pages, partout.
Arbitrage du 20 août 2026 : la NAP garde sa place — pied de page, mentions
légales, `PostalAddress` du JSON-LD — parce que c'est celle de l'entreprise, et
`taxID` identifie déjà la structure de façon vérifiable. `SITE.founder` reste
renseigné et reste affiché sur `/a-propos`, où le nommer est l'objet de la
page. `src/app/page.test.tsx` échoue si le nom revient sur l'accueil, texte
rendu et balisage compris.

**Le comparatif oppose des modèles, jamais des sociétés.** Aucun concurrent
n'est nommé, aucun superlatif n'est employé, et chaque case défavorable à un
autre modèle doit rester défendable devant celui qui l'opère. DOM unique,
déplié par critère sur mobile plutôt que défilant horizontalement : un tableau
qu'il faut pousser du doigt n'est pas lu, et un contenu rendu deux fois est
cité de travers.

### Ce que le site a le droit de dire du crédit d'impôt

`src/lib/fiscal.ts` est le seul endroit où cette frontière est tranchée :
aucune page ne décide seule d'afficher une mention fiscale.

**Le statut n'est pas écrit, il est dérivé** de `NEXT_PUBLIC_SAP_DECLARED` et
de `SITE.sapDeclarationNumber`. Poser à côté du drapeau existant un second
interrupteur en dur créerait deux vérités concurrentes, et la question ne
serait plus « sommes-nous déclarés ? » mais « lequel des deux dit vrai ? ». Le
basculement ne coûte donc aucune ligne de code : une variable d'environnement,
et le numéro dans `site.ts`.

**Les deux sont exigés.** Un statut « déclaré » sans numéro afficherait une
mention invérifiable, ce qui est précisément ce que la mention sert à éviter.
Le drapeau seul ne bascule pas — la direction sûre est celle qui n'affirme
rien.

Tant que la déclaration n'est pas obtenue : le libellé est « Déclaration SAP
en cours », jamais « agréé », jamais de numéro ; **le prix mis en avant reste
le prix brut partout**, et aucun montant après réduction n'apparaît en accueil,
en carte de prestation, en métadonnée ni dans le tunnel. La réduction ne peut
être expliquée que dans un bloc dédié, sur la page tarifs. `<PrixAvecCreditImpot />`
porte cette règle : il rend le prix brut, et la ligne secondaire n'existe que
si `canShowTaxCredit()` l'autorise.

Vocabulaire : l'entretien de la maison relève de la **déclaration** — dépôt
d'un récépissé auprès de la DDETS — l'**agrément** étant réservé aux activités
auprès de publics fragiles. La copy dit donc « déclaration ». Formulation à
faire confirmer par un conseil avant mise en production.

### La seconde porte : `/travailler-avec-nous`

**La thèse est la même contrainte, retournée.** Le client s'entend dire
« une vingtaine de minutes de route, donc toujours la même personne » ;
l'intervenant s'entend dire « une vingtaine de minutes de route, donc une
journée remplie sans la passer en voiture ». Le premier poste de perte de
revenu d'un intervenant à domicile n'est pas le tarif horaire mais le trajet
non payé et les trous de planning : un périmètre court concentre là où une
plateforme nationale disperse. On parle donc de kilomètres, d'heures et de
délais de paiement, jamais de « rejoindre une aventure ».

**La page n'est pas indexée tant qu'elle est incomplète, mais elle est
annoncée.** `PENDING_INTERVENANT_FIELDS` suit la convention de
`PENDING_IDENTITY_FIELDS` : tant qu'il manque une valeur, la page porte
`noindex` et reste hors du sitemap et de `llms.txt`. Se classer sur « missions
ménage Gironde » sans pouvoir dire ce qu'on paie ferait venir exactement les
gens qu'on décevrait.

Le drapeau **ne gouverne plus le maillage interne**, et c'est une décision du
porteur du projet (21 août 2026) : l'en-tête, l'accueil et le pied de page
désignent « Devenir pro » sans condition. Il tenait deux choses à la fois — ce
que les moteurs ont le droit d'indexer, et ce que le site a le droit
d'annoncer — et les deux ne se décident pas de la même façon.

**Les cinq valeurs ont été arbitrées le 21 août 2026, et la page est donc
ouverte** : `PENDING_INTERVENANT_FIELDS` est vide, la pastille « à préciser »
a disparu d'elle-même, la page entre au sitemap et dans `llms.txt`, et le mot
« garanti » s'écrit — parce qu'on peut enfin dire contre quoi.

Les trois garanties, telles qu'elles ont été tranchées :

- **Retard de règlement du client** : sans effet. Le versement part sous cinq
  jours ouvrés après l'intervention, sur son propre délai.
- **Impayé** : porté par Léo Clean. La prestation a été faite, elle est due.
  Ce qui est suspendu est la **suite** — l'intervention suivante chez ce client
  est gelée tant que la situation n'est pas régularisée, l'intervenant en étant
  informé avant de partir, et le client passe en recouvrement.
- **Annulation tardive** : les frais **encaissés** se partagent moitié-moitié.
  Jamais une part du prix de la mission : le barème des CGU est plafonné, et
  annoncer un pourcentage du prix ferait attendre plus que ce qui rentre.

**Le gel est écrit depuis le 21 août 2026**, et il ne pose aucun statut.

`ClientProfile.recouvrementDepuis` porte une date, et **tout le reste s'en
dérive** : `paiement/recouvrement.ts` est pur et décide, mission par mission,
si elle est gelée. La tentation était de poser un `SUSPENDED` sur chaque
réservation à venir ; elle a été écartée parce qu'il aurait fallu parcourir les
réservations **deux fois** — au gel et au dégel — et qu'un seul oubli au dégel
laisserait gelé quelqu'un qui vient de payer, c'est-à-dire punir précisément le
client qui a régularisé. Une date qui retombe à `null` dégèle tout d'un coup,
sans parcours et sans oubli possible.

Trois arbitrages tiennent dans la fonction pure :

- **Une intervention déjà commencée ne se gèle pas.** Quelqu'un qui est chez le
  client finit son ménage et est payé pour ; retirer la mission sous ses pieds
  lui ferait porter un litige qui n'est pas le sien.
- **La date d'entrée ne bouge pas**, comme `Payment.firstFailedAt` : la
  remplacer ferait rajeunir indéfiniment une dette, alors que c'est son
  ancienneté qui décide de l'ordre d'appel.
- **Un paiement réussi ne lève pas forcément le recouvrement.** `leverLe­
Recouvrement` relit l'état complet : régler un impayé sur deux ne dégèle
  rien, sinon l'intervenant partirait sur la foi d'un message que rien ne
  justifie.

`ouvrirLeRecouvrement` consomme enfin `aSuspendre` et prévient **les
intervenants affectés** — seules les affectations `ACCEPTED`, une proposition
n'engageant personne. L'`updateMany` filtré sur `null` fait office de verrou :
l'ordonnanceur repasse toutes les heures, et personne ne doit recevoir
vingt-quatre fois le même email. Les deux messages ne disent **rien du
client** — ni montant, ni ancienneté, ni prix de la mission : ce n'est pas
l'affaire de l'intervenant, et `recap(intervention, false)` tient déjà la règle
qui lui interdit de lire le prix client.

Trois surfaces, une seule règle : l'écran de l'intervenant affiche le gel
**avant l'adresse et avant le lien vers l'écran de travail** — à 8 h du matin,
celui qui cherche où aller ne doit pas découvrir en bas de carte qu'il ne faut
pas y aller — le back-office en tient la file, du plus ancien au plus récent, et
le libellé vient du module pur pour que les deux écrans ne puissent pas se
contredire.

**Le mot « garanti » est dérivé, pas écrit.** Il n'engage à rien tant qu'on
n'a pas dit _contre quoi_ il garantit : `canSayGuaranteed()` n'est vrai que si
les trois situations — retard de paiement, impayé, annulation tardive — ont
une réponse écrite. À défaut, la page dit « net, versé à date fixe », qui est
déjà un argument et qui est vrai.

**Toute la copy du moteur de planning est en proposition.** « On vous
propose » et jamais « on vous affecte », « une suggestion de tournée » et
jamais « votre tournée », et le fait que l'ordre soit modifiable est écrit
noir sur blanc. Ce n'est pas une préférence de ton : un logiciel qui ordonne
la journée d'un indépendant est un indice de subordination s'il le subit, et
n'en est pas un s'il le pilote. Un site qui promet la liberté pendant que le
fonctionnement dit l'inverse est une pièce à charge, pas une protection. Un
test interdit le vocabulaire d'affectation sur le HTML rendu.

**Le bloc « ce qu'on lit de votre agenda » et le bloc qui demande l'accès ne
font qu'un seul composant.** Le brief exigeait qu'ils soient adjacents ; les
réunir rend la séparation impossible sans réécrire le fichier, ce qui vaut
mieux qu'un test constatant l'erreur après coup. Deux consentements distincts
— heures occupées d'un côté, lieux de l'autre — parce que les demander
ensemble reviendrait à obtenir le second sans qu'il ait été posé.

**`src/lib/features.ts` est au produit ce que `fiscal.ts` est au droit.**
Trois états par fonction : `live` sans libellé, `beta` avec « En test », et
`roadmap` avec « Disponible au lancement ». Le bloc reste visible en
`roadmap` — on ne cache pas la fonction, on dit qu'elle n'existe pas encore.
`savedTravelMinutes` vaut `null` et rien ne s'affiche : ni chiffre, ni
fourchette, ni « jusqu'à ». Aucune capture d'écran d'une interface inexistante.
`appleCalendar` est faux tant que la voie technique n'est pas tranchée, Apple
ne fournissant pas d'API serveur équivalente à celle de Google.

**Le parrainage n'est pas décidé sur cette page.** `referral/rules.ts`
existait avant elle, verrouillé par ses propres tests : 5 % du chiffre
d'affaires du filleul, à partir de sa cinquième mission, pendant douze mois,
plafonné à 150 € par mois tous filleuls confondus. `FACTS.parrainage` ne fait
que le lire. Le plafond **est annoncé** : c'est la seule limite du dispositif,
et la taire reproduirait l'opacité reprochée aux plateformes nationales. Un
seul niveau, `MAX_REFERRAL_DEPTH` à 1 — toucher sur les filleuls de ses
filleuls ferait dépendre le gain du recrutement opéré par autrui, ce qui est
la définition de la vente à la boule de neige à l'article L.121-15 du code de
la consommation.

**La commission n'est pas rétroactive**, conformément au calcul : les cinq
premières missions du filleul ouvrent le droit sans être commissionnées, et la
fenêtre de douze mois court à partir de la cinquième. La page l'écrit plutôt
que de le laisser découvrir au premier versement.

**La candidature est écrite dans `Lead`**, distinguée par son `sourcePath`.
Créer un modèle demanderait une migration que rien ne justifie tant que le
traitement d'une candidature est un coup de téléphone ; le jour où elle
devient un dossier avec des pièces et des états, elle aura sa table.

**Le JSON-LD n'invente rien.** Les champs inconnus sont omis plutôt que remplis.
La note agrégée n'est émise que s'il existe des avis réels — la déclarer à vide
est un motif de sanction manuelle. Le balisage est échappé à la sérialisation :
un avis contenant `</script>` refermerait la balise.

**Chaque page indexable porte son résumé factuel**, sous les deux noms qui
circulent — `llm-summary` et `ai:content`, dont aucun n'est normalisé. Un
modèle n'a pas de « position 1 » : il cite la phrase qui répond, ou il ne cite
rien. Le résumé porte donc le service, le lieu et le chiffre clé, et reste vrai
hors de sa page.

**Le bloc de réponses directes ouvre le contenu d'une page commune**, avant la
typologie d'habitat et les tarifs : le placer après trois sections revenait à
le cacher à ce qui devait le lire. Trois questions en `<h3>`, chaque réponse
autosuffisante. La première est **engendrée** depuis la grille publique plutôt
qu'écrite — un tarif recopié dans seize fiches finit par diverger de celui
qu'on facture, et c'est exactement l'erreur qu'un modèle propagerait — et elle
porte le temps de trajet propre à la commune, faute de quoi seize pages
porteraient le même paragraphe. Les mêmes trois questions alimentent le
`FAQPage` : un balisage qui annoncerait autre chose que la page est une
divergence sanctionnée.

**`/llms-full.txt` donne le corps des pages, `/llms.txt` leur index.** Le
premier est engendré depuis les mêmes modules que les pages : un fichier qui
divergerait produirait des citations fausses, et personne ne vient vérifier.

**Les robots des modèles de langage sont explicitement autorisés.** Être cité
en réponse à « qui fait du ménage à Léognan ? » vaut davantage qu'un contenu
verrouillé que personne ne reprend.

**Aucune page ne construit ses métadonnées de partage à la main.**
`src/lib/seo/metadata.ts` est le seul endroit où `canonical` et `og:url` sont
décidés, parce qu'ils ne peuvent pas désigner deux pages différentes. Le
gabarit racine ne porte plus d'`og:url` : une valeur héritée est la même
partout, et rattachait à l'accueil les partages de chaque page qui ne
déclarait pas son propre bloc. Attention à une règle de Next qui se paie cher :
un `openGraph` posé par une page **remplace** celui du gabarit au lieu de le
compléter — l'image du site doit donc être reposée explicitement, sauf quand la
page a sa propre carte, auquel cas une `images` écrite à la main effacerait
celle de la route.

**La carte de partage est générée, une par commune.** `src/lib/seo/og.tsx`
compose l'image dans le langage du système — surtitre en capitales, titre en
graisse 900, prix en pilule mangue sur texte encre. C'est la deuxième surface,
après `magic-link-email.tsx`, où les couleurs sont recopiées plutôt que
référencées : le moteur de rendu ne voit pas la feuille de styles. Chaque
valeur porte le nom de son token. Figtree y est versionnée en TrueType dans
`assets/fonts/`, avec sa licence — `next/font` ne sert que du woff2, que ce
moteur ne lit pas.

**Seule la production a le droit d'être indexée**, et cela se déclare plutôt
que se déduire. `NEXT_PUBLIC_ENVIRONMENT` vaut `production` ou `dev` ; hors
production, le proxy pose `X-Robots-Tag: noindex` sur tout, `robots.txt` refuse
tout, le gabarit racine émet `index: false` et un bandeau non fermable annonce
l'environnement de test — le site affiche un vrai numéro et de vrais tarifs, et
la dev est une copie conforme jusqu'à la confirmation de réservation.

La déclaration ne dépend d'aucun nom d'hôte, et c'est tout son intérêt : la
règle ci-dessous, fondée sur la comparaison des domaines, suffisait tant qu'un
environnement de test n'avait pas de domaine à lui, mais elle autorise
`dev.leoclean.fr` dès que la dev déclare cette origine comme la sienne. La
valeur par défaut reste `production`, pour la même raison qu'ailleurs : un
oubli de variable ne doit pas mettre le site entier hors de l'index.

**On n'indexe que l'hôte qu'on a déclaré.** Un déploiement Vercel répond aussi
sur son `*.vercel.app`, mot pour mot le même contenu : `src/proxy.ts` pose un
`X-Robots-Tag: noindex` sur tout hôte qui n'est ni la vitrine ni
l'application. L'en-tête plutôt que la balise, parce qu'il couvre aussi
`robots.txt`, le sitemap et les cartes, qui n'ont pas de `<head>`. La règle ne
s'applique qu'une fois `NEXT_PUBLIC_SITE_URL` configurée : sans elle, on ne
sait pas ce qui est canonique, et refuser par défaut mettrait le site entier
hors de l'index sur un oubli de variable.

**`NEXT_PUBLIC_APP_URL` ne se déclare qu'une fois le sous-domaine vivant.**
Le proxy renvoie les chemins applicatifs vers l'hôte déclaré, sans pouvoir
vérifier qu'il résout : déclarée avant que `app.leoclean.fr` existe, la variable
redirige `/reserver` en 308 vers un domaine introuvable et fait tomber le canal
de conversion principal — sans qu'aucune erreur ne remonte côté serveur, puisque
le serveur fait précisément ce qu'on lui a demandé. L'ordre est donc : créer le
sous-domaine, l'attacher au projet, vérifier qu'il répond, puis seulement
renseigner la variable. Le cas s'est produit en production.

### Trois domaines, et une connexion qui n'appartient à aucun

`leoclean.fr` porte la vitrine client, `app.leoclean.fr` ce que le client fait
une fois décidé, et **`pro.leoclean.fr` toute la face offre** — la page qui
explique le métier, le tunnel de candidature et l'espace intervenant.
`NEXT_PUBLIC_PRO_URL` la déclare, sous la même précaution que
`NEXT_PUBLIC_APP_URL` et pour la même raison. **Absente, rien ne bouge** : la
vitrine offre reste sur la vitrine, l'espace intervenant sur l'application,
exactement comme la veille. Un test l'impose, parce que c'est le repli qui
évite de rejouer la panne.

**La connexion est servie par l'hôte qui la reçoit, jamais redirigée.**
`/connexion` et `/api/auth` sont neutres. C'est ce qui rend le cloisonnement
réel : Auth.js tourne en `trustHost` et construit ses URL depuis la requête,
si bien qu'une session ouverte sur `pro.` y dépose un cookie qui **n'est pas**
envoyé à `app.` — deux faces, deux sessions, deux périmètres. L'alternative
était d'élargir le cookie à `.leoclean.fr`, c'est-à-dire de faire l'inverse de
ce que « cloisonner » veut dire. Conséquence de configuration : chez Google,
l'URI de redirection OAuth doit être enregistrée **pour chaque hôte** qui sert
une connexion.

**Un sous-domaine est un site distinct pour un moteur**, et trois pièces en
découlent, toutes vérifiées :

- **Le canonical est devenu absolu.** Il était relatif, résolu par
  `metadataBase` — juste tant qu'un seul domaine portait du contenu indexable.
  Une page servie par `pro.` déclarerait sinon un canonical sur `leoclean.fr`,
  c'est-à-dire une autre page que celle qu'on lit : la façon la plus directe de
  se désindexer soi-même. `canonicalUrl()` choisit l'origine d'après le chemin,
  et `og:url` la même.
- **Chaque hôte a son sitemap et son `robots.txt`.** Les deux routes lisent
  l'en-tête `host`, ce qui les rend dynamiques — un `sitemap.ts` est mis en
  cache par défaut. Le coût est nul : ces fichiers ne sont lus que par des
  robots. Déclarer dans le sitemap d'un domaine une URL d'un autre est ignoré
  au mieux, tenu pour une manipulation au pire.
- **La page d'offre change de sitemap, pas de statut.** Tant que la face pro
  n'a pas d'hôte, elle reste dans celui de la vitrine ; dès qu'elle en a un,
  elle passe dans le sien et disparaît de l'autre.

**Le prix à payer est connu et assumé** : `/travailler-avec-nous` vient d'être
ouverte à l'indexation et repart de zéro en autorité sur le nouveau domaine,
coupée du maillage interne de `leoclean.fr`. C'est un arbitrage du porteur du
projet (21 août 2026), pris en connaissance de l'alternative — ne cloisonner
que l'espace connecté, qui aurait laissé la vitrine offre sur le domaine
principal.

**La vitrine statique ne voit rien de tout cela** : `sitemap.ts` est écarté de
son arbre et `robots.ts` remplacé par l'overlay, si bien qu'`output: export`
ne rencontre jamais les deux routes dynamiques. C'est ce qu'il faut revérifier
au prochain passage — la règle du dépôt reste qu'une route ajoutée est une
exclusion à envisager.

**`/pro/[slug]` dit autre chose qu'une page commune.** Léo Clean opère en mise
en relation ; une société cliente du SaaS est prestataire et emploie ses propres
agents. Sa page présente donc une entreprise, ses prestations et **ses** tarifs,
qui ne sont pas ceux de la marketplace. Le catalogue est lu sur un client
cloisonné à cette organisation : c'est ce qui garantit qu'une société ne peut ni
voir ni faire voir les tarifs d'une autre, ce qui compte d'autant plus qu'elles
se font concurrence sur le même territoire. La page est prérendue par
`generateStaticParams` avec `dynamicParams` ouvert, si bien qu'une société
enregistrée après la construction est servie sans redéploiement.

## Coque applicative

Le site se consulte debout, dans la rue, à une main : c'est là que la décision
de faire venir quelqu'un chez soi se prend. Trois éléments, tous mobiles, tous
absents en desktop où la navigation de l'en-tête reste seule maîtresse.

**La barre d'onglets est posée dans le gabarit racine et décide seule où elle
n'a rien à faire.** Le critère est `isAppPath` — le même que celui qui répartit
les chemins entre les deux domaines : pendant une réservation ou dans un espace
connecté, un seul modèle de navigation à la fois. Elle réserve sa place par un
bloc en fin de flux plutôt qu'en ajoutant un remplissage à chaque `<main>` :
une barre fixée ne prend pas de place, et sans cela elle recouvrirait la
dernière ligne du pied de page, qui porte les mentions légales et le téléphone.

**La barre de rappel de prix se monte après le héros d'une page, jamais dans le
gabarit** : c'est son emplacement dans le document qui définit « la lecture a
commencé ». Elle s'efface devant tout élément portant `data-booking-cta`, parce
que deux appels à l'action à l'écran demandent de choisir lequel compte. Aucun
écouteur de défilement — deux `IntersectionObserver`, qui ne réveillent le fil
principal que sur franchissement. Elle n'est jamais démontée non plus : elle
glisse hors de l'écran, `inert`, ce qui évite un saut de mise en page à chaque
franchissement.

**Deux portes de connexion sur la vitrine, jamais trois.** L'en-tête portait
« Espace client » et « Espace cleaner » côte à côte, ce qui demandait au
visiteur de savoir de quel côté du produit il se trouve avant de pouvoir se
connecter. Le site public n'a qu'un public : **« Se connecter »** y mène
l'espace client — l'espace, et non `/connexion`, parce qu'il redirige lui-même
quand la session manque et qu'une seule adresse sert donc les deux cas — et
**« Devenir pro »** ouvre la face offre. La vitrine client ne désigne plus
l'espace intervenant, et un test de l'accueil l'interdit : on n'y entre
qu'après la page qui dit le métier.

**Cette page porte sa propre porte professionnelle.** `/travailler-avec-nous`
prend la variante `pro` de l'en-tête — le retour vers la vitrine client posé
tout en haut et en secondaire, un bouton « Espace pro » à la place de
« Réserver ». Ce bouton vise un bloc à deux entrées de même poids —
se connecter, ou créer son compte — plutôt que la connexion directement : les
deux personnes qui le pressent ne cherchent pas la même chose, l'une veut son
planning et l'autre veut savoir comment commencer, et n'en servir qu'une en
perdrait l'autre. La connexion y passe par `/connexion?callbackUrl=/intervenant`
et non par `/intervenant`, qui sait afficher son propre refus quand la session
existe sans porter le droit.

**L'aide est un panneau, pas une page.** Ajouter un écran entre la question et
la réponse quand la réponse tient en trois liens ne se justifie pas.
`ContactSheet` reprend les trois canaux de `ContactChannels` dans le même ordre
d'engagement ; les blocs de contact des pages restent où ils sont, le panneau
ne les remplace pas.

**Le tunnel écrit chaque écran dans l'historique du navigateur.** Sans cela, le
retour arrière — bouton, geste de balayage iOS, touche Retour d'Android — était
le geste le plus employé sur mobile et le seul dont l'effet était de tout
perdre. Seul le nom de l'écran y va ; l'état vit dans React, que rien ne
démonte. La flèche de l'écran passe par `history.back()` plutôt que par
`setStep`, faute de quoi l'une empilerait ce que l'autre dépile — avec un
compteur d'entrées propres, pour ne jamais faire reculer le navigateur au-delà
des nôtres et quitter le site sur un bouton qui promet le contraire.

## Moteur de disponibilité

`src/lib/scheduling/` est **pur** : aucune lecture de base, aucun appel réseau,
aucune horloge implicite. Le chargement des données vit à côté, dans
`repository.ts`, marqué `server-only`. C'est cette séparation qui permet de
tester en quelques millisecondes une nuit de changement d'heure ou une tournée
impossible de vingt minutes.

**Une seule formule, appliquée partout :**

```
disponibilité = heures déclarées + ouvertures exceptionnelles
              − absences − agenda externe − missions, tampons de trajet compris
```

Trois arbitrages sont figés et documentés dans le code :

- **Bornes `[start, end)`.** Une mission qui finit à 12 h laisse 12 h libre.
  Sans cette convention, chaque frontière produirait un conflit d'une
  milliseconde.
- **Une absence l'emporte sur une ouverture exceptionnelle.** Poser une absence
  est un acte délibéré ; une ouverture peut n'être qu'un reliquat.
- **Les tampons de trajet ne se franchissent pas.** C'est la même grandeur que
  celle protégée par `Assignment_no_overlap` — et un test d'intégration vérifie
  que les deux sont d'accord. Si le moteur proposait un créneau que la base
  refuse, la réservation échouerait après paiement.

**Le temps de trajet est une dépendance remplaçable**, jamais calculé au fil du
code. Trois niveaux : calculateur d'itinéraire réel derrière un cache en base,
puis le cache seul, puis une estimation géométrique qui ne tombe jamais en
panne. Le repli n'est pas un détail : un service d'itinéraire indisponible doit
dégrader la précision, pas fermer la réservation.

L'estimation géométrique — `minutes = 3,45 + 1,249 × distance à vol d'oiseau` —
est une régression calibrée sur les quinze itinéraires routiers reliant Léognan
aux quinze autres communes. Erreur absolue moyenne 1,4 minute, maximale 4,2. Un
test la compare aux mesures ; elle n'est valable que sur ce territoire.

**Le score d'attribution est explicable.** Cinq composantes ramenées à `[0, 1]`
et pondérées — trajet 0,40, continuité 0,25, note 0,15, acceptation 0,10,
équité 0,10 — dont la décomposition est conservée dans
`Assignment.scoreBreakdown`. Le trajet domine parce que c'est la seule
composante qui coûte de l'argent et de la fatigue à quelqu'un ; la continuité
suit parce que « le même intervenant chaque semaine » est la promesse centrale.
L'équité pèse peu mais n'est pas nulle : sans elle, un score qui s'auto-renforce
finirait par assécher son propre vivier.

**Le client choisit une heure, jamais une personne.** `findSlots` ne renvoie
qu'un créneau par heure de départ, accompagné de l'intervenant que le score
désigne.

**Une tournée est une journée.** Les étapes prises en compte pour calculer les
trajets amont et aval sont celles du même jour civil français, et d'elles
seules. C'est une correction, pas une évidence : traiter comme « étape
suivante » une mission située trois jours plus tard fait calculer un trajet
entre deux adresses que personne n'enchaîne, et si les deux adresses coïncident,
un trajet nul. Le bug réel : un samedi de 9 h 30 à 13 h proposé à une
intervenante dont les heures s'arrêtent à 13 h, parce qu'elle avait le lundi
suivant une mission à la même adresse. Deux tests protègent les deux sens.

## Réservation

`src/lib/booking/create.ts` fait trois choses ensemble ou pas du tout : la
demande, ses lignes facturables, et les propositions du lot. Une demande sans
proposition est un client qui attend un appel que personne n'a reçu ; des
propositions sans demande sont des sollicitations pour une mission qui n'existe
pas.

**Ce n'est plus une attribution.** Le modèle précédent désignait le mieux classé
et lui bloquait la place : le client repartait avec un rendez-vous ferme, et
quelqu'un se voyait assigner une mission qu'il n'avait pas acceptée. La demande
naît désormais en `PENDING_ASSIGNMENT`, proposée aux cinq mieux classés, et
**seule une acceptation écrit `CONFIRMED`**.

**Le lot n'est pas « les cinq plus proches ».** Ce sont les cinq premiers du
score existant, dont le trajet est déjà la composante dominante mais qui porte
aussi la continuité. Composer sur la distance seule ferait changer d'intervenant
un client régulier dès qu'un autre habite cent mètres plus près, alors que « la
même personne chaque semaine » est la promesse centrale. Les quatre minuteries —
24 h, 6 jours, une semaine, quinze jours — vivent dans
`src/lib/assignments/diffusion.ts`, pur et testé à la milliseconde.

**Le verrou anti-double-réservation n'est pas dans ce code**, il est en base, et
il s'exerce désormais à l'acceptation. Deux garanties SQL s'y partagent le
travail : `Assignment_no_overlap` interdit à _une personne_ deux missions qui se
chevauchent, `Assignment_one_accepted_per_booking` interdit à _une mission_ deux
personnes. La seconde existait depuis la phase 1, avant qu'on en ait besoin :
c'est elle qui départage la course, et son refus se traduit en « cette mission
vient d'être acceptée par quelqu'un de plus rapide ».

**Une proposition ne réserve plus rien**, ni en base ni dans le moteur. Les deux
doivent le dire de la même façon, sans quoi l'un propose ce que l'autre refuse :
`BLOCKING_ASSIGNMENT_STATUSES` ne contient donc plus que `ACCEPTED`. Compter une
proposition comme du temps occupé retirerait cinq plannings de la circulation
pour une seule mission, et empêcherait un intervenant de recevoir deux offres
concurrentes — c'est-à-dire de choisir.

**Conséquence assumée : deux clients peuvent demander le même créneau.** Celui
dont un intervenant accepte le premier l'obtient, l'autre continue de chercher.
L'ancien modèle répondait « créneau pris » au second alors que rien n'était
pris, seulement proposé.

**La boucle « candidat suivant » a disparu avec sa raison d'être.** Elle
existait parce que deux réservations simultanées désignaient le même intervenant
et que la seconde échouait ; cinq propositions concurrentes ne se heurtent à
rien. Le repli du tunnel sur les créneaux alternatifs, lui, reste — il rattrape
désormais « aucun intervenant disponible » et non « créneau pris ».

**Un refus ne déclenche plus de réattribution.** Quatre autres personnes
tiennent la même proposition : rejouer le moteur solliciterait quelqu'un de plus
mal classé avant que les mieux classés aient répondu. Ce qui suit un lot sans
acceptation est affaire d'échéance, pas de refus.

**Deux codes PostgreSQL signalent un refus de créneau, pas un.** `23P01` est la
violation de la contrainte d'exclusion ; `40P01` est l'interblocage, qui survient
dans la même situation. `23505` s'y ajoute pour la course perdue.
`nativeErrorCodes` cherche le code natif où qu'il soit : Prisma l'a déplacé de
`code` à `meta.code` puis à `meta.driverAdapterError.cause.code`, le message
n'étant plus qu'un « Database error. ». Chercher à un seul endroit revient à ne
plus rien reconnaître.

**Rien de ce que renvoie le navigateur n'est cru sur parole.** Le prix est
recalculé côté serveur à la confirmation, jamais repris du formulaire, et
l'organisation est résolue côté serveur.

**Le compte se crée à la réservation, pas avant.** Exiger une inscription pour
obtenir un prix est le moyen le plus sûr de perdre un client sur un service
qu'il n'a jamais essayé.

**La complétion d'adresse est un confort, pas une dépendance.** La Base Adresse
Nationale est un service public qui limite son débit et renvoie parfois 503 ;
quand elle ne rend rien, le tunnel bascule sur une saisie manuelle dont la
commune est choisie dans notre référentiel — ce qui rend structurellement
impossible une réservation hors zone. Les coordonnées retenues sont alors celles
du centre de la commune : les temps de trajet sont moins justes, donc les
créneaux un peu plus prudents. C'est ce chemin que teste le parcours de bout en
bout, précisément pour ne pas dépendre d'un service tiers.

Depuis que l'adresse ouvre le tunnel, ce repli porte davantage : une complétion
en panne arrêtait auparavant un parcours au dernier écran, elle l'arrêterait
désormais au premier. C'est pour cela que le bouton « Saisir mon adresse
manuellement » est **toujours** présent, avant même toute recherche, et non
seulement après un échec.

## Ordre des écrans du tunnel

Six écrans : **adresse, durée, rythme, créneau, coordonnées, récapitulatif.**

**L'adresse ouvre le tunnel depuis le 20 août 2026**, à la place de l'écran de
choix de commune. Le parcours obéissait jusque-là à « plus une information
coûte à donner, plus tard on la demande » : la commune d'abord, presque
gratuite à donner, l'adresse exacte au dernier écran. La règle vaut toujours
pour les coordonnées — nom, téléphone, email restent au cinquième écran — mais
elle avait pour l'adresse un défaut qu'elle ne voyait pas : **le même
renseignement était demandé deux fois.** Il fallait d'abord se reconnaître dans
un référentiel administratif — savoir que Cadaujac n'est pas Cestas, se
trouver parmi seize — pour finir par taper sa rue de toute façon. Une seule
saisie remplace les deux, et la complétion prononce la couverture sur le même
geste : le code postal reste une entrée valable, la BAN le comprenant aussi
bien qu'un nom de rue.

Ce que cela coûte, et qu'il faut assumer : **l'adresse passe devant le prix**,
qui n'apparaît qu'au troisième écran. Deux choses en limitent la portée — elle
n'est demandée qu'une fois au lieu de deux, et la barre basse annonce le tarif
d'entrée dès le premier écran, si bien que « combien ça coûte » reçoit une
réponse avant la première frappe. Un test de bout en bout garde ce qui reste
vraiment structurant : **aucune donnée d'identité n'est réclamée avant que le
prix soit affiché.**

Conséquence technique : les créneaux sont cherchés depuis l'adresse réelle du
premier écran au dernier, jamais depuis le centre d'une commune. Ils sont donc
plus justes, et `COMMUNE_TRAVEL_MARGIN_MINUTES` ne sert plus au tunnel — elle
reste dans le moteur, qui accepte toujours une recherche imprécise.

**Le deuxième écran demande une durée, pas une surface.** On demandait une
taille de logement pour en déduire des heures ; on demande les heures et on
indique la surface qu'elles couvrent habituellement — « 3 h, idéal pour
75 m² ». Personne ne connaît sa surface au mètre près, alors que tout le monde
sait dire « deux heures, ça devrait suffire », et c'est la durée, non la
surface, qui détermine le prix, la place occupée dans la tournée et donc la
faisabilité du créneau. Demander directement la grandeur qui décide de tout
supprime une conversion que le client faisait à l'aveugle.

Le reste de la chaîne — devis, recherche de créneaux, création — continue de
parler en surface, et `surfaceForDuration` fait le pont. Elle prend le plancher
et non l'arrondi, parce que l'estimation arrondit au pas de trente minutes
**supérieur** : 3 h 30 valent 87,5 m² en théorie, 88 m² donneraient 4 h,
87 m² donnent bien 3 h 30. Un test vérifie l'aller-retour sur tous les pas de
la grille — une surface qui rendrait une autre durée ferait facturer autre
chose que ce qui a été affiché.

**« Une fois par mois » n'est plus proposé.** À ce rythme l'entretien courant
n'en est plus un, la durée nécessaire dérive vers le grand ménage et la
promesse d'intervenant attitré ne tient plus. La valeur reste dans
l'énumération et en base — des réservations la portent — mais `offeredFrequency`
ramène au rythme par défaut tout parcours repris ou tout dernier choix qui la
désignerait encore, faute de quoi l'écran s'afficherait sans sélection et la
barre de prix sans prix.

**Chaque montant du tunnel porte son unité.** « 116 € » sur un écran qui
propose « chaque semaine » et « tous les quinze jours » se lit comme un prix
mensuel : les cartes disent donc « par session ». La mention « avant crédit
d'impôt » n'apparaît que si `canShowTaxCredit()` l'autorise — même règle que
partout ailleurs, et tant que la déclaration SAP n'est pas obtenue, rien de ce
qui touche au crédit d'impôt ne s'affiche, pas même le mot « avant ».

**Le client désigne un créneau préféré, puis ceux qui lui iraient aussi.**
Ce n'est pas un confort : entre l'affichage de la liste et la confirmation,
une autre réservation peut prendre la place, la lecture des disponibilités ne
voyant pas les transactions en cours — seule l'écriture les rencontre. Sans
repli, ce client-là recommence tout son parcours pour une place perdue à la
dernière seconde. `confirmBooking` essaie le préféré puis les replis dans
l'ordre donné, et ne rattrape que `SlotTakenError` : une adresse hors zone
échouerait de la même façon sur les quatre suivants. Quand un repli est
retenu, `usedAlternate` le dit sur l'écran de confirmation — une heure
différente de celle qu'on vient de choisir, découverte le jour venu, vaudrait
un rendez-vous manqué. Les replis ne sont pas enregistrés dans le stockage
local : ils décrivent un état du planning qui a une semaine.

**Le prix n'a pas d'écran à lui.** L'écran du rythme porte les quatre formules
avec leur montant et leur durée, et la barre basse l'annonce dès le premier
écran : un écran de plus qui ne ferait que le répéter coûterait un geste sans
rien apprendre.

**Un seul composant porte le champ téléphone** — `phone-field.tsx`. Six
formulaires demandent un numéro : rappel, candidature, liste d'attente,
inscription intervenant, informations du compte, tunnel. Recopier la règle six
fois, c'est se donner six occasions de la voir diverger, et c'est ce que le
dépôt refuse déjà pour les prix et les durées. Il fonctionne **contrôlé ou
non**, parce que les six formulaires ne se ressemblent pas : ceux qui passent
par une server action sont pilotés par leur attribut `name`, le tunnel garde sa
valeur dans son propre état pour la porter au récapitulatif. Une `serverError`
reste affichée tant que le champ n'a pas été retouché — une erreur remontée par
le serveur ne doit pas disparaître au premier clic, avant même correction.

**Le téléphone se met en forme à la frappe et se vérifie avant d'avancer.**
`formatFrenchPhoneAsTyped` groupe par paires au fil de la saisie — forme
partielle comprise, ce que `formatFrenchPhone` ne sait pas faire, elle qui rend
l'entrée telle quelle dès qu'il manque un chiffre. Trois précautions, toutes
destinées à ne pas se battre avec la personne : le `+` initial est conservé, un
`0` qui le remplacerait ferait disparaître sous les doigts le caractère qu'on
vient de taper ; aucun espace n'est ajouté en attente du chiffre suivant, un
espace final que l'effacement doit franchir donnant l'impression d'une touche
morte ; et les chiffres en trop sont montrés plutôt que tronqués. La fonction
est **idempotente** — elle est rappelée sur sa propre sortie à chaque touche —
et un test l'impose.

**On ne reformate que si le curseur est en fin de champ.** Réécrire la valeur
d'un champ contrôlé y replace le curseur à la fin : quelqu'un qui corrige le
troisième chiffre le verrait sauter au bout à chaque touche, et ne pourrait
plus corriger du tout.

**L'erreur ne s'affiche qu'une fois le champ quitté**, puis à chaque frappe.
Reprocher trois chiffres à quelqu'un qui en a tapé trois est hostile ; ne rien
dire avant l'envoi lui fait découvrir la faute après avoir tout rempli.
`diagnosticPhone` rend une phrase et non un booléen — « il manque 1 chiffre »
apprend quelque chose, « numéro invalide » non, et c'est la faute la plus
fréquente. Un garde de sortie révèle l'erreur au lieu de laisser partir une
réservation qu'on ne pourra pas confirmer par téléphone : `required` ne vérifie
que la présence, et neuf chiffres la satisfont.

**Le stockage local ne contient ni adresse ni coordonnées** — une commune, une
surface, un rythme, une heure, sept jours durant. La commune y est désormais
**déduite** du code INSEE de l'adresse choisie, et non plus saisie ; la rue n'y
va toujours pas. Un parcours n'est enregistré qu'une fois une durée choisie :
sans cette garde, arriver sur `/reserver?commune=cestas` depuis une page locale
suffirait à faire apparaître un bandeau de reprise pour une simple visite.

**L'URL porte la commune, la surface et l'écran**, et rien d'autre : une barre
d'adresse se partage, s'enregistre en favori et se retrouve dans les journaux
d'un serveur. Elle n'a jamais porté d'adresse et n'en portera pas.

**Le tunnel ouvre donc toujours sur l'adresse — reprise et lien partagé
compris.** Aucun lien, aucun rechargement, aucune reprise ne peut franchir le
premier écran, puisque rien de ce qui est conservé ne dit où l'on va. C'est le
prix d'un stockage qui ne garde rien d'identifiant, et il est moins cher que
l'inverse. Ce qui est su n'est pas perdu pour autant : l'écran à rejoindre est
mis de côté (`pendingStep`) et **rejoint dès l'adresse donnée**, sans refaire
la durée, le rythme ni le créneau. Il reste ramené à ce que les choix connus
rendent atteignable — une URL bricolée à la main n'ouvre pas un écran de
créneaux sans durée à chercher.

**La confirmation montre quelqu'un.** `IntervenantCard` porte le prénom, la
commune de résidence et l'ancienneté : « le même intervenant, chaque semaine »
est la promesse centrale du service, et elle n'était incarnée nulle part. Le
nom complet n'est jamais publié, la note ne l'est que s'il existe des avis
réels. À défaut d'attribution, on annonce une confirmation sous 24 heures
plutôt que d'inventer quelqu'un.

`src/lib/booking/ics.ts` produit le fichier de calendrier, et il est **pur** —
la vitrine statique émet donc exactement le même. Un rendez-vous absent d'un
agenda est un rendez-vous oublié, et une absence coûte 100 % du prix au titre
du barème des CGU.

### Nombre de gestes, mesuré

| Parcours                               | Cible | Mesuré |
| -------------------------------------- | ----- | ------ |
| Accueil → prix affiché                 | ≤ 4   | 3      |
| Accueil → réservation confirmée        | ≤ 9   | 9      |
| Accueil → appel téléphonique           | ≤ 2   | 1      |
| Reprise → confirmation (dernier écran) | ≤ 4   | **5**  |

**Les deux premiers parcours ont coûté un geste à la refonte narrative de
l'accueil**, et c'est un arbitrage assumé, pas une dérive. Le bloc « Où
habitez-vous ? » répondait de la commune dès l'accueil, si bien que le tunnel
s'ouvrait sur le logement ; l'accueil n'ayant plus qu'un bouton « Réserver »
sans paramètre, le tunnel s'ouvre désormais sur son premier écran. Le prix
apparaît donc au troisième geste au lieu du deuxième.

**Le geste rendu par l'adresse en tête ramène la réservation à neuf.** L'écran
d'adresse du dernier rang a disparu — c'était le doublon de l'écran commune —
et la cible de neuf, dépassée depuis l'ajout des créneaux de repli, est de
nouveau tenue. Il n'y reste toujours **aucune marge** : tout écran ajouté la
dépasserait, et c'est alors la cible qu'il faudrait rediscuter, pas la mesure
qu'il faudrait arrondir.

**La reprise, elle, coûte un geste de plus et dépasse sa cible.** L'adresse
n'étant jamais enregistrée, un parcours repris repasse par le premier écran
avant de rejoindre celui où il s'était arrêté. Les deux issues sont connues :
soit on assume cinq, soit on conserve l'adresse en stockage local — ce que le
dépôt refuse, et pour une raison qui n'a pas changé. La cible est donc à
rediscuter, pas la mesure à arrondir.

Ce que le geste achète : un visiteur qui a compris pourquoi le rayon est court
avant qu'on lui demande où il habite. Les seize communes ouvraient la page —
seize choix réclamés à quelqu'un qui n'avait encore reçu aucun argument.

**Un dixième geste a été ajouté depuis, et il dépasse la cible.** Choisir un
créneau faisait avancer d'écran ; il faut désormais valider, puisque l'écran
reste ouvert pour désigner des créneaux de repli. Ce que ce geste achète est
une réservation qui aboutit quand le créneau préféré part pendant la saisie —
c'est-à-dire précisément le cas où le parcours était perdu en entier. **La
cible de neuf est donc à rediscuter, pas la mesure à arrondir** : soit on
l'assume à dix, soit les créneaux de repli se choisissent au récapitulatif et
le tunnel revient à neuf.

L'appel se fait en un geste depuis l'en-tête, en deux depuis la barre
d'onglets. La reprise n'atteint la cible que depuis les derniers écrans —
reprendre au deuxième demande évidemment de traverser les suivants.

## Application installable et espace client

**Le service worker n'existe que pour rendre l'application installable**, et il
ne met en cache que ce qui est versionné par son nom — les fichiers de
`/_next/static/`, où une URL désigne un contenu et un seul. Ni les créneaux ni
les prix n'y passent : servir une heure périmée depuis un cache ferait réserver
un rendez-vous qui n'existe plus, et le site paraîtrait fautif là où il se
souviendrait seulement. Quand le réseau manque, `/hors-ligne` donne un numéro,
pas un site de secours.

**La proposition d'installation n'apparaît qu'après une réservation
confirmée.** Le moment est toute la décision : la demander à quelqu'un qui vient
d'arriver, c'est réclamer un engagement avant d'avoir rendu le moindre service,
et un refus se paie — le navigateur ne repose plus la question de sitôt.
L'événement du navigateur est capté au niveau du module, parce qu'il arrive au
chargement de la page, bien avant que l'écran de confirmation existe.

**L'espace client passe par le lien magique existant**, pas par un jeton signé
maison : le dépôt a tranché pour des sessions en base, révocables
immédiatement. Un second système d'authentification à côté du premier ne serait
pas un raccourci, ce serait une deuxième surface à sécuriser.

**L'annulation en autonomie existe.** Elle supposait trois choses qui
manquaient, et `client-space.ts` les fait dans une seule transaction : la
transition de statut tracée par `BookingStatusEvent`, la fin des affectations
en cours, et un message à l'intervenant. **C'est la deuxième qui libère le
créneau** — la contrainte d'exclusion ignore les statuts terminaux, si bien
qu'une affectation restée `ACCEPTED` gèlerait une heure pour une intervention
qui n'a plus lieu.

Le coût est annoncé **avant** la confirmation, calculé par `decideCancellation`
— la même fonction pour l'écran et pour la mutation, sinon le bouton et le
prélèvement finiraient par diverger.

**L'appartenance ne passe pas par `requireOrganization`**, un client de la
marketplace n'ayant pas de `Membership` : le profil est résolu depuis la
session, jamais depuis l'entrée, et une réservation qui ne lui est pas
rattachée est introuvable — le même message que si elle n'existait pas, pour
ne pas confirmer un identifiant à un curieux.

**Le chat est rattaché à l'intervention, pas au couple de personnes.** Un
intervenant peut changer d'une semaine sur l'autre, et un fil qui suivrait les
personnes mélangerait deux interventions sans rapport. Sans intervenant
désigné, l'envoi est refusé plutôt que d'écrire à personne.

**Quatre écrans se sont ouverts le 20 août**, tous branchés sur des moteurs
déjà écrits et testés qui n'avaient aucun appelant.

_L'abonnement._ **La pause vient avant la résiliation, et elle est plus
visible** : c'est le principal outil anti-résiliation, et le cacher derrière le
bouton qui fait tout perdre serait un choix contre le client autant que contre
l'entreprise. La sortie n'est pas cachée pour autant — aucun appel obligatoire,
aucun préavis, un lien atteignable en un geste, parce qu'un parcours de
résiliation qu'on n'atteint pas se termine par un appel à sa banque. Le motif
décide de ce qu'on propose **une fois**, sans insister : proposer une remise à
quelqu'un qui déménage transformerait un départ neutre en mauvais souvenir.

_La notation._ Deux taps — les étoiles, puis des tags — et le commentaire reste
facultatif : un champ libre obligatoire fait chuter le taux de réponse sans rien
apprendre de plus qu'une étoile. Les mêmes cinq tags quel que soit le nombre
d'étoiles ; deux jeux distincts feraient dire au formulaire ce que le client n'a
pas dit. Trois étoiles ou moins ouvrent un ticket, dans la même transaction que
l'avis — un mécontentement enregistré que personne ne voit passer est pire que
pas d'avis du tout. `Review.isPublic` vaut désormais **faux par défaut** : ce
qui se publie est décidé par `estPubliable`, jamais subi.

_Le parrainage._ Les phrases sont **engendrées depuis le programme**
(`referral/annonce.ts`, pur), jamais écrites : un plafond recopié dans une page
finit par diverger de celui qui s'applique, et c'est le reproche fait aux
plateformes nationales. Un test le vérifie en modifiant le programme. Le
plafond et l'unique niveau sont annoncés.

_Le moyen de paiement._ La saisie a lieu **chez Stripe**, par une session
Checkout en mode `setup` : aucun champ de carte dans nos pages, aucune
dépendance ajoutée, et la surface PCI reste chez celui dont c'est le métier.
`setup_future_usage: off_session` est déclaré à l'enregistrement, ce qui fait
demander l'authentification forte pendant que le client est devant son écran
plutôt que la nuit d'avant la mission. **La carte n'est pas exigée à la
réservation** — la préautorisation part à H-24 — et retirer la dernière est
refusé quand une intervention est à venir, avec le geste à faire à la place.

**« Mon compte » est un sommaire, pas un tableau de bord.** `compte/menu.ts`
est pur et compose la liste à partir de ce qui est réellement disponible ; un
test lui interdit de proposer une fonction que le produit n'a pas, et de
prononcer le mot « fiscal » tant que la déclaration SAP n'est pas obtenue. Le
corpus de référence propose « Carte cadeau » et « Compte URSSAF » : ni l'un ni
l'autre n'est repris, les copier reviendrait à promettre le service d'un autre.
**Une entrée qui déçoit apprend à ne plus faire confiance au menu**, et le
menu entier perd sa valeur pour une ligne de trop.

_Les informations personnelles._ Le nom et le téléphone se corrigent ;
**l'adresse email non**, parce qu'elle identifie le compte et reçoit les liens
de connexion — la changer sur simple saisie permettrait de détourner un compte
depuis un poste laissé ouvert. **Les adresses postales ne s'éditent pas** : une
adresse porte des coordonnées géocodées, des consignes d'accès et un code de
porte chiffré, et la corriger hors du parcours qui les collecte produirait un
texte qui ne correspond plus à son point géographique — le moteur calculerait
des trajets vers un endroit où personne n'habite. Celles qui n'ont jamais servi
se retirent ; les autres restent, leurs factures y étant rattachées.

**La replanification à l'initiative du client n'y est toujours pas** : elle
suppose de rechercher un créneau et de réattribuer, c'est-à-dire le tunnel
entier. Annuler puis reprendre reste le chemin.

### Espace intervenant

**Les vérifications sont des fonctions pures, pas des appels réseau.**
`cleaner/identifiants.ts` contrôle la clé de Luhn du SIRET — une faute de
frappe sur un chiffre est détectée sans interroger personne, ce qui est la
vérification la plus rentable du formulaire. L'exception de La Poste, dont les
établissements suivent une règle différente, est traitée : l'ignorer
rejetterait des SIRET valides.

**Le numéro SAP se recoupe avec le SIRET.** Il s'écrit « SAP » suivi du SIREN,
donc il doit porter le même SIREN que le SIRET déclaré. Deux identités
différentes dans le même formulaire sont soit une faute de frappe, soit le
numéro de quelqu'un d'autre — et un numéro emprunté ouvrirait un crédit
d'impôt indu au client, qui le rembourserait.

**`CleanerProfile.sapDeclarationNumber` est nullable et doit le rester.** La
déclaration met des semaines à être instruite, et refuser de faire travailler
quelqu'un en attendant reviendrait à ne recruter personne au lancement. Elle
n'empêche donc pas l'activation, mais tant qu'elle manque la part de cet
intervenant n'ouvre aucun crédit d'impôt, et `activationState` le dit en
avertissement plutôt que de le taire.

**Ce qui manque à un dossier est dérivé, jamais posé à la main.** Un drapeau
« vérifié » levé séparément de l'état des pièces finirait par mentir. La liste
est en outre exactement celle promise aux clients sous « professionnels
vérifiés » et affichée aux candidats sur `/travailler-avec-nous` : trois
surfaces, une seule vérité, vérifiable par n'importe qui.

**Le parrain est le propriétaire du code, et rien d'autre.** `Referral` ne
porte aucune colonne `referrerUserId` : on remonte au parrain par
`referralCode.ownerUserId`. Le second niveau n'est donc pas interdit par une
règle qu'on pourrait lever, il est **inexprimable** dans le schéma — ce qui
est la seule forme solide de l'interdit posé par l'article L.121-15.

### Quand personne n'accepte la mission

Le tunnel vend un créneau **ferme**, et il arrive qu'il ne le soit pas : le
dernier intervenant refuse, `reattribuer` ne trouve personne, la réservation
retombe en `PENDING_ASSIGNMENT`. C'est le seul moment où la promesse n'est pas
tenue, et le client attendait jusqu'ici un appel.

**`SlotProposal` porte la sortie : un intervenant propose une autre heure, le
client tranche.** Rien ne bouge tant qu'il n'a pas répondu — déplacer d'office
le rendez-vous de quelqu'un parce que personne n'était libre lui ferait porter
un manque qui n'est pas le sien. Refuser est donc un bouton de même poids
qu'accepter.

**La table ne porte aucune contrainte d'exclusion, et c'est voulu** : une
proposition n'occupe personne. C'est l'écriture de l'`Assignment`, à la
validation, qui rencontre `Assignment_no_overlap` — le conflit se décide sur
la seule écriture qui engage un intervenant, jamais avant.

**Accepter se fait en deux temps assumés**, pas en une transaction : on déplace
la réservation, puis on demande une affectation restreinte à l'intervenant qui
a proposé, ce qui réutilise `reattribuer` — trajets réels, tampons, et la
contrainte. S'il s'est engagé ailleurs entre-temps, l'écriture échoue : la
réservation revient à son heure d'origine et le client l'apprend, plutôt que
de se retrouver déplacé sans personne pour venir.

**La durée ne se renégocie pas** : `proposedEnd` se déduit de la durée de la
réservation. Changer la durée changerait le prix, et un prix qui bouge après
la réservation n'est plus une proposition.

## Espace intervenant

**Deux listes, dans l'ordre de l'urgence.** Les propositions d'abord — elles ont
un délai de réponse qui court, et c'est la seule chose à faire aujourd'hui — les
missions acceptées ensuite, avec ce qu'il faut pour s'y rendre.

**Accepter fait basculer la réservation et l'affectation ensemble**, dans une
transaction : une mission acceptée dont la réservation resterait `ASSIGNED`
laisserait le client sans confirmation, et l'écart ne se verrait qu'à la
lecture. C'est l'acceptation, et elle seule, qui écrit `CONFIRMED`.

**Un refus rejoue le moteur d'attribution.** Le refus humain mérite le même
traitement que le refus technique de la base : `reattribuer()` recharge les
plannings du jour, les temps de trajet réels et le classement par score, en
écartant ceux qui ont déjà décliné. Si personne ne reste, la réservation revient
en `PENDING_ASSIGNMENT` avec un événement qui le dit — un état visible, que le
back-office liste, plutôt qu'un client qui attend quelqu'un qui ne viendra pas.

**Le refus est enregistré hors de la transaction de réattribution**, et ce n'est
pas un oubli : la contrainte d'exclusion se prononce à l'écriture de la nouvelle
affectation, si bien qu'une transaction unique qui échouerait sur elle annulerait
aussi le refus — l'intervenant se retrouverait avec la mission qu'il vient de
décliner.

**La semaine type est le seul chemin par lequel des heures entrent en base**, et
sa capacité `availability:manage:own` n'est détenue par aucun rôle de gestion :
le produit ne crée pas de lien de subordination. `src/lib/availability/semaine.ts`
est pur et sert deux fois — l'écran empêche de se tromper, la server action
empêche de contourner. Pas de 30 minutes, plage minimale de 2 h : une plage de
dix minutes produirait des créneaux que le moteur ne peut pas remplir.

**Quatre écrans se sont ajoutés le 20 août.** _Aujourd'hui_ répond à trois
questions d'un coup d'œil — où je vais maintenant, combien je gagne
aujourd'hui, qu'est-ce qui a changé — et **l'ordre affiché est suggéré, jamais
imposé** : c'est écrit sur la page, parce qu'un logiciel qui ordonne la journée
d'un indépendant est un indice de subordination s'il le subit. _Mes revenus_
tient **trois états jamais mélangés** — viré, en attente du virement, à venir —
et ne calcule aucun montant : chaque euro vient de la rémunération proposée et
acceptée avant la mission. Un virement dont la date est passée est signalé comme
tel, l'écrire sous « prochain virement » présenterait un retard comme une
promesse. _Mes messages_ est le symétrique du fil client, rattaché à
l'intervention et non au couple de personnes ; ouvrir un fil le marque comme lu
dans le même appel. _Coopter_ lit le même programme que le parrainage client.

**Ce qui n'y est pas, et pourquoi c'est bloquant pour la production** :
l'inscription en autonomie existe désormais (`/rejoindre`, `/rejoindre/dossier`,
et la revue de dossier côté plateforme), mais **le dépôt des pièces attend le
bucket Scaleway** — l'adaptateur est écrit, et l'écran dit honnêtement que le
dépôt n'est pas ouvert en donnant le téléphone plutôt que d'accepter un fichier
qu'il perdrait. Restent les factures et l'attestation fiscale annuelle, qui
attendent la facturation.

**Les absences se déclarent depuis le 19 août 2026.** `availability/absences.ts`
est pur, comme `semaine.ts`, et sert deux fois — l'écran empêche de se tromper,
la server action empêche de contourner. Trois arbitrages : une absence déjà
commencée est acceptée, parce que quelqu'un qui tombe malade un mardi doit
pouvoir se retirer du reste de la semaine ; les bornes sont `[debut, fin)`,
faute de quoi deux absences jointives se refuseraient sur une milliseconde ;
et **l'écran ne retire aucune mission déjà acceptée**, il nomme celles que
l'absence recouvre et renvoie au téléphone. Une absence change ce qui sera
proposé ; se dégager d'un engagement pris regarde aussi le client. Voir « Ce que la chaîne n'a pas encore ».

## Back-office plateforme

**Il montre du travail à faire, pas des indicateurs.** Une page
d'administration qui affiche des courbes se consulte une fois ; une page qui dit
ce qui attend s'ouvre tous les matins. Quatre listes, chacune correspondant à
une situation où l'absence d'intervention humaine se paie : réservations sans
intervenant, propositions dont le délai est passé, demandes de rappel non
traitées, intervenants dont le SIRET, l'assurance ou la pièce d'identité
conditionnent la première mission.

La lecture traverse les organisations, ce que seul un administrateur plateforme
peut faire : elle passe par le client non cloisonné, et `asPlatformAdmin()` est
vérifié à l'entrée de la page, où cela se lit.

**Deux écrans agissent désormais, le tableau des quatre listes reste en lecture
seule.** Rattraper une réservation orpheline ou relancer une proposition périmée
se fait toujours à la main.

_La revue de dossier_ trie **du plus ancien au plus récent**, et ce n'est pas
cosmétique : traiter le plus récent d'abord laisse indéfiniment au fond de la
pile celui qui attend depuis trois semaines, et c'est celui-là qu'on perd. Les
signaux d'attention s'affichent **hors de toute note** — un doublon d'IBAN ne se
compense pas par de bons points ailleurs — et deux d'entre eux suspendent
l'examen, le bouton d'activation disant alors pourquoi il est éteint. La grille
d'entretien homogénéise **sans classer** : aucune moyenne n'en est tirée, une
moyenne ferait compenser « français opérationnel » par « motivation ». Un refus
de pièce choisit son motif dans une liste écrite en langage courant, parce
qu'un motif vague fait redéposer la même pièce et que c'est le candidat qui
paie l'aller-retour.

_Les réclamations_ affichent leur origine en tête — note basse ou démarche du
client — parce qu'elle décide de la première phrase au téléphone : on ne
rappelle pas de la même façon quelqu'un qui a demandé quelque chose et quelqu'un
à qui on écrit. **Un classement sans suite exige une résolution écrite** autant
qu'une résolution : « on n'a rien fait » est une décision qui se justifie, et
qui se relit quand la même personne rappelle.

## Factures et attestations fiscales

**Une prestation produit deux factures**, et le module les écrit ensemble ou
pas du tout. Une prestation dont une seule moitié serait facturée laisserait la
comptabilité fausse d'un côté, le client sans justificatif de l'autre — et la
suite de numéros porterait déjà le trou.

**La numérotation est une contrainte fiscale, pas une convention.** L'article
242 nonies A de l'annexe II au CGI exige une séquence chronologique **continue,
sans rupture** : un trou se présume être une facture retirée, et c'est ce qu'on
cherche en premier. D'où trois choix :

- **Une série par émetteur.** Léo Clean facture sa coordination pour son propre
  compte, l'intervenant sa prestation pour le sien.
- **Une série dédiée à l'autofacturation** (`LC-<siren>`). Les factures de
  l'intervenant sont établies en son nom et pour son compte — article 289, I-2
  du CGI — et il facture aussi ailleurs : une série distincte est la réponse
  prévue pour ce cas. La mention correspondante est obligatoire, et son absence
  rend la facture irrégulière.
- **Le compteur vit en base et s'incrémente dans la transaction** qui écrit la
  facture, jamais dans une `SEQUENCE` PostgreSQL — une séquence ne revient pas
  en arrière quand la transaction échoue, et laisse exactement le trou qu'on
  évite.

**Une facture est immuable, donc figée à l'émission.** Tout ce qu'elle imprime
— identité de l'émetteur, adresse du client, lieu d'exécution — vient de
sources vivantes qui changeront ; sans instantané, une facture de l'an dernier
se réimprimerait différemment. Le code de commerce impose dix ans.

**`verifierLaFacture` refuse d'écrire une facture irrégulière.** Le régime
applicable est celui de la « note » de l'arrêté du 3 octobre 1983 — prestation
de services à un particulier — et non celui des factures entre professionnels :
date de rédaction, identité et adresse du prestataire, nom du client, **date et
lieu d'exécution**, décompte détaillé en quantité et en prix, total. Une facture
déjà remise ne se corrige que par un avoir ; un refus, lui, se voit dans le
back-office avant que quiconque l'ait vue.

**La quantité facturée est la durée vendue, pas la durée réelle.** Le dépôt a
déjà tranché que la durée réelle ne refacture rien ; porter la durée réelle en
gardant le montant convenu produirait un prix unitaire de fiction — une
intervention pointée en une minute affichait 6 882 € de l'heure — et c'est
précisément le prix unitaire qu'un contrôle recalcule. L'écart appartient au
rapport de mission.

**L'éligibilité au crédit d'impôt se décide facture par facture, et le devis n'y
suffit pas.** `partEligible` rend zéro quand l'émetteur n'a pas de numéro de
déclaration, quelle que soit la prestation : annoncer une réduction sans
déclaration ferait porter au client un avantage que l'administration lui
reprendrait. C'est la même frontière que `fiscal.ts` tient pour le site,
appliquée à chaque document — aujourd'hui la coordination affiche donc 0 €
éligible, la plateforme n'étant pas déclarée.

**L'attestation annuelle porte sur les sommes _versées_, jamais sur celles
facturées** (CGI, art. 199 sexdecies). Une prestation de décembre payée en
janvier appartient à l'année du paiement : la bâtir sur les factures donnerait
un montant faux pour tout client servi à cheval sur deux années, c'est-à-dire
pour un abonné — la clientèle que le service vise. Trois corollaires : un
remboursement diminue la somme attestée, **des frais d'annulation n'ouvrent
aucun droit** — ils indemnisent un créneau, ils ne rémunèrent pas un service —
et le plafond de 12 000 € est **annoncé mais jamais appliqué**, l'administration
le calculant sur l'ensemble du foyer.

Elle est **figée comme la facture** : un document joint à une déclaration de
revenus doit pouvoir être rendu à l'identique. Et elle avertit qu'il faut
déduire les aides perçues — CESU préfinancé, employeur, APA, PCH — sans quoi le
client déclare le brut et se fait redresser.

**Le régime de TVA est une donnée, pas une constante du code.** Il vit sur
`Organization` et sur `CleanerProfile`, parce qu'il dépend du chiffre d'affaires
et d'options que seul un comptable connaît. **PAPER PLANE est assujettie au taux
normal** (20 %, confirmé le 20 août 2026) ; les intervenants restent en
franchise en base sous le seuil. Deux régimes distincts sur la même prestation,
puisque ce sont deux entités qui facturent.

**La TVA s'extrait du montant, elle ne s'y ajoute pas.** Le client est annoncé
un prix tout compris et les deux factures se partagent ce prix-là : la part de
coordination est donc du TTC, dont le HT se déduit. L'ajouter par-dessus ferait
somme des factures supérieure à ce qu'il a réglé — le même défaut que
d'annoncer un prix et d'en prélever un autre. `decomposerTtc` calcule le HT et
**déduit** la TVA, si bien que `ht + tva === ttc` au centime quel que soit
l'arrondi ; un test le vérifie sur cinq mille montants.

**Le document se télécharge par l'impression du navigateur.** Une bibliothèque
de PDF ajouterait une dépendance lourde à une construction sans serveur pour
produire ce que tous les appareils savent déjà faire. Ce qui rend le document
stable n'est pas son format mais son instantané.

## Données personnelles

**Le droit d'accès rend tout ce qui est rattaché à la personne**, en un fichier,
sans passer par un échange d'emails.

**Le droit à l'effacement est tenu, et ses limites sont dites avant la
confirmation.** L'article 17 du RGPD écarte l'effacement quand le traitement est
nécessaire au respect d'une obligation légale, et le code de commerce impose dix
ans de conservation des documents comptables : **une facture émise ne s'efface
pas.** Promettre le contraire serait plus grave que de le refuser, parce que la
promesse serait tenue à l'écran et démentie en base. D'où deux catégories
annoncées à la personne : effacé — adresses, consignes d'accès, téléphone,
notes, avis, demandes de rappel, sessions et connexions ; conservé mais détaché
de l'identité — montants, factures et réservations qui les portent.

**L'identité est neutralisée, pas supprimée.** Effacer la ligne `User`
emporterait en cascade les réservations, donc la comptabilité. L'email est
remplacé par un jeton sur un domaine `.invalid`, qui ne peut pas être enregistré
et vers lequel aucun message ne partira jamais par erreur.

L'effacement exige de recopier un mot, lu par l'écran et par le serveur dans le
même module : afficher un mot et en attendre un autre est la meilleure façon de
rendre une suppression impossible sans que personne comprenne pourquoi.

## Vitrine statique de démonstration

`npm run build:demo -- --base-path /depot` produit dans `out/` un site de
fichiers. Elle sert à montrer et à faire relire, jamais à prendre des
réservations.

**Elle n'est publiée par aucun workflow.** Ce document a longtemps désigné un
`.github/workflows/leoclean-pages.yml` qui n'existe pas : la publication GitHub
Pages a été retirée le jour où une base de production a pu être installée en une
commande (`npm run db:init`), et maintenir en ligne un double intégral du site
pour montrer ce que le site montre déjà n'avait plus d'objet — c'était une
surface indexable de plus à surveiller. `ci.yml` est désormais le seul workflow
du dépôt ; il construit la vitrine sans la publier, et la commande se lance à la
main. Le jour où la publication sera automatisée, c'est ici qu'il faudra
l'écrire.

**Le tunnel y fonctionne pour de bon**, et c'est le bénéfice concret d'avoir
tenu les moteurs purs : tarification et disponibilité sont les mêmes fonctions
qu'en production, exécutées dans le navigateur, sur une équipe d'intervenants
fictive déclarée en clair dans `lib/demo/roster.ts`. La recherche d'adresse
interroge réellement la Géoplateforme. Seule l'écriture manque.

Le tunnel passe pour cela par `BookingBackend` : quatre opérations, deux
implémentations — les server actions en production, `lib/demo/backend.ts` sur
la vitrine — et pas un écran dupliqué. Attention à une contrainte de React :
une fonction ordinaire ne traverse pas la frontière serveur/client, alors
qu'une server action le peut. Le backend de démonstration est donc assemblé
côté client, dans `booking-funnel-demo.tsx`.

**Deux garde-fous, non négociables.** Toutes les pages sont en `noindex` et le
`robots.txt` interdit tout : cette vitrine est un double intégral du futur
site, rédigé pour se classer sur les mêmes requêtes, et un `github.io` indexé
concurrencerait `leoclean.fr` sur les requêtes mêmes qu'il sert à gagner. Un
bandeau non fermable annonce la démonstration, parce que le site affiche un
vrai numéro et de vrais tarifs — quelqu'un pourrait croire y avoir réservé.

**Le build écarte des fichiers plutôt que d'ajouter des conditions.**
`scripts/build-demo-statique.mjs` déplace ce qu'un export ne peut pas produire
— espaces connectés, server actions, middleware, pages société, page d'offre —
pose les substituts de `demo/overlay/`, puis restaure l'arbre dans un
`finally`. Une condition oubliée casserait le build de production ; un fichier
déplacé ne casse que celui-ci.

**Une route ajoutée est une exclusion à envisager.** La liste n'est pas
déductible du code : `/pro/[slug]` a cassé la vitrine pendant une journée
parce que `dynamicParams` est incompatible avec `output: export`, et rien ne
l'a signalé — `ci.yml` ne lance ni `npm run build` ni `npm run build:demo`.
Une page qui porte une server action, lit la base ou se rend à la demande doit
partir, **et ses composants avec elle** : un composant resté seul importerait
une action qui n'est plus là, et c'est le typage qui échouerait, pas
l'export.

**`basePath` n'est pas appliqué au `src` d'une image non optimisée**, et
l'export impose ce mode. D'où `lib/asset-path.ts` : tout fichier de `public/`
référencé en dur doit passer par `assetPath()`, sinon il est cherché à la
racine du domaine.

## La frontière client / serveur, tenue par un test

**Elle s'est vengée trois fois dans la même journée** : le vocabulaire des
réclamations, celui de la messagerie, le plafond du rapport photo. À chaque
fois le même geste — une constante ou un type lu depuis un module qui, lui,
importe Prisma ou le SDK S3. Le typage ne voit rien, `tsc` passe, et c'est la
**construction** qui s'arrête, ou le serveur de développement qui refuse de
démarrer plusieurs minutes plus tard sur une trace qui ne nomme pas le geste
fautif.

`src/frontiere-client.test.ts` parcourt le graphe d'imports du dépôt et échoue
si un fichier `"use client"` atteint un module `server-only`, en rendant la
chaîne complète. Deux règles le rendent juste :

- **Un `import type` est ignoré**, parce qu'il est effacé à la compilation et
  ne tire rien dans le paquet. `sign-in-form.tsx` lit ainsi `ActionResult`
  depuis un module `server-only` sans jamais en charger une ligne.
- **La traversée s'arrête aux `"use server"`**. Une server action est la
  frontière RPC prévue par React : un composant client a le droit de
  l'importer, et elle a le droit d'atteindre la base. C'est exactement ce qui
  distingue un appel légitime d'une fuite de dépendance.

Le remède au piège n'était pas la vigilance. Quand il faut partager une
constante, un type ou un libellé, il va dans un module pur — c'est déjà ce que
font `reclamation/vocabulaire.ts`, `messagerie/vocabulaire.ts` et
`mission/rapport-photo.ts`.

## Performance et accessibilité, mesurées

`scripts/mesurer-vitals.mjs` relève les indicateurs sur une construction de
production. **Le débit réseau n'y est pas simulé et ne peut pas l'être** :
Chrome n'applique pas la limitation au trafic de bouclage. Ce qui est mesuré
est donc le temps de rendu, processeur bridé quatre fois — 48 à 104 ms de LCP
selon les pages. La part réseau se mesurera sur `leoclean.fr` une fois le
domaine en production.

**Le décalage cumulé vaut zéro partout, bandeau de reprise compris.** C'était
le seul risque : un bloc rendu après hydratation en tête d'accueil pousse tout
le reste vers le bas. Il se pose avant le premier rendu, si bien que le
décalage ne compte pas — mais la mesure est faite dans les deux états, avec et
sans parcours enregistré, précisément parce que ce n'est pas évident.

**Le site porte deux photos, et seulement en desktop.** Fournies par le
porteur du projet avec le prototype (héros et bande sombre de l'accueil),
elles sont importées statiquement — dimensions connues, aucun décalage de mise
en page, `basePath` de la vitrine géré par Next — et masquées sous `lg:` : en
mobile, elles coûteraient le premier écran entier là où la thèse doit se lire
avant tout défilement. Elles semblent générées (le logo du t-shirt est déformé
sur l'une) : à faire valider avant une communication publique. Les trois
familles sont chargées par `next/font` — Alan Sans préchargée (chaque titre la
demande au premier rendu), JetBrains Mono sans préchargement, elle
n'apparaît qu'au fil de la lecture.

**Deux dépendances ne descendent plus dans le premier octet.** `ContactSheet`
embarque le `Dialog` de Base UI et n'est chargé qu'à l'ouverture du panneau —
la barre d'onglets vivant dans le gabarit racine, ce poids se serait payé sur
chaque page. Et le bandeau de reprise valide le stockage à la main : c'est la
seule entorse du dépôt à la règle « Zod à chaque frontière », consentie parce
qu'elle ajoutait 62 kio compressés à la page d'accueil pour vérifier quatre
champs primitifs qui ne pilotent rien. Le tunnel garde Zod : ce qu'il relit
décide d'un prix.

**Un écart de contraste est constaté et non corrigé.** `ink-500` sur blanc vaut
3,89:1, sous le seuil AA de 4,5 pour du texte courant ; le token n'est employé
que par `.overline`. Le corriger dans le code ferait diverger le produit de son
design system, ce que le dépôt interdit : `src/styles/contrast.test.ts`
verrouille le constat dans les deux sens pour que la question revienne au
système au lieu de se perdre. `ink-600` tiendrait 5,7:1 et resterait dans la
même famille.

**Le changement d'écran du tunnel est annoncé.** Le parcours ne navigue pas —
c'est le même document dont le contenu est remplacé — si bien que rien n'était
lu d'une étape à l'autre.

## Base de données

PostgreSQL 15+ avec **PostGIS** et **btree_gist**. Deux garanties vivent en SQL
parce qu'aucun contrôle applicatif n'y résiste :

- `Address.geog` est une **colonne générée** dérivée de `lat`/`lng` : elle ne
  peut pas diverger, et porte l'index GIST des requêtes de proximité.
- `Assignment_no_overlap` est une **contrainte d'exclusion** qui interdit à un
  intervenant deux missions qui se chevauchent. Elle porte sur
  `blockStartAt`/`blockEndAt`, c'est-à-dire créneau **plus temps de trajet** :
  deux ménages jointifs à quinze kilomètres l'un de l'autre sont refusés par la
  base. Elle ne filtre plus que `ACCEPTED` : une proposition ne réserve rien,
  sans quoi un intervenant ne pourrait pas recevoir deux offres concurrentes.
- `Assignment_one_accepted_per_booking` est l'autre moitié : un index unique
  partiel sur `("bookingId") WHERE status = 'ACCEPTED'`, qui interdit à une
  mission d'avoir deux intervenants. C'est lui qui tranche « le premier qui
  accepte l'emporte », et il existe depuis la migration initiale.

On emploie `tsrange` et non `tstzrange` dans cette contrainte : Prisma projette
`DateTime` sur `timestamp without time zone` et y écrit de l'UTC ; une
conversion vers `timestamptz` dépendrait du paramètre de session et serait
refusée dans une expression d'index.

Les tests d'intégration exigent une base dont le nom se termine par `_test` —
ils tronquent des tables.

**Le déploiement migre avant de construire.** `vercel.json` désigne
`npm run build:deploiement`, qui joue `prisma migrate deploy` puis la
construction : Vercel ne migre rien de lui-même, et le code partait donc en
ligne en attendant des colonnes que la base n'avait pas encore.

**La migration ne passe jamais par le pooler transactionnel**, et c'est la
raison d'être de `scripts/migrer-avant-deploiement.mjs`. Lancé sur le port 6543
de Supabase, `prisma migrate` ne renvoie rien, n'échoue pas et ne rend pas la
main : il attend un verrou que pgbouncer, qui recycle les connexions à chaque
transaction, ne lui accordera jamais. Dans une construction Vercel, cela
consomme le délai maximal avant d'abandonner sans rien dire. On migre donc par
`DIRECT_URL` — pooler en mode session, port 5432 — et le script **refuse
immédiatement** une URL qui porte les marques du mode transactionnel. Un échec
nommé en deux secondes vaut mieux qu'un blocage muet de trois quarts d'heure.

Conséquence de configuration : `DIRECT_URL` doit être renseignée chez
l'hébergeur, pour la production comme pour les prévisualisations. `DATABASE_URL`
reste en 6543, qui est la bonne connexion pour l'application.

## Structure

```
src/
  app/                 routes App Router
  components/ui/       shadcn/ui, non modifiés sauf nécessité
  components/          composants métier
    app-tab-bar.tsx      navigation du pouce, mobile, hors espaces applicatifs
    sticky-booking-cta.tsx rappel de prix à la lecture, effacé par le vrai bouton
    contact-sheet.tsx    les trois canaux, en panneau bas
    booking-funnel.tsx   le tunnel — adresse, durée, rythme, créneau, contact, récap
    home/couverture-check.tsx « venez-vous chez moi ? », par code postal
  lib/
    db.ts              client Prisma et cloisonnement multi-tenant
    env.ts             variables d'environnement validées par Zod
    site.ts            NAP et identité publique — source unique
    facts.ts           agrégateur des chiffres affichés, côté client et côté offre
    fiscal.ts          ce que le site a le droit de dire du crédit d'impôt
    features.ts        disponibilité des fonctions annoncées (live/beta/roadmap)
    referral/          parrainage client et cooptation intervenant, un seul niveau
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
      mot-de-passe.ts  politique et dérivation scrypt — pur
      identifiants.ts  vérification, définition, sessions (server-only)
      session-connexion.ts session en base d'une connexion par mot de passe
      fournisseurs.ts  les fournisseurs sociaux réellement configurés — pur
    compte/            sommaire de « Mon compte » (pur) et informations
    catalogue.ts       lecture du catalogue et devis, sur client cloisonné
    organizations.ts   résolution de l'organisation côté serveur
    booking/           création de réservation, transactionnelle (server-only)
      known-client.ts  profil, adresses et dernier choix d'un client connu
      client-bookings.ts réservations d'un client, pour son espace
      horizon.ts       horizon de réservation et marge de trajet (constantes)
    assignments/       diffusion par lots, échéances et classement des candidats
      diffusion.ts     les quatre minuteries et leur ordre — pur
      echeances.ts     ce qui arrive quand personne ne fait rien (server-only)
    availability/      semaine type et absences déclarées — pur
    analytics/         taxonomie des événements (pure) et journal (server-only)
    stockage/          politique de dépôt (pure), interface, résolution
      s3.ts            Scaleway Object Storage — bucket privé, URL signées 60 s
    logement/          chiffrement des consignes d'accès (pur) et module gardien
    mission/           cycle de travail et notation — purs ; travail.ts écrit
    abonnement/        récurrence — pure ; generateur.ts écrit les occurrences
    paiement/          calendrier — pur ; stripe.ts, travaux.ts et moyen.ts exécutent
      moyen.ts         carte du client, par session Checkout chez Stripe
      revenus.ts       trois états jamais mélangés, aucun montant recalculé
    administration/    tableau de bord plateforme, ce qui attend un humain
      reclamations.ts  file des réclamations (server-only)
    candidature/       parcours (pur), dossier et revue (server-only)
    messagerie/        vocabulaire (pur), fil de l'intervenant (server-only)
    reclamation/       vocabulaire des réclamations — pur
    facturation/       numérotation, document et attestation — purs
      emission.ts      les deux factures d'une prestation (server-only)
      attestation-annuelle.ts  sommes versées dans l'année (server-only)
    societes/          page publique d'une société cliente du SaaS
    rgpd/              accès et effacement, avec leurs limites
    securite/          limitation de débit des formulaires publics
    referral/          parrainage — pur et testé, non branché
    geo/ban.ts         Base Adresse Nationale, géocodage et couverture
    phone.ts           normalisation des numéros français
    pricing/           moteur de tarification, pur et testé
    scheduling/        disponibilité, trajets, créneaux et score — pur
      repository.ts    chargement de l'instantané de planning (server-only)
      travel-cache.ts  cache des temps de trajet en base (server-only)
  proxy.ts             répartition des hôtes et redirection optimiste
prisma/
  schema.prisma        35 modèles, tous cloisonnés sauf exception justifiée
  migrations/          migrations versionnées, SQL PostGIS écrit à la main
  socle.ts             organisation, catalogue et tarifs — le minimum vital
  init.ts              installe une base de production, sans fiction
  intervenant.ts       enregistre un intervenant réel, en attendant l'inscription
  seed.ts              3 organisations, 12 intervenants, 60 réservations
  fixtures/streets.ts  192 voies réelles issues de la Base Adresse Nationale
test/                  amorçage des tests d'intégration
e2e/                   Playwright
docs/                  audits, journal de refonte, gel fonctionnel
```

`prisma/seed.ts` **tronque toutes les tables** et n'a sa place que sur une base
jetable. Une base de production s'installe par `db:init`, qui ne crée que
l'organisation marketplace, son catalogue et ses tarifs : une base de production
peuplée de douze intervenants fictifs proposerait de vrais créneaux tenus par des
gens qui n'existent pas, et un client pourrait réserver l'un d'eux.

`src/lib/territory.ts` est une constante du projet. Ses données proviennent de
`geo.api.gouv.fr` et alimentent le contrôle de couverture, le géocodage, les
pages SEO et `llms.txt` : elles doivent rester exactes.

`src/lib/site.ts` porte la NAP. Sa cohérence avec Google Business Profile et
les annuaires est un facteur de classement local direct : aucune de ces valeurs
ne doit être ressaisie en dur dans une page.

## Design

Le design system fait foi, et depuis la refonte d'août 2026 c'est la variante
**« tropical punch »** du prototype (`proto/`, thème `theme-tropical.css`) qui
en est la source : FF8243 · FFC0CB · FCE883 · 069494. Ses tokens vivent dans
`src/styles/tokens/` et sont **importés tels quels**, jamais recopiés : une
valeur dupliquée finit toujours par diverger. Ils portent les noms du système —
`--mango-400`, `--teal-600`, `--r-l`, `--sp-6`, `--sh-m` — pour qu'une valeur
du document se retrouve dans le code sans traduction.

`globals.css` câble ensuite les variables sémantiques de shadcn/ui dessus —
`--primary` sur `--mango-400`, `--background` sur `--bg`, et ainsi de suite.
Aucun composant ne connaît la marque, ce qui permet de changer l'identité en un
seul fichier. **Ne jamais écrire de couleur en dur.** Trois exceptions,
documentées sur place : `magic-link-email.tsx`, `notifications/gabarit.tsx` et
`seo/og.tsx`, rendus hors du navigateur où les variables CSS n'existent pas.

### Ce que le système impose

Palettes, distribuées par rôle : **sarcelle** (`teal`) porte la profondeur et
la marque — bandes sombres, pied de page, liens, logotype, états sélectionnés ;
**mangue** (`mango`) porte l'action principale ; **ananas** (`pineapple`) les
pilules et les moments de joie ; **papaye** (`papaya`) les surfaces douces —
héros en lever de soleil, panneau de sortie. **Ciel**, **sauge**, **crème**
(réchauffée d'un souffle de papaye) en teintes de soutien, et des neutres
**ink** légèrement teintés vert. Le fond de page est un blanc chaud
(`#fffcf9`) : le tropical est solaire, pas clinique. Les couleurs sémantiques —
succès, alerte, erreur, information — gardent la même teinte quel que soit le
thème.

**L'action principale est passée de la mangue à l'ananas** le 21 août 2026 :
l'orange ressemblait trop à celui d'une plateforme nationale, et le bouton
finissait par ressembler à celui qu'on cherche à ne pas être. `--primary` vaut
donc `--pineapple-300` — le jaune clair de la pastille d'accroche, retenu au
second passage : `400` faisait un bouton plus dense que la joie qu'on cherchait
— le survol et le pressé `--pineapple-400` et `--pineapple-500`, et la lueur
s'appelle `--shadow-action`, le nom disant le rôle et non la teinte pour que la
prochaine bascule ne laisse pas un token qui ment.

**La pastille d'accroche est passée au vert menthe** (`teal-100`), la teinte du
rond de la carte flottante : les deux signes de la même page se répondent au
lieu de répéter le jaune du bouton. `contrast.test.ts` la verrouille à 13,2:1.

**Un écran, un seul bouton jaune.** Il porte du texte encre, jamais du blanc :
11:1 avec l'encre, 1,5:1 avec le blanc — même règle que la mangue qu'il
remplace, et `contrast.test.ts` la vérifie sur les deux nuances. La mangue reste
au système pour les surfaces et les accents, elle ne porte plus l'action. La même règle vaut pour la sarcelle
pleine des états sélectionnés (cases cochées, créneaux retenus) : texte encre.
Pour écrire, une icône ou un trait fin, employer `text-brand` (sarcelle 600),
jamais `text-primary`. `src/styles/contrast.test.ts` verrouille ces couples.

**Toute action est une pilule** — boutons, tags, badges, avatars. Le reste de
l'échelle grandit avec l'élément : 6 px pour une case à cocher, 14 px pour un
champ ou une alerte, 20 px pour une card, 28 px pour un panneau, 36 px pour une
section ou un hero. Aucun angle vif.

Gabarits tactiles : bouton primaire à 48 px, champ à 52 px, case à cocher et
radio à 24 px. Rien qui porte une conversion ne descend sous 44 px.

Typographie : **Alan Sans porte tout le site** depuis le 21 août 2026 — titres,
texte courant et grands chiffres. **Figtree a disparu** : la hiérarchie ne vient
plus de deux familles qui tranchent l'une sur l'autre, mais de la taille et de
la graisse seules. Une famille de moins, c'est aussi une requête réseau de moins
sur le premier écran. **JetBrains Mono** reste pour les chiffres posés — prix,
codes postaux, temps de trajet — parce qu'elle dit autre chose qu'une graisse :
elle aligne. Alan Sans est auto-hébergée (`src/app/fonts/`, `next/font/local`,
absente de `next/font/google`) et préchargée ; jamais l'`@import` Google Fonts du
système, qui bloquerait le rendu. **Fraunces a disparu avec la refonte** :
`.accent-word` ne change plus de plume, il colore le mot en sarcelle.

**L'échelle des graisses a été adoucie**, à la demande du porteur du projet :
Alan Sans en 900 sur un titre de page produisait un bloc noir qui écrasait le
reste, d'autant plus depuis qu'elle porte aussi le texte courant. Les tokens
gardent leurs noms — ils disent la hiérarchie, pas la valeur — et ne pèsent plus
que 700 pour `--fw-black`, 650 pour `--fw-extrabold`, 600 pour `--fw-bold`.
**L'échelle de Tailwind est câblée dessus** (`--font-weight-*` dans `@theme`) :
sans cela `font-black` rendrait 900 quoi que le système décide, et les deux cent
douze classes utilitaires du dépôt diraient le contraire des titres balisés.

Le thème sombre n'est pas défini par le système : celui du projet en est une
dérivation — fonds sarcelle profonde, action mangue — à revoir si le système
en fournit un.

**Ton éditorial**, repris du système : vouvoiement du client, « nous » pour ce
que l'entreprise organise, intervenants nommés par prénom. Phrases courtes, une
idée par phrase, titres de 3 à 7 mots. Capitale de phrase uniquement — les
capitales complètes sont réservées aux surtitres, avec la classe `.overline`.
Typographie française : espace insécable avant les unités et la ponctuation
double.

### Divergences avec le prototype, assumées

- Le symbole reste l'étoile fournie par le client, incrustée en `currentColor`
  — jamais de monochrome sarcelle sur blanc, où le contraste ne tient pas. Le
  pied de page sombre la passe en blanc via la prop `inverse` du logo.
- **Le « −50 % crédit d'impôt » du bandeau de crédibilité du prototype n'est
  pas repris** : il contredit `src/lib/fiscal.ts` tant que la déclaration SAP
  n'est pas obtenue. La quatrième tuile reste « un vrai numéro, quelqu'un
  décroche ».
- Les deux photos du prototype sont reprises sur arbitrage du porteur du
  projet (18 août 2026), en desktop seulement. Elles paraissent générées — à
  faire valider avant une communication publique — et aucune autre image ne
  doit entrer sans le même arbitrage.
- ~~Le prototype ouvre le tunnel sur l'adresse ; le produit garde son écran
  commune.~~ **Divergence levée le 20 août 2026** : le tunnel ouvre lui aussi
  sur l'adresse. Voir « Ordre des écrans du tunnel ».

## Commandes

```bash
npm run dev          # serveur de développement
npm run check        # typecheck + lint + tests unitaires
npm run test         # Vitest
npm run e2e          # Playwright (construit et démarre l'app)
npm run format       # Prettier

npm run db:migrate      # applique une nouvelle migration
npm run db:seed         # remplit la base de développement (tronque tout d'abord)
npm run db:init         # installe une base de production, sans données fictives
npm run db:intervenant  # enregistre un intervenant réel (confirmation exigée)
npm run db:utilisateurs-test # comptes nominatifs, avec mot de passe (refusé en production)
npm run db:roles        # donne des rôles à un compte existant (refusé en production)
npm run db:tarifs       # applique la grille publique aux tarifs en base
npm run test:integration # tests exigeant PostgreSQL + PostGIS
npm run build:demo      # vitrine statique de démonstration dans out/
npm run build:deploiement # migre puis construit — ce que Vercel exécute
```

`npm run typecheck` lance `next typegen` au préalable : les types de routes
(`LayoutProps`, `PageProps`) sont générés et absents d'un dépôt fraîchement
cloné.

## Ce que la chaîne n'a pas encore

Le produit est complet du référencement jusqu'au rendez-vous confirmé. Ce qui
suit est ce qui manque **après** la confirmation, écrit ici pour qu'aucune de ces
absences ne soit redécouverte en production.

**Le produit prend la parole à douze moments.** Le douzième est la **fin
d'intervention**, et il comblait le trou le plus visible de la chaîne : le
ménage se terminait et le client n'entendait plus rien jusqu'au débit, alors que
le rapport photo, la notation et les factures existaient tous sans que rien ne
les annonce.

**Il part à la clôture, donc avant le prélèvement**, qui court à H+24
(arbitrage du porteur du projet, 21 août 2026). Il écrit donc « nous
prélèverons », au futur, et un test interdit « avons prélevé » : annoncer un
débit déjà fait quand il ne l'est pas ferait chercher sur un relevé une ligne
qui n'y est pas, et douter du reste du message. La date vient
d'`instantDePrelevement`, jamais écrite — allonger le délai dans le calendrier
change alors le mail tout seul plutôt que de le laisser mentir.

**La durée réelle y est dite, et aucun second montant ne l'accompagne.** Le
dépôt a tranché qu'elle ne refacture rien ; un deuxième chiffre dans ce mail se
lirait comme un ajustement. Un test vérifie qu'il ne s'y trouve qu'un seul
montant. Le rapport photo n'est mentionné que s'il existe, et le prochain
passage que s'il est réellement pris — annoncer l'un ou l'autre à vide enverrait
chercher des photos qui n'ont pas été prises, ou attendre un jour où personne ne
vient.

**Le crédit d'impôt n'est pas décidé par le composeur.** `creditImpotCents`
vaut `null` tant que `canShowTaxCredit()` l'interdit, et le message n'écrit
alors pas même le mot. Le jour de la déclaration, ce mail change sans qu'on y
retouche — deux tests tiennent les deux directions.

**Le lancement est conditionné à l'obtention de la déclaration SAP** (porteur
du projet, 21 août 2026) : aucun client réel avant elle. Cela ne change rien à
la règle — le drapeau reste la seule vérité, et rien n'est écrit en dur — mais
cela déplace le chemin critique. **La réserve sur le code APE 70.22Z n'est plus
une réserve, c'est le préalable au lancement.**

**Le produit prend la parole à huit moments.** Demande reçue, mission proposée,
intervenant trouvé, mission prise de vitesse, recherche élargie, horaires
alternatifs disponibles, recherche interrompue, rappel de la veille — client et
intervenant, chacun son texte.

`src/lib/notifications/messages.ts` est **pur** : il compose, il n'envoie rien.
Le contenu d'un email est du texte, donc l'endroit où une promesse se glisse le
plus facilement, et le seul que le destinataire garde. Des tests tiennent donc
les règles que le produit tient déjà à l'écran — ne rien confirmer tant que
personne n'a accepté, ne nommer personne avant l'acceptation, ne pas s'excuser
auprès de qui a perdu la course, présenter à égalité l'alternative et la
poursuite de la recherche. L'un d'eux a d'ailleurs attrapé une faute : la
proposition annonçait à l'intervenant le prix client à côté de sa rémunération.

**Une notification qui échoue ne défait pas ce qu'elle annonce.** L'envoi est
appelé après l'écriture, hors transaction, sans être attendu, et son échec est
journalisé sans être propagé. C'est le seul endroit du dépôt où une erreur est
volontairement avalée : une panne de messagerie ne doit pas annuler une
réservation ni faire échouer l'acceptation d'une mission.

**Un seul gabarit visuel pour les huit**, dans `gabarit.tsx`. C'est la deuxième
surface après `magic-link-email.tsx` où les couleurs sont recopiées plutôt que
référencées : un client de messagerie ne lit pas de feuille de styles.

**L'ordonnanceur existe, et il est frappé par un travail planifié.**
`vercel.json` déclare un appel horaire à `/api/taches`, protégée par
`CRON_SECRET` — Vercel l'envoie en `Authorization: Bearer`. La route refuse si
le secret manque, direction inverse de celle retenue pour l'indexation et pour
une raison inverse : un oubli qui désindexe se voit, un oubli qui ouvre un
déclencheur ne se voit pas. Ouverte, elle permettrait de solliciter tous les
intervenants d'un secteur autant de fois qu'on le voudrait.

`src/lib/assignments/echeances.ts` exécute ce que `prochaineEtape` décide, et
rien de plus : la règle reste pure et testable à la milliseconde, l'exécution
reste vérifiable sans rejouer une semaine. Quatre travaux tournent —
élargissement au second lot, main rendue au client quand des horaires
alternatifs existent, arrêt de la recherche au bout d'une semaine, expiration
des propositions et des contre-propositions — plus la purge des compteurs de
débit, qui attendait depuis la phase 13. Chaque demande est traitée séparément :
une erreur sur l'une ne doit pas arrêter les autres.

**Restent deux travaux, tous deux liés au paiement** : la préautorisation à
H-24 et le prélèvement à H+24, plus le reversement hebdomadaire. Ils viendront
avec Stripe, sur la même route.

Les variables Inngest restent déclarées et inutilisées. Le travail planifié de
Vercel suffit à des échéances qui se comptent en heures ; Inngest apportera la
durabilité et les reprises le jour où de l'argent transitera.

**La mission se clôt depuis le 20 août 2026.** `CONFIRMED → IN_PROGRESS →
COMPLETED` s'écrit enfin, avec la durée réelle, l'état du rapport et la clôture
de l'affectation dans une seule transaction — une mission dont le pointage
serait écrit sans que le statut suive laisserait le client sans rapport et
l'intervenant sans reversement.

**Le fil conducteur est que rien ne bloque.** La position est capturée au tap,
jamais en continu, et hors tolérance le pointage est _assumé_ plutôt que refusé
— sous-sol, immeuble mal géocodé, refus de localisation. La checklist est un
mémo, pas un contrôle. Un rapport incomplet ne bloque ni la fin ni le paiement.
Un produit qui empêche de travailler pour protéger une mesure obtient des
mesures fausses.

**La durée réelle ne refacture rien.** Elle est enregistrée, l'écart est
visible, et le montant reste celui qui a été annoncé. Un ajustement passe par
une anomalie validée, et une seule catégorie peut même le proposer : un
supplément appliqué par celui qui en bénéficie n'est pas un ajustement, c'est
une facture non consentie.

**Le rapport photo existe depuis le 20 août**, débloqué par le coffre Scaleway.
Deux avant, deux après, et **rien n'est bloquant** : il ne retient ni la fin de
mission ni le paiement. Un produit qui empêche de travailler pour protéger une
mesure obtient des mesures fausses — quelqu'un photographierait n'importe quoi
pour finir sa journée. La lecture passe par une URL signée de soixante
secondes, et l'appartenance est revérifiée à chaque appel : c'est le seul
endroit où l'on décide qui voit l'intérieur du domicile d'un client.

Restent à écrire : le mode hors ligne, dont le schéma est prêt mais dont la
file d'envoi manque. `NO_SHOW` reste modélisé et non écrit.

**Le stockage objet est tranché : Scaleway Object Storage**, compatible S3 et
hébergé en France — les pièces d'identité ne quittent pas l'Union européenne, ce
qui évite d'avoir à documenter un transfert. `STOCKAGE_PROVIDER` vaut `memoire`
en développement (volatil, et refusé en production) ou `scaleway`. Absent, il
n'y a pas de stockage : les écrans le disent et le dépôt est refusé, plutôt que
d'accepter un fichier qu'on perdrait. **Rien n'est jamais servi en direct** — une
lecture passe par une URL signée de soixante secondes, engendrée à la demande et
jamais mise en cache, une URL signée mise en cache étant une URL publique à
retardement. Réglages du bucket dans
[docs/SECURITE-ACCES.md](docs/SECURITE-ACCES.md).

**Modélisé, seedé, jamais écrit par le produit** : `Payout`,
`CalendarConnection` et `ExternalBusyBlock`. `Invoice` a rejoint le produit le
20 août, avec `InvoiceSequence` et `TaxCertificate`. `Payment`, `Subscription`, `Message` et `WebhookEvent` ont
rejoint le produit les 19 et 20 août. Le
parrainage est le cas le plus trompeur : `src/lib/referral/` est écrit, pur et
testé, sans un seul appelant ni écran. Les tables ne mentent pas sur l'intention,
elles ne disent rien de ce qui est branché.

**Le socle du paiement est posé depuis le 20 août 2026.** SDK installé,
`paiement/calendrier.ts` pur et testé, préautorisation à H-24, prélèvement à
H+24 et libération des autorisations sur mission annulée, plus le webhook
`/api/webhooks/stripe` avec vérification de signature et idempotence par
insertion.

**Une autorisation bancaire expire au bout de sept jours**, et c'est la
contrainte qui gouverne tout le calendrier : la poser à la réservation la
rendrait caduque avant la mission. `autorisationTiendra` vérifie la marge à
chaque préautorisation, et un test échoue si quelqu'un allonge l'un des délais.

**Le prélèvement est conditionné à la clôture, jamais à l'horloge seule** — et
le délai court depuis la clôture réelle, pas depuis l'heure prévue.

**Les relances d'impayé partent depuis le 20 août.** Trois messages — J+1, J+3,
J+7 — puis une suspension **annoncée** : jamais d'annulation silencieuse, qui
ferait découvrir la rupture au client le matin où personne ne vient. La date du
premier échec ne bouge jamais, sans quoi un impayé deviendrait éternel à
condition d'échouer régulièrement. Et la suspension n'annule rien : elle
appelle un humain.

Restent à écrire : Connect Express et les reversements —
dont le calendrier est écrit et testé mais que rien n'appelle. Les reversements
restent à écrire en _separate charges and transfers_, le modèle à deux factures
interdisant le _destination charge_. Rien n'a pu être vérifié contre le vrai
Stripe : les clés vivent chez l'hébergeur, pas en local.

**Le temps de trajet réel non plus.** `TRAVEL_TIME_PROVIDER` accepte
`openrouteservice` et `osrm`, et aucun des deux n'est implémenté : seul le
fournisseur géométrique existe, derrière son cache. Ce n'est pas bloquant —
1,4 minute d'erreur moyenne sur le territoire — mais la variable promet plus que
le code ne tient.

## Avancement

État au 20 août 2026 : **826 tests unitaires** (61 fichiers), **13 suites
d'intégration** exigeant PostgreSQL + PostGIS, **152 tests de bout en bout**. Les
chiffres cités phase par phase datent de leur phase et ne sont pas remis à jour :
ils disent l'effort consenti à ce moment-là.

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
      publiées, 6 pages d'intention secondaire (`/femme-de-menage/<commune>`,
      `/repassage/<commune>`, trois communes chacune), 5 articles de conseil
      dont un retenu jusqu'à la déclaration SAP, JSON-LD complet (dont
      `Article`), robots/sitemap/llms.txt, API publique, pages tarifs et à
      propos, formulaire de rappel, système de design appliqué.
- [x] **Phase 5 — Moteur de disponibilité et de tournée.** Algèbre
      d'intervalles, disponibilité comme source de vérité unique, temps de
      trajet calibré sur des itinéraires réels, coût d'insertion, score
      d'attribution explicable, cache de trajets en base. 78 tests unitaires et
      11 tests d'intégration, dont l'accord entre le moteur et la contrainte
      d'exclusion.
- [x] **Phase 6 — Tunnel de réservation.** Complétion d'adresse BAN avec repli
      en saisie manuelle, devis serveur, choix du créneau, création
      transactionnelle avec attribution automatique et repli sur le candidat
      suivant. 8 tests de bout en bout, 10 tests d'intégration dont la
      concurrence sur un même créneau.
- [x] **Refonte UX, phases 1 à 4 et 6.** Tunnel redécoupé en cinq écrans, une
      décision par écran ; barre de prix permanente ; devis des quatre rythmes
      chargés ensemble ; créneaux préchargés et journées complètes affichées
      barrées ; retour arrière non destructif et reprise de parcours ;
      récapitulatif dont chaque ligne est modifiable ; entrée du tunnel depuis
      l'accueil, les tarifs, l'index des communes et les pages d'intention.
      Journal et fiches d'évidence dans `docs/REFONTE-UX.md`, contrat de
      non-régression dans `docs/FEATURES-FREEZE.md`.
- [x] **Application installable et espace client.** Service worker limité aux
      fichiers versionnés, `/hors-ligne`, invitation d'installation après une
      réservation confirmée, `/mon-espace` sur le lien magique existant.
- [ ] **Phase 7 — Paiement Stripe, partielle.** **Fait** : socle et calendrier,
      préautorisation à H-24, prélèvement à H+24, webhook signé et idempotent,
      enregistrement de carte par session Checkout, **facturation en deux
      documents et attestation fiscale annuelle**. **Manque** : Connect Express
      et les reversements, les relances d'échec.
- [ ] **Phase 8 — Espace intervenant, partielle** _(mise en production visée
      ici)_. **Fait** : missions et propositions, acceptation qui écrit `CONFIRMED`,
      refus qui rejoue l'attribution en écartant ceux qui ont décliné, semaine
      type déclarée par l'intéressé seul. **Manque** : inscription (aujourd'hui
      `npm run db:intervenant`), pièces justificatives, absences, clôture de
      mission, revenus. Et, hors de l'espace, les emails et l'ordonnanceur sans
      lesquels rien ne prévient personne.
- [x] **Phase 8 bis — Tunnel pour utilisateur connu.** `known-client.ts` lit le
      profil, le carnet d'adresses dédoublonné et le dernier choix, sur un
      client cloisonné et sans jamais désigner le profil lu ; le tunnel
      propose les adresses en un geste, présélectionne le dernier logement et
      le dernier rythme, affiche le prix dès le premier écran et résume les
      coordonnées au lieu de les redemander. Six taps depuis l'accueil au lieu
      de onze. Un client de la marketplace n'ayant pas de `Membership`,
      l'autorisation ne peut pas passer par `requireOrganization` — la raison
      est écrite dans le module.
- [ ] Phase 9 — Synchronisation d'agenda externe _(modèles seuls)_
- [ ] Phase 10 — Optimisation des temps de trajet _(interface et cache prêts,
      aucun fournisseur d'itinéraire implémenté)_
- [x] **Phase 11 — Page `/pro/[slug]`.** Société présentée avec ses prestations
      et ses tarifs à elle, catalogue lu sur un client cloisonné, prérendu avec
      `dynamicParams` ouvert. Back-office société toujours repoussé.
- [ ] **Phase 12 — Back-office plateforme, partielle.** Quatre listes de travail
      à faire — réservations sans intervenant, propositions périmées, rappels non
      traités, intervenants à vérifier — derrière `asPlatformAdmin()`. **En
      lecture seule** : aucune action n'est encore proposée depuis l'écran.
- [ ] **Phase 13 — Durcissement et conformité, partielle.** **Fait** : droits
      d'accès et d'effacement avec leurs limites comptables, identité neutralisée
      plutôt que supprimée, limitation de débit en base sur les formulaires
      publics, IP condensée, purge planifiée des compteurs, **et la fermeture de
      la seconde porte** — RLS sur toutes les tables, privilèges retirés à `anon`
      et `authenticated`, test d'intégration qui refuse une table sans RLS.
      **Manque** : les réglages de console Supabase listés dans
      [docs/SECURITE-ACCES.md](docs/SECURITE-ACCES.md) — retirer `public` des
      schémas exposés, vérifier l'absence de clé `service_role` déployée, faire
      tourner le mot de passe de la base — et tout ce qui relève du paiement.
- [x] **Jalon A — Fondations** (plan du 19 août 2026). **Stockage de fichiers** :
      politique pure — nombres magiques plutôt que type déclaré, deux coffres aux
      politiques distinctes, métadonnées retirées par suppression de segments,
      chemin engendré. L'implémentation mémoire applique la même politique que la
      vraie ; le fournisseur distant échoue bruyamment tant qu'il n'est pas
      configuré, direction inverse de `TRAVEL_TIME_PROVIDER`. L'adaptateur
      Scaleway a été écrit le 20 août. **Taxonomie
      d'événements** : `AnalyticsEvent` en base plutôt que chez un tiers, aucun
      cookie, aucune donnée personnelle — la commune est mesurée, les coordonnées
      ne le sont pas — purge à treize mois, et le traçage passe par
      `BookingBackend` pour que la vitrine statique continue de construire.
      **Variante dense** de tropical punch pour la console : espacements, rayons
      et ombres seulement, aucune couleur touchée. **Absences** de l'intervenant.

- [x] **Jalon B — Le prix et la demande** (20 août 2026). Contre-proposition
      d'horaire ouverte dès l'écran de proposition, avec pré-acceptation sous une
      heure d'écart : l'heure demandée l'emporte toujours, rien n'est bloqué en
      base, le prix ne bouge jamais. Majorations samedi +10 %, dimanche et férié
      +25 %, dernière minute +10 % — le jour à l'intervenant, l'urgence à la
      plateforme, fériés calculés et non listés. Captation de la demande hors
      zone, seul signal d'expansion du produit.
- [x] **Jalon C — Le logement.** `Address` porte désormais pièces, consignes,
      animaux, matériel et zones interdites. Le code de porte est chiffré en
      AES-256-GCM et ne se lit que par un module gardien, pour un intervenant
      affecté, entre J-24 h et J+2 h, avec journal des lectures accordées **et**
      refusées. Deux tests gardent la frontière plutôt qu'un comportement.
- [ ] **Jalon D — La mission se termine, partielle.** **Fait** : pointage
      d'arrivée et de départ, checklist, anomalies, passage en `COMPLETED` avec
      durée réelle, écran de travail, écran « Aujourd'hui », notation de bout en
      bout — module pur, écriture transactionnelle, écran client, ticket qualité
      sous trois étoiles. **Manque** : le mode hors ligne, et le branchement du
      dépôt de photos sur Scaleway (l'adaptateur existe, la configuration
      attend le bucket).

- [ ] Refonte UX, phase 5 — espace client (modification, annulation, notation,
      adresses, moyens de paiement, parrainage). La liste des réservations et les
      droits RGPD existent déjà ; le reste **ne peut pas précéder les
      fonctionnalités qu'il refond** — il n'y a rien à annuler tant qu'une
      annulation n'existe pas, rien à noter tant qu'une mission ne se clôt pas.
- [ ] Refonte UX, phase 7 — passe UI. Reportée : elle impliquerait une refonte
      du design system lui-même, pas un placage de palette.

## En attente d'informations

Bloquant à terme, pas immédiatement. Les champs concernés valent `null` dans
`src/lib/site.ts` et sont masqués à l'affichage plutôt que remplis d'un
espace réservé : une NAP incomplète est neutre, une NAP inexacte est pénalisée.

- Numéro de déclaration SAP, pour Léo Clean **et** pour chaque intervenant :
  la facturation en deux lignes suppose deux organismes déclarés. Le dossier
  de Léo Clean est déposé, non instruit ; c'est le récépissé qui manque. C'est
  le seul champ qui bloque encore du contenu écrit — l'article sur le crédit
  d'impôt est prêt et attend la déclaration pour être publié. Le renseigner
  dans `site.ts` et lever `NEXT_PUBLIC_SAP_DECLARED` suffit à activer toutes
  les mentions fiscales du site, sans autre modification.
- Code APE : 70.22Z (conseil) contre la condition d'activité exclusive des
  services à la personne. Arbitrage non tranché.
- Les CGU emploient `bonjour@leoclean.com` : à reprendre deux fois, le domaine
  retenu étant **leoclean.fr** et l'adresse de contact **menage@leoclean.fr**
- L'accord de coresponsabilité de traitement nomme encore Wecasa et
  `bonjour@wecasa.fr` : à reprendre avant toute publication
- Accès **bloquants pour une mise en ligne**, dans cet ordre : une base
  PostgreSQL avec PostGIS et `btree_gist` (Neon ou Supabase, extensions activées
  **avant** la première migration) ; une clé Resend avec le domaine vérifié —
  sans elle les liens de connexion restent dans la console, donc personne ne se
  connecte ; le nom de domaine et ses deux sous-domaines, faute de quoi le
  `noindex` des hôtes `*.vercel.app` ne s'applique pas.
- **Bucket Scaleway Object Storage** et sa clé d'API restreinte à ce seul
  bucket. Sans lui, le dépôt des pièces justificatives et des photos de mission
  reste fermé — les écrans le disent et proposent le téléphone, ils n'acceptent
  pas un fichier qu'ils perdraient. C'est ce qui bloque la fin du dossier de
  candidature en autonomie.
- Accès **non bloquants** : projet Google Cloud (connexion Google, puis
  Calendar), Inngest, OpenRouteService. Chacun dégrade une fonctionnalité
  identifiée, aucun n'empêche le site de fonctionner.
