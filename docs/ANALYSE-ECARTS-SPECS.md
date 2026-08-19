# Analyse d'écarts — corpus de spécifications (18 août 2026) contre le dépôt

Relevé au 19 août 2026, sur le corpus déposé dans `files/` : six documents de
spécification (socle, espace client, espace intervenant, funnel d'inscription,
console d'administration, annexes) et cinq planches de maquettes HTML.

Le corpus a été rédigé sans lire le dépôt. C'est ce qui le rend utile — il dit
ce que le produit devrait être, pas ce qu'il coûterait de l'atteindre — et
c'est aussi pourquoi une partie de ses recommandations sont déjà tenues, une
autre déjà tranchée en sens inverse. Les trois listes qui suivent sont donc
précédées d'un relevé des divergences : **arbitrer avant de développer coûte
beaucoup moins cher qu'arbitrer après.**

---

## 0. Le constat en une phrase

Le corpus et le dépôt sont d'accord sur tout ce qui est difficile — mise en
relation, deux factures, offre acceptable plutôt qu'affectation, rayon court
comme proposition de valeur — et le dépôt est en avance sur le corpus sur la
tarification et le matching. **L'écart est presque entièrement situé après la
réservation confirmée** : rien ne clôt une mission, rien n'encaisse, rien
n'inscrit un intervenant. Ces trois manques expliquent à eux seuls la majorité
des lignes ci-dessous.

---

## 1. Divergences à trancher avant tout développement

Le corpus contredit une décision déjà prise et documentée dans le dépôt. Ces
points ne sont pas des écarts à combler, ce sont des arbitrages.

| Sujet | Dépôt | Corpus | Recommandation |
| --- | --- | --- | --- |
| **Créneau vendu** | heure de départ ferme | plage de 3 h (`08:00-11:00`), ETA resserré à J-24 h | **Tranché le 19 août : le dépôt.** Le client choisit son heure. Le moteur ne restreint pas les heures proposées ; la compaction de tournée passe par la contre-proposition d'horaire de l'intervenant, qui est le seul à connaître sa journée |
| **Encaissement** | préautorisation H-24, prélèvement H+24 | empreinte à la réservation (SetupIntent), débit J+1 après réalisation | **corpus** — « vous ne payez qu'après le passage » est un argument de conversion, et un SetupIntent n'expire pas au bout de 7 jours comme une autorisation |
| **Authentification** | lien magique e-mail + Google | OTP SMS client/intervenant, TOTP admin | **corpus pour l'intervenant** (mobile, terrain), à condition de budgéter un fournisseur SMS ; le lien magique reste défendable côté client |
| **Crédit d'impôt** | rien ne s'affiche tant que la déclaration SAP n'est pas obtenue | prix après crédit d'impôt mis en avant dans le funnel | **dépôt, impérativement** — le corpus écrit lui-même le risque de pratique commerciale trompeuse ; c'est `fiscal.ts` qui a raison |
| **Parrainage** | 5 % du CA du filleul, dès sa 5ᵉ mission, 12 mois, plafond 150 €/mois | 20 €/20 € croisés, plafond 200 €/an | à trancher — le dépôt est déjà écrit et verrouillé par ses tests, le corpus est plus lisible en acquisition |
| **Commission** | écart en €/h (5 € en régulier, 9 € en ponctuel) | 22 % HT | **dépôt** — la rémunération est un montant accepté avant la mission, pas un pourcentage prélevé après |
| **Majorations** | aucune | samedi +10 %, dimanche/férié +25 %, réservation < 48 h +10 % | **corpus** — le dépôt facture aujourd'hui un dimanche au prix d'un mardi |
| **Périmètre** | 16 communes en dur | isochrone 20 min paramétrable par commune | **dépôt** — le territoire est fixe et la régression de trajet est calibrée sur lui |
| **Rythme mensuel** | retiré du tunnel (l'entretien courant n'en est plus un) | proposé comme 3ᵉ carte | **dépôt** |
| **Multi-tenant** | extension Prisma imposée par le data layer | RLS Postgres / Supabase | **dépôt** — écrit, testé, et le DMMF garantit qu'aucun modèle n'échappe au périmètre |
| **Design** | tropical punch (mangue / sarcelle) | papier + Signal Green, deux thèmes | **dépôt pour la marque**, mais retenir du corpus le **thème `ops` dense** pour la console : le thème consumer y est un mauvais outil |
| **Estimation de durée** | 25 m²/h | 30 m²/h + coefficient de fréquence | à trancher — écart de 20 % sur la durée vendue, donc sur le prix |

---

## 2. Ce qui est déjà en place

Le corpus décrit ces points comme à construire ; ils sont livrés, et souvent
au-delà de ce qu'il demande.

**Thèse produit et garde-fous juridiques.** Le rayon court est déjà le
mécanisme central : le score d'attribution donne 0,40 au trajet et 0,25 à la
continuité (`scheduling/scoring.ts`). Cinq des sept garde-fous anti-requalification
du corpus (`00 § 2.2`) sont tenus par le code, dont le plus fort : la capacité
`availability:manage:own` n'est détenue par **aucun** rôle de gestion, donc
personne ne peut imposer un créneau à un indépendant. Le refus de mission
n'entraîne aucune pénalité, et la copy de `/travailler-avec-nous` est verrouillée
par un test lexical anti-vocabulaire d'affectation.

**Modèle économique.** Les deux factures du corpus (modèle B) sont déjà le
modèle du dépôt : `professionalAmountCents` / `platformFeeAmountCents` /
`commissionRateBp`, le crédit d'impôt calculé facture par facture, et
`EngagementMode` qui joue exactement le rôle du flag `BUSINESS_MODEL` proposé.

**Attribution.** La recommandation n° 2 du corpus — offre acceptable plutôt
qu'assignation — est implémentée, et plus solidement qu'écrit : diffusion par
lots de cinq, quatre minuteries pures et testées à la milliseconde
(`assignments/diffusion.ts`), et la course tranchée par deux contraintes
PostgreSQL (`Assignment_no_overlap`, `Assignment_one_accepted_per_booking`)
plutôt que par du code applicatif.

**Tarification.** Moteur pur, grille publique source unique, barème d'annulation
à six paliers, répartition qui additionne toujours exactement au total,
`npm run db:tarifs` pour propager une grille sans réécrire les réservations
passées.

**Disponibilité et tournée.** Algèbre d'intervalles, bornes `[start, end)`,
tampons de trajet non franchissables, accord vérifié entre le moteur et la
contrainte SQL. Le corpus suppose Mapbox Matrix ; le dépôt s'en passe avec une
régression calibrée sur quinze itinéraires réels (erreur moyenne 1,4 min).

**Tunnel client.** Six écrans, prix avant compte, reprise de parcours,
créneaux de repli, ICS, chaque écran écrit dans l'historique du navigateur.
Le critère d'acceptation `01 § 14.1` (prix en ≤ 4 interactions) est tenu.

**Espace client.** Réservations, annulation avec le coût annoncé **avant**
confirmation (`01 § 14.4` tenu), chat, réponse aux contre-propositions
d'horaire, droits RGPD d'accès et d'effacement avec leurs limites comptables.

**Espace intervenant.** Propositions, acceptation qui écrit `CONFIRMED` dans
une transaction, refus qui rejoue l'attribution, semaine type déclarée par
l'intéressé seul, dossier avec contrôle de Luhn sur le SIRET et recoupement
SIREN ↔ numéro SAP.

**Back-office.** Quatre files de travail derrière `asPlatformAdmin()`.

**Notifications.** Huit moments, composeurs purs et testés, gabarit visuel
unique, envoi hors transaction dont l'échec ne défait rien.

**Ordonnanceur.** `/api/taches` horaire protégée par `CRON_SECRET`, cinq
travaux : élargissement, main rendue au client, arrêt de la recherche,
expiration des propositions, purge des compteurs de débit.

**Acquisition.** Ce que le corpus ne couvre pas du tout et qui est le plus
avancé du dépôt : 16 pages communes, pages d'intention, blog, `llms.txt`,
JSON-LD, cartes de partage générées, `noindex` sur tout hôte non déclaré.

---

## 3. Existant mais non fonctionnel

Le modèle de données est là, la logique parfois aussi ; personne ne l'écrit ni
ne le lit. Ce sont les gains les moins chers du dépôt.

| Élément | Ce qui existe | Ce qui manque |
| --- | --- | --- |
| **`AvailabilityException` — absences** | le moteur les lit et les fait gagner sur les ouvertures exceptionnelles | **rien ne les écrit.** Un intervenant en congé reçoit des missions. Un écran, une server action. **Le gain le plus rentable du dépôt.** |
| **`Subscription`** | modèle complet : fréquence, jour, plage, intervenant titulaire, pause | `createBooking` n'en écrit jamais. Le tunnel vend un rythme que rien ne matérialise |
| **`Review`** | modèle, `FACTS.hasReviews`, `<Avis />` en place et muet, `aggregateRating` gardé | rien ne demande d'avis — parce que rien ne clôt une mission |
| **`Invoice`** | numérotation par organisation, deux émetteurs, part éligible au crédit d'impôt | aucune facture n'est émise |
| **`Payment` / `Payout`** | statuts pensés pour la capture différée et le reversement | le SDK Stripe n'est pas installé |
| **`CleanerDocument`** | 4 types, statuts, expiration, vérificateur, `activationState` qui dérive ce qui manque | aucun upload, aucun stockage de fichiers, `fileUrl` que personne ne remplit |
| **`Message`** | envoi et lecture côté client | l'intervenant n'a pas d'écran de messages, l'exploitation non plus |
| **`CalendarConnection` / `ExternalBusyBlock`** | lus par le moteur de disponibilité | aucun OAuth Google, rien ne les crée |
| **`ReferralCode` / `Referral` / `ReferralReward`** | règles pures et testées, rattachement d'un parrain côté intervenant | aucun écran client, aucun versement, aucune détection d'abus |
| **`AuditLog`** | table présente, `scopeTo()` journalise les accès transverses | aucune décision d'exploitation n'y écrit — il n'y a pas encore de décision d'exploitation |
| **`WebhookEvent`** | table d'idempotence | aucun webhook |
| **`IN_PROGRESS` / `COMPLETED` / `NO_SHOW` / `DISPUTED`** | modélisés | jamais écrits. C'est le chaînon manquant du service |
| **`TravelTimeCache` + `TRAVEL_TIME_PROVIDER`** | interface, cache en base, repli géométrique | `openrouteservice` et `osrm` sont annoncés par la variable, aucun n'est implémenté |
| **`EngagementMode.MANDATAIRE`** | modélisé | non implémenté, assumé |

---

## 4. Bribes — il faut du développement complémentaire

Le socle est bon, la surface manque.

**Console d'administration.** Quatre listes en lecture seule contre le poste de
pilotage du corpus. Il manque : le Radar (timeline du jour par intervenant,
couverture, CA jour), la file d'actions avec SLA en compte à rebours et états
terminaux tracés, **toutes les actions** (réaffecter, geste commercial, mettre
en pause, valider un dossier), la palette `⌘K`, le panneau latéral contextuel,
et le thème `ops`. Le socle — `chargerTableauDeBord`, `asPlatformAdmin()`,
`AuditLog` — est le bon.

**Espace intervenant.** Une liste de missions contre l'écran « Aujourd'hui »
du corpus. Il manque : la carte « Maintenant » avec CTA collant, l'itinéraire
en lien profond, les trous de tournée avec leur lien de remplissage, le bilan
du jour, l'ordre de tournée suggéré, les revenus (relevé, export CSV, jauge de
plafond micro-entreprise, échéance URSSAF), les messages, le profil public.

**Espace client.** Il manque l'accueil « prochaine intervention » avec le suivi
du jour J (J-24 h, ETA resserré, en route, arrivée, terminé), la fiche
logement, l'abonnement, les factures, le parrainage, la notation, la
réclamation, les préférences de notification par canal et par type.

**Notifications.** Huit moments, e-mail seulement. Il manque le push (VAPID),
le SMS, les préférences par canal et par événement, la fenêtre 7 h–21 h, le
regroupement, le journal de délivrabilité. C'est une couche de routage à
écrire, pas un fournisseur à brancher.

**Dossier de conformité.** `activationState` dérive déjà ce qui manque à un
dossier — c'est la bonne architecture. Il manque l'upload, le suivi
d'expiration, les relances J-45/15/3/0, la mise en pause à échéance avec son
chemin de régularisation.

**Chat.** Pas de temps réel, pas de pièce jointe, pas de réponses rapides, pas
de fermeture automatique à 72 h, pas de détection de contournement, pas de fil
« Léo Clean ».

**Mode hors-ligne.** Le service worker ne met en cache que `/_next/static/`,
délibérément. Le cycle de mission hors ligne du corpus (`02 § 9`) — check-in,
checklist, file de photos, fusion au dernier écrit — n'existe pas, et ne peut
pas exister avant le check-in lui-même.

**RGPD.** Accès et effacement faits, avec leurs limites comptables assumées.
Il manque la rétention automatique (comptes 3 ans, photos 13 mois, géoloc
13 mois), le registre des traitements, le journal d'accès aux documents.

**Rôles.** Cinq rôles, capacités explicites, meilleure architecture que
l'échelle unique. Il manque `recruteur`, `support` et `lecture`, les plafonds
de geste commercial par rôle, et le TOTP administrateur.

**Captation hors zone.** Le tunnel rend structurellement impossible une
réservation hors zone — c'est un bon choix. Mais rien ne capte la demande hors
zone, donc le produit n'a **aucun signal d'expansion**. Ajout petit, levier
grand.

---

## 5. Inexistant

Rien dans le dépôt ne s'en approche.

**1. Le funnel d'inscription intervenant (`/rejoindre`).** Aujourd'hui : un
`Lead` et `npm run db:intervenant`. Le corpus en fait dix étapes et quatre
branches, dont deux parcours d'accompagnement longs (création d'auto-entreprise,
déclaration SAP sur NOVA) qui gardent le lien pendant deux à six semaines. Il
faut : un modèle `ProApplication` avec ses quinze statuts et son journal
d'événements, la vérification SIRET par l'API Sirene, la prise de créneau
d'entretien, la signature électronique horodatée (CGU, charte, mandat de
facturation), et l'anti-fraude par recoupement téléphone / IBAN / SIRET /
appareil. **C'est le plus gros chantier neuf, et le corpus a raison d'en faire
l'avantage concurrentiel : le candidat sans SIRET n'est pas disqualifié, c'est
un candidat à quatre semaines.**

**2. La vie de la mission après confirmation.** Check-in et check-out
géolocalisés au tap (tolérance 150 m, jamais bloquants, repli par code client),
checklist par pièce, rapport photo avant/après, anomalies typées, durée réelle,
signature client optionnelle, passage en `COMPLETED`. Sans cela : pas de
facture, pas d'avis, pas de reversement, pas de passage suivant.

**3. Le paiement.** Stripe entier : SetupIntent, capture différée, Connect
Express, reversements, relances d'échec échelonnées, webhooks idempotents.

**4. Le stockage de fichiers.** Il n'y en a aucun. Photos de mission, pièces
d'identité, PDF de factures : rien n'a d'endroit où vivre. **Prérequis des
points 1, 2 et 3.** Avec sa politique : buckets séparés, URL signées de
60 secondes, EXIF de géolocalisation strippé, ré-encodage, journal d'accès.

**5. La fiche logement.** `Address` est un point postal. Le corpus décrit un
logement : type, pièces, salles de bain, accès typé, **code d'accès chiffré et
exposé seulement de J-24 h à J+2 h à l'intervenant affecté**, zones interdites,
animaux, allergies, produits et matériel disponibles, checklist par défaut,
journal de remise de clés signé des deux côtés.

**6. Réclamations et litiges.** Modèle, catégories, SLA de 24 h ouvrées,
escalade immédiate et non automatisée pour sécurité et vol allégué, gestes
commerciaux tracés, suivi des sinistres d'assurance.

**7. La notation.** Cinq étoiles et tags en deux taps, ouverture automatique
d'un ticket qualité en dessous de 3.

**8. L'attestation fiscale annuelle.** Générée en janvier N+1. C'est le pivot
de conversion du segment senior, et la seule chose qui rende le crédit d'impôt
réel tant que l'avance immédiate n'existe pas.

**9. Les scores de pilotage.** `mission_risk`, `client_churn`,
`pro_reliability`, `application_score` — bornés 0-100, **décomposition
affichée**, action associée. Le dépôt a déjà le bon modèle avec
`Assignment.scoreBreakdown` ; il s'agit de le répliquer sur quatre autres
objets.

**10. L'instrumentation et le module Frictions.** Il n'existe **aucun
événement analytique** dans le dépôt. Toute la taxonomie du corpus
(`05 § 4`), les objectifs de conversion du funnel, les détecteurs de friction
et les scores de churn en dépendent.

**11. L'inbox d'exploitation multicanal**, macros, SLA, files, consolidation
des SMS entrants et des e-mails.

**12. Le CRM 360**, client et intervenant : timeline unifiée, segments,
playbooks de rétention, campagnes de réactivation plafonnées.

**13. Le module Zones** : heatmaps de demande et d'offre, ouverture et
fermeture de commune, plancher tarifaire local.

**14. Planning et capacité** : grille intervenants × créneaux sur quatre
semaines, détection des trous de couverture, simulation.

**15. Léo Academy**, formation, suivi de complétion, deux modules obligatoires
avant activation — en cadrant sécurité et qualité, jamais méthode d'exécution.

**16. Le simulateur de revenus intervenant** (étape 0 du funnel).

**17. Le proxy téléphonique** — aujourd'hui, appeler signifie divulguer un
numéro personnel.

**18. La bibliothèque de composants** que tout le reste suppose :
`PhotoUploader`, `SignaturePad`, `DocumentSlot`, `ChatThread`, `Timeline`,
`RatingInput`, `MapRadius`. `PersonCard` et `DateSlotPicker` existent
partiellement (`IntervenantCard`, sélecteur du tunnel).

---

## 6. Ce qui exige une refonte conséquente du backend

Sept chantiers ne s'ajoutent pas au dépôt : ils en modifient des invariants.

**1. ~~Le créneau de trois heures~~ — retiré le 19 août.** Le client garde son
heure ferme. Ce chantier disparaît donc du plan, et avec lui la seule refonte
qui touchait `Booking`, `findSlots` et la contrainte d'exclusion. Ce qui reste
est un déclencheur à déplacer, pas une refonte : ouvrir la contre-proposition
d'horaire dès l'écran de proposition de l'intervenant, au lieu d'attendre que la
recherche ait échoué. Voir le plan, lot B1.

**2. L'abonnement devient la source de vérité du planning.** Aujourd'hui une
réservation est un point isolé. Le corpus en fait une série pilotée par un
`Subscription` avec titulaire, générateur de récurrence à J+21, pause,
résiliation avec enquête de motif. L'inversion — `Subscription` → `Booking` et
non l'inverse — touche `createBooking`, le moteur, le tunnel, l'espace client
et la facturation.

**3. Le logement devient une entité.** `Address` → `Property`. Migration de
données, réécriture du dernier écran du tunnel, et surtout **une nouvelle
surface de sécurité** : chiffrement applicatif des codes d'accès, fenêtre
d'exposition J-24 h → J+2 h, journal d'accès. C'est le seul moyen d'honorer le
critère `01 § 14.3`, qui exige un test automatisé sur les réponses d'API et
les journaux.

**4. Le paiement redéfinit la machine à états.** Empreinte à la réservation
puis débit à J+1 après réalisation n'est pas la même chose que préautorisation
H-24 et prélèvement H+24. Ni la même exposition à l'impayé, ni les mêmes
transitions. **À trancher avant d'écrire la première ligne de Stripe.**

**5. La mission devient un objet de travail.** Quatre tables nouvelles
(check-in, checklist, photos, anomalies), un stockage, une file d'upload
résiliente, une politique de rétention. Et la durée réelle rétroagit sur la
facturation, alors que le moteur de prix est aujourd'hui purement
prévisionnel : facturer `actual_minutes` change le contrat avec le client.

**6. La candidature est un état durable, pas un formulaire.** Quinze statuts,
deux branches d'attente de une à quatre semaines, relances contextuelles, SLA
de revue. **C'est là que le dépôt paiera l'absence d'Inngest** : un cron Vercel
horaire suffit à des échéances qui se comptent en heures, pas à un pipeline de
relances sur vingt-huit jours avec reprises et durabilité.

**7. L'instrumentation.** Poser la taxonomie d'événements est le seul chantier
dont **le coût augmente chaque semaine où il n'est pas fait** : ce qui n'est pas
mesuré aujourd'hui ne sera pas rattrapable demain. Le module Frictions, les
objectifs de conversion et les scores de churn en dépendent tous.

---

## 7. Séquencement recommandé

L'ordre est contraint par les dépendances, pas par l'envie.

**Préalable, une demi-journée.** Trancher les trois divergences coûteuses :
créneau de 3 h, modèle d'encaissement, règles de parrainage. Écrire la
décision dans `CLAUDE.md`.

**Transverse, à démarrer tout de suite.** La taxonomie d'événements. Elle ne
bloque rien et tout ce qui suit en dépend.

**Jalon 1 — fermer la boucle opérationnelle.** Stockage de fichiers, absences,
check-in / check-out, rapport de mission, passage en `COMPLETED`, notation,
écran « Aujourd'hui » de l'intervenant. **Sans ce jalon, le service ne tourne
pas au quotidien** — et il ne dépend d'aucun tiers sauf le stockage.

**Jalon 2 — l'argent.** Stripe, factures, reversements, attestation fiscale,
relances d'échec.

**Jalon 3 — le recrutement.** Funnel `/rejoindre`, branche « SIRET existant »
d'abord (elle sert dès le premier candidat), branche « création
d'auto-entreprise » ensuite.

**Jalon 4 — la récurrence.** `Subscription`, générateur, pause, résiliation
avec enquête. C'est ce qui transforme des réservations en revenu prévisible.

**Jalon 5 — le pilotage.** File d'actions avec SLA, scores décomposés, CRM 360,
inbox, frictions. À faire quand il y a assez de volume pour que ces écrans
disent quelque chose — pas avant.

**Hors séquence, à faire quand l'occasion se présente** : la captation hors
zone (une table, un formulaire, et le seul signal d'expansion du produit).
