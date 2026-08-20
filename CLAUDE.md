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
  à 25 m²/h, +30 min par option.
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
client choisit son adresse, voit son prix, choisit son heure et repart avec un
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

### L'accueil raconte pourquoi le rayon est court

**La thèse du site est que le périmètre est petit exprès.** Léo Clean vend
l'inverse d'une plateforme : là où l'argument national est l'échelle et le
choix, le nôtre est qu'une vingtaine de minutes de route est la limite qui
rend tenable « la même personne chaque semaine ». Ce n'est pas une faiblesse à
excuser ni une couverture en construction, c'est le mécanisme. La phrase qui
le dit ouvre désormais la page au lieu d'être enterrée en milieu de parcours.

**L'ordre des blocs découle de là**, repris du prototype à la refonte d'août
2026 : thèse (avec la réassurance sous le geste), preuves chiffrées,
paragraphe d'identité, quatre prestations, offre à deux tarifs, déroulé sur la
bande sombre — qui raconte la diffusion par lots réelle, plus l'attribution
d'avant —, comparatif des modèles, engagements (« Ce que ça change chez
vous », fusion des anciennes promesses et du bloc de confiance), communes,
conseils lus dans `blog.ts`, questions fréquentes aux chiffres dérivés du
barème, formulaire de contact (le `LeadForm` de `/etre-rappele`, distingué par
son `sourcePath`), sortie. Le visiteur comprend _pourquoi_ avant qu'on lui
demande _où_ — l'accueil s'ouvrait auparavant sur « Où habitez-vous ? » et
seize liens, soit un effort de sélection réclamé avant le premier argument.
Les engagements précèdent les communes, seule entorse à l'ordre du prototype :
le test de la page impose qu'aucun lien commune n'apparaisse avant les
conséquences de la thèse.

**Les seize communes n'ont pas disparu, elles ont changé de fonction.**
Placées en fin de page et groupées en deux familles, chaque pastille portant
son temps de trajet, elles ne sont plus un menu mais la preuve de la thèse.
Aucun lien interne n'est perdu et `src/app/page.test.tsx` le vérifie sur le
HTML rendu, pas sur les constantes : une donnée juste qui n'atteint pas la
page ne vaut rien.

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
d'engagements signés tient ce rôle : une promesse vérifiable, tenue par
quelqu'un dont le nom et le numéro sont sur la page, ce qui est la seule forme
de confiance qu'un service neuf peut offrir honnêtement. `<Avis />` est en
place et muet, gardé par `FACTS.hasReviews` — le même drapeau que le
`aggregateRating` du JSON-LD.

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

**La page n'est ni indexée ni annoncée tant qu'elle est incomplète.**
`PENDING_INTERVENANT_FIELDS` suit la convention de `PENDING_IDENTITY_FIELDS` :
tant qu'il manque une valeur — la rémunération nette au premier chef — la
page porte `noindex`, reste hors du sitemap et de `llms.txt`, et aucun lien ne
la désigne depuis l'en-tête, le pied de page ou l'accueil. Elle reste
atteignable par son URL, pour être relue. Se classer sur « missions ménage
Gironde » sans pouvoir dire ce qu'on paie ferait venir exactement les gens
qu'on décevrait.

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

## Ordre des écrans du tunnel

**Plus une information coûte à donner, plus tard on la demande.** C'est la
seule règle, et elle décide de tout l'ordre. Le tunnel demandait auparavant
l'adresse complète en premier et n'affichait le prix qu'à la fin : friction
maximale au moment où l'engagement est minimal.

Six écrans : commune, durée, rythme, créneau, coordonnées, adresse. La
commune suffit à répondre « intervenez-vous chez moi ? » et à chercher des
créneaux ; le prix apparaît au troisième, avant toute donnée personnelle ;
l'adresse exacte, la plus coûteuse à donner, arrive en dernier et emporte le
récapitulatif avec elle.

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

**Chercher des créneaux depuis un centre de commune impose une marge de
trajet.** `COMMUNE_TRAVEL_MARGIN_MINUTES` élargit les deux tampons de route
tant que l'adresse exacte est inconnue : ce qui est proposé doit rester tenable
une fois l'adresse donnée, sinon la réservation échouerait au dernier écran,
après que tout a été rempli. La marge ne rend jamais un créneau plus facile,
seulement plus rare — et `createBooking` réévalue de toute façon sur l'adresse
réelle, en essayant le candidat suivant si le premier ne tient plus.

**Le stockage local ne contient ni adresse ni coordonnées** — une commune, une
surface, un rythme, une heure, sept jours durant. L'ancienne version y laissait
l'adresse du domicile, ce que la reprise n'exige pas.

**L'URL porte la commune, la surface et l'écran**, et rien d'autre : une barre
d'adresse se partage, s'enregistre en favori et se retrouve dans les journaux
d'un serveur. Elle est relue côté serveur au premier rendu, et l'écran est
ramené à ce que les choix connus rendent atteignable — une URL bricolée à la
main n'ouvre pas un écran de créneaux sans durée à chercher.

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
| Accueil → réservation confirmée        | ≤ 9   | **10** |
| Accueil → appel téléphonique           | ≤ 2   | 1      |
| Reprise → confirmation (dernier écran) | ≤ 4   | 4      |

**Les deux premiers parcours ont coûté un geste à la refonte narrative de
l'accueil**, et c'est un arbitrage assumé, pas une dérive. Le bloc « Où
habitez-vous ? » répondait de la commune dès l'accueil, si bien que le tunnel
s'ouvrait sur le logement ; l'accueil n'ayant plus qu'un bouton « Réserver »
sans paramètre, le tunnel s'ouvre désormais sur son premier écran. Le prix
apparaît donc au troisième geste au lieu du deuxième, et la réservation au
neuvième au lieu du huitième. Les deux plafonds tiennent, mais **il ne reste
plus de marge sur le second** : tout écran ajouté au tunnel dépasserait la
cible, et c'est la cible qu'il faudrait alors rediscuter, pas la mesure qu'il
faudrait arrondir.

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

**Ce qui n'y est pas, et pourquoi c'est bloquant pour la production** :
l'inscription (un intervenant s'enregistre par `npm run db:intervenant`), le
dépôt des pièces justificatives, la clôture d'une mission et le suivi des
revenus.

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

**L'écran est en lecture seule** : il désigne le travail, il ne le fait pas
encore. Rattraper une réservation orpheline ou relancer une proposition périmée
se fait aujourd'hui à la main.

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
    paiement/          calendrier — pur ; stripe.ts et travaux.ts exécutent
    administration/    tableau de bord plateforme, ce qui attend un humain
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

**La mangue pleine ne sert qu'à l'action principale : un écran, un seul bouton
mangue.** Elle porte du texte encre, jamais du blanc — à 400, elle ne tient pas
le contraste ; sa lueur est `shadow-mango`. La même règle vaut pour la sarcelle
pleine des états sélectionnés (cases cochées, créneaux retenus) : texte encre.
Pour écrire, une icône ou un trait fin, employer `text-brand` (sarcelle 600),
jamais `text-primary`. `src/styles/contrast.test.ts` verrouille ces couples.

**Toute action est une pilule** — boutons, tags, badges, avatars. Le reste de
l'échelle grandit avec l'élément : 6 px pour une case à cocher, 14 px pour un
champ ou une alerte, 20 px pour une card, 28 px pour un panneau, 36 px pour une
section ou un hero. Aucun angle vif.

Gabarits tactiles : bouton primaire à 48 px, champ à 52 px, case à cocher et
radio à 24 px. Rien qui porte une conversion ne descend sous 44 px.

Typographie : **Alan Sans** porte les titres et les grands chiffres — la
famille tranche, la graisse gradue (900 pour les titres de page, 800 en
dessous). **Figtree** reste la famille de lecture, **JetBrains Mono** celle des
chiffres posés — prix, codes postaux, temps de trajet. Alan Sans est
auto-hébergée (`src/app/fonts/`, `next/font/local`, absente de
`next/font/google`), les deux autres viennent de `next/font/google` — jamais
l'`@import` Google Fonts du système, qui bloquerait le rendu. **Fraunces a
disparu avec la refonte** : `.accent-word` ne change plus de plume, il colore
le mot en sarcelle.

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
- Le prototype ouvre le tunnel sur l'adresse ; le produit garde son écran
  commune (même fonction, la couverture se dit tout de suite) et l'adresse
  exacte reste au dernier écran, conformément à « plus une information coûte à
  donner, plus tard on la demande ».

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
npm run db:utilisateurs-test # comptes nominatifs pour parcourir les espaces
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

**Modélisé, seedé, jamais écrit par le produit** : `Payout`, `Invoice`,
`Review`, `Referral` et `ReferralCode`, `CalendarConnection` et
`ExternalBusyBlock`. `Payment`, `Subscription`, `Message` et `WebhookEvent` ont
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

Restent à écrire : l'empreinte à la réservation (SetupIntent dans le tunnel,
sans laquelle la préautorisation n'a aucune carte à débiter), Connect Express et
les reversements, les factures, l'attestation fiscale et les relances d'échec —
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

État au 20 août 2026 : **675 tests unitaires** (49 fichiers), **10 suites
d'intégration** exigeant PostgreSQL + PostGIS, **75 tests de bout en bout**. Les
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
- [ ] Phase 7 — Paiement Stripe _(non commencée : ni SDK, ni routes de webhook,
      ni clés)_
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
