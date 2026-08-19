# 04 — Console d'administration `/admin`

Thème `ops` : panneau d'instruments, rayon 0, JetBrains Mono sur toute donnée, densité 4 pt, aucune ombre, séparations au filet 1 px. Utilisable au clavier de bout en bout.

**Principe directeur** : ce n'est pas un outil de reporting, c'est un **poste de pilotage**. La question à laquelle il répond en 10 secondes, chaque matin, est : *qu'est-ce qui va casser aujourd'hui, et qui est en train de partir ?* Toute métrique qui ne débouche pas sur une action est retirée.

## 1. Architecture de l'interface

```
┌──────────────────────────────────────────────────────────────────────┐
│ LÉO CLEAN · OPS        ⌘K  ·  🔴 3 critiques  ·  ⚠ 7 à traiter  · PD │  barre fixe 44px
├────────────┬─────────────────────────────────────────────────────────┤
│ SALLE      │                                                          │
│ Radar      │                   ZONE DE TRAVAIL                        │
│ File       │                                                          │
│ ─────────  │                                                          │
│ EXPLOIT.   │                                                          │
│ Missions   │                                                          │
│ Planning   │                                                          │
│ Zones      │                                                          │
│ ─────────  │                                                          │
│ RELATION   │                                                          │
│ Clients    │                                                          │
│ Intervent. │                                                          │
│ Recrutmt.  │                                                          │
│ Inbox      │                                                          │
│ Qualité    │                                                          │
│ ─────────  │                                                          │
│ PILOTAGE   │                                                          │
│ Finance    │                                                          │
│ Frictions  │                                                          │
│ Parrainage │                                                          │
│ Réglages   │                                                          │
└────────────┴─────────────────────────────────────────────────────────┘
```

- **Palette de commandes `⌘K`** : navigation, recherche universelle (client, intervenant, mission, n° de facture, téléphone, adresse), et **actions** (`réaffecter mission`, `créer geste commercial`, `mettre en pause un compte`, `valider un dossier`). C'est l'accélérateur principal pour un opérateur unique.
- **Volet latéral droit contextuel** : toute entité s'ouvre dans un panneau glissant, jamais dans une nouvelle page — on ne perd pas le contexte de la file d'actions.
- **Mobile admin** : version réduite mais réelle (Paul pilote depuis son téléphone). Trois écrans seulement : Radar, File d'actions, Inbox. Le reste redirige vers « à consulter sur ordinateur ». Mieux vaut trois écrans excellents que quinze tableaux illisibles.

## 2. Radar — écran d'accueil

Quatre bandes verticales, du plus urgent au plus structurel.

### Bande 1 — Signaux critiques (rouge, n'affiche rien s'il n'y a rien)
Cartes compactes, une action primaire par carte :

| Signal | Déclencheur | Action primaire |
|---|---|---|
| Mission non couverte | `UNCOVERED` ou `PENDING_MATCHING` à H-48 | *Élargir la diffusion* / *Appeler un intervenant* / *Proposer un report* |
| Check-in manquant | Aucun check-in à H+20 | *Appeler l'intervenant* (clic-to-call) |
| No-show intervenant | Aucun check-in à H+40 | *Prévenir le client + geste* (workflow pré-rempli) |
| Litige ouvert non traité | Réclamation > 12 h sans réponse | *Ouvrir le dossier* |
| Réclamation « vol » ou sécurité | Immédiat | *Traiter maintenant* — jamais snoozable |
| Paiement échoué 3ᵉ tentative | Stripe | *Appeler le client* |
| Conformité expirée en mission | Doc obligatoire expiré avec mission à venir | *Réaffecter ou régulariser* |

### Bande 2 — Journée en cours (barre de vitalité)
Une seule ligne dense, en monospace :

```
AUJOURD'HUI  ·  14 missions  ·  ✅ 6 terminées  ·  🔵 2 en cours  ·  ⏳ 6 à venir
             ·  couverture 100 %  ·  retards 1  ·  0 non couverte  ·  CA jour 892 €
```

Sous cette ligne, une **timeline horizontale** de la journée (7 h → 21 h) avec un rail par intervenant actif, blocs de missions colorés par état, trous visibles. Survol = détail, clic = panneau mission. C'est la vue qui remplace un tableau de 40 lignes.

### Bande 3 — Risques à horizon 7 jours
Trois tuiles, chacune une liste de 5 éléments maximum avec score :

| Tuile | Contenu | Tri |
|---|---|---|
| **Missions à risque** | Score de risque ≥ 50 (§ 8.1) | Score décroissant |
| **Clients à risque de départ** | Score de churn ≥ 60 (§ 8.2) | Score × valeur annuelle |
| **Intervenants fragiles** | Fiabilité en baisse, sous-charge, docs expirants, note en chute | Impact sur la couverture |

Chaque ligne : entité, score en monospace, **motif en langage clair** (« 3 annulations en 60 jours, note passée de 4,8 à 4,1 »), action suggérée. Un score sans motif lisible est inutilisable — c'est la règle qui gouverne tout le module.

### Bande 4 — Frictions détectées (7 jours)
Extrait du module Frictions (§ 7) : 3 anomalies de parcours maximum, avec ampleur chiffrée. Ex. `Étape 6 du funnel intervenant : 41 % d'abandon (+14 pts vs 30 j) — cause probable : refus RC Pro`.

## 3. File d'actions — l'inbox d'exploitation

Une seule liste, tout ce qui exige une décision humaine, quelle que soit sa source (mission, dossier, litige, chat, paiement, conformité). Objectif : **inbox zéro chaque soir**.

### Structure d'une ligne
`[priorité] [type] [entité] — motif · SLA restant · assigné · [actions]`

- **Priorités** : `P0 critique` (SLA 1 h) · `P1 aujourd'hui` (4 h) · `P2 cette semaine` (48 h) · `P3 à surveiller`.
- **SLA en compte à rebours**, rouge à l'échéance, historique de dépassement conservé (c'est la métrique de qualité d'exploitation).
- **Actions inline** sans quitter la liste : traiter, reporter (snooze avec date, motif obligatoire), déléguer, clore avec motif.
- **Groupement intelligent** : 6 documents URSSAF à vérifier = une ligne dépliable, traitable en lot. Sans cela l'outil devient inutilisable à 40 intervenants.
- Filtres persistants (type, priorité, assigné, zone), vues sauvegardées, raccourcis clavier `j/k` navigation, `e` traiter, `s` snooze, `Entrée` ouvrir.

### Générateurs d'actions (règles)

| Règle | Priorité |
|---|---|
| Mission `PENDING_MATCHING` à H-48 | P0 |
| Mission `PENDING_MATCHING` à H-96 | P1 |
| Check-in absent H+20 | P0 |
| Réclamation créée | P0 si sécurité/vol, sinon P1 |
| Note client ≤ 3 | P1 |
| Dossier `DOCS_SUBMITTED` > 12 h | P1 |
| Dossier `WAITING_SIRET` sans nouvelle depuis 14 j | P2 |
| Chat sans réponse > 4 h (heures ouvrées) | P1 |
| Signal de contournement détecté dans un chat | P2 |
| Document obligatoire expirant < 15 j | P2 |
| Score de churn franchit 60 | P2 |
| Score de churn franchit 80 | P1 |
| Échec de paiement | P1 au 2ᵉ, P0 au 3ᵉ |
| Intervenant sans mission depuis 14 j | P2 |
| Zone en sous-capacité (demande > offre × 0,8) | P2 |
| Anomalie « logement anormalement sale » à arbitrer | P1 |

## 4. Modules d'exploitation

### 4.1 Missions
- **Vues** : liste dense (filtres état/date/zone/intervenant/client), calendrier semaine, **carte** (marqueurs par état + tracés de tournées du jour), timeline par intervenant.
- **Panneau mission** : état et historique complet des transitions (qui, quand, pourquoi — journal d'audit intégré), client, intervenant, prix et marge, checklist, rapport photo, chat associé, paiement.
- **Actions** : réaffecter (liste des candidats avec score de matching et motif du classement), forcer une assignation (avec justification obligatoire), modifier le créneau, annuler avec politique appliquée, ajouter un geste commercial, relancer la diffusion, éditer la durée facturée.
- **Réaffectation assistée** : sur un désistement, un écran unique propose les 5 meilleurs remplaçants avec impact sur leur tournée, et permet un envoi groupé de proposition en un clic.

### 4.2 Planning et capacité
- Grille intervenants × créneaux sur 4 semaines : disponibilités déclarées, missions posées, congés, capacité résiduelle en heures.
- **Détection de trous de couverture** : créneaux où la demande prévisionnelle dépasse la capacité déclarée, par commune. Alimente le recrutement (« il faut 1 intervenant supplémentaire sur Cadaujac le vendredi matin »).
- Simulation : « si j'ouvre le samedi après-midi, combien de missions puis-je servir ? »

### 4.3 Zones
- Carte avec isochrones 20 min par intervenant, superposées.
- **Heatmap de la demande** (dont demandes hors zone captées dans le funnel client — le meilleur signal d'expansion) et **heatmap de l'offre** (candidatures reçues, y compris hors zone).
- Par commune : nombre de clients, missions/semaine, intervenants actifs, taux de couverture, prix moyen, marge, statut `ouverte / liste d'attente / fermée`.
- Ouverture/fermeture de commune, paramétrage du rayon, du plancher tarifaire et des majorations locales.

## 5. Modules relation

### 5.1 Clients — fidélisation et rétention

**Liste** : colonnes segment, fréquence, prochaine mission, ancienneté, valeur annuelle, note moyenne donnée, **score de churn**, dernier contact. Segments prédéfinis : `nouveau (<3 missions)` · `installé` · `fidèle (>12 missions)` · `en refroidissement` · `en pause` · `perdu` · `récupérable`.

**Fiche client 360** (panneau, 5 onglets) :
1. **Synthèse** — coordonnées, adresse, logement, intervenant titulaire, abonnement, score de churn avec **décomposition des facteurs** et actions recommandées.
2. **Historique** — timeline unifiée : missions, paiements, messages, réclamations, gestes commerciaux, modifications d'abonnement, appels. Une seule chronologie, c'est ce qui permet de comprendre un client en 30 secondes.
3. **Missions** — avec notes, durées réelles, rapports.
4. **Facturation** — factures, moyens de paiement, échecs, crédits, attestation fiscale.
5. **Notes internes** — libres, horodatées, taggables.

**Actions de rétention** disponibles depuis la fiche :
- Geste commercial (remise, passage offert, remboursement) avec motif, plafond et traçabilité.
- Changement d'intervenant (avec assistant de sélection et message pré-rédigé au client).
- Proposition de pause au lieu d'une résiliation.
- Appel de courtoisie planifié (crée une action P2).
- Campagne de réactivation : sélection d'un segment → séquence (SMS + e-mail) avec offre paramétrée. Garde-fou : plafond de fréquence par client (max 2 sollicitations commerciales/mois), opt-out respecté.
- **Playbooks** déclenchés automatiquement, mais toujours validés par un humain avant envoi :

| Situation | Playbook |
|---|---|
| Note ≤ 3 | Appel sous 24 h + passage offert si confirmé |
| 2 annulations client en 60 j | Appel de compréhension, proposition de changement de créneau |
| Fréquence en baisse (mensuel → ponctuel) | Offre de reprise d'abonnement à −10 % sur 2 passages |
| Résiliation avec motif « prix » | Proposition de fréquence inférieure plutôt que perte totale |
| Résiliation avec motif « qualité » | Nouvel intervenant + passage offert |
| Client fidèle > 12 missions | Message de remerciement + invitation au parrainage (levier le plus rentable) |
| Silence > 45 j sur un client historiquement régulier | Réactivation en un tap sur le dernier paramétrage |

### 5.2 Intervenants

**Liste** : statut, commune, zones, heures/semaine, capacité résiduelle, missions 30 j, note, **score de fiabilité**, conformité (feu vert/orange/rouge avec date d'expiration la plus proche), CA généré.

**Fiche intervenant 360** :
1. **Synthèse** — profil, ancienneté, zones, disponibilités, scores avec décomposition, alerte de conformité.
2. **Activité** — missions, taux d'acceptation, délai de réponse moyen, ponctualité (écart entre heure prévue et check-in), taux de rapport complet, annulations, no-shows.
3. **Qualité** — notes reçues (courbe), tags d'avis agrégés, réclamations liées, anomalies signalées.
4. **Conformité** — tous les documents avec statut, dates, historique de vérification, journal d'accès.
5. **Finance** — missions facturées, commissions, reversements, statut Stripe Connect.
6. **Notes internes** et historique des échanges.

**Actions** : mettre en pause (motif au choix dans une liste fermée, toujours non disciplinaire), réactiver, modifier zones/rayon, ajuster le taux horaire, envoyer un message, planifier un point, déclencher une relance documentaire, retirer du matching sur un client précis (incompatibilité, à la demande de l'un ou l'autre).

**Vue « santé du parc »** : nombre d'actifs, en pause, taux d'attrition mensuel, ancienneté médiane, distribution de la charge (détecter la surcharge d'un intervenant qui portera 40 % des missions — risque de concentration à la fois économique et juridique).

### 5.3 Recrutement — analyse des dossiers

**Pipeline kanban** : colonnes = statuts du funnel (`03 § 10`). Carte de dossier : prénom + initiale, commune, temps de trajet moyen estimé, branche empruntée (`SIRET existant` / `création AE` / `SAP à faire`), **âge du dossier**, **score de dossier**, SLA, dernier événement. Code couleur sur l'âge, pas sur le score : un bon dossier oublié 10 jours est un candidat perdu.

**Écran de revue de dossier** — c'est l'écran le plus important du module. Disposition en trois colonnes sur desktop :

```
┌───────────────┬──────────────────────────────┬────────────────┐
│ SYNTHÈSE      │ VISIONNEUSE DE DOCUMENTS     │ CHECKLIST      │
│               │                              │                │
│ Fatou D.      │  [CNI recto]  [zoom]         │ ☑ Identité     │
│ Cadaujac      │                              │ ☑ SIRET actif  │
│ 8 min médian  │  Nom lu : DIALLO Fatou       │ ☐ SAP          │
│ Score 78/100  │  Validité : 12/2029          │ ☑ RC Pro       │
│               │  ─ Champs extraits ─         │ ☑ Vigilance    │
│ Branche : AE  │  Comparaison avec déclaré :  │ ☑ IBAN = nom   │
│ créée le 12/08│  ✅ nom  ✅ prénom            │                │
│               │                              │ MOTIFS D'ALERTE│
│ Dispos:       │  ◀ 1/6 ▶                    │ ⚠ SAP en cours │
│ L-M-J matin   │                              │                │
│               │                              │ [ VALIDER ]    │
│ Timeline      │                              │ [ DEMANDER... ]│
│ complète      │                              │ [ REFUSER ]    │
└───────────────┴──────────────────────────────┴────────────────┘
```

- **Extraction assistée** des champs (nom, dates, numéros) avec affichage systématique de la valeur brute et de la comparaison au déclaratif. L'automatisation propose, l'humain décide — aucune validation ni aucun refus automatique sur un document d'identité.
- **Contrôles automatiques affichés en clair** : SIRET actif (API Sirene), APE cohérent, vigilance URSSAF < 6 mois, RC Pro en cours, IBAN au nom du candidat, doublons détectés (téléphone/IBAN/appareil), cohérence SIREN ↔ n° SAP.
- **Trois décisions** : *Valider* (passe en `APPROVED`) · *Demander une correction* (sélection de la pièce + motif dans une liste de 12 motifs standard rédigés en langage courant, envoi automatique au candidat) · *Refuser* (motif interne détaillé, message externe neutre).
- **Grille d'entretien** intégrée : 7 critères notés 1-5 (expérience concrète, fiabilité, compréhension de l'indépendance, français opérationnel, présentation, motivation, cohérence des disponibilités) + notes libres. Sert de trace en cas de contestation et d'homogénéisation des décisions.
- **Score de dossier** (§ 8.4) affiché avec sa décomposition, jamais seul.
- **Vigilance non-discrimination** : la fiche masque par défaut la date de naissance complète (âge seul), la nationalité, la photo pendant la revue documentaire, et le motif de refus est saisi dans une liste fermée d'items objectifs. Le journal d'audit conserve chaque décision, son auteur et son motif — protection en cas de réclamation.

### 5.4 Inbox — gestion des chats

Interface trois colonnes : **files** / **liste de conversations** / **fil + contexte**.

- **Files** : `Non assignées` · `Mes conversations` · `SLA dépassé` · `Clients` · `Intervenants` · `Candidats` · `Signaux de contournement` · `Escalades` · `Résolues`.
- **Liste** : dernier message, expéditeur, âge, SLA, tag, statut. Indicateur de sentiment simple (négatif détecté → remontée en tête).
- **Fil** : messages temps réel, envoi de pièce jointe, **panneau de contexte à droite** (fiche de l'interlocuteur, mission concernée, scores, dernières missions, gestes déjà accordés) — répondre sans contexte produit des réponses inutiles.
- **Macros** : réponses types paramétrables avec variables (`{prénom}`, `{date_mission}`, `{intervenant}`), insertion par `/`. Une macro peut déclencher une action (ex. macro « report accepté » ouvre le sélecteur de créneau).
- **Assignation, tags, snooze, résolution avec motif**, notes internes invisibles du client.
- **SLA** : premier délai de réponse et délai de résolution, mesurés en heures ouvrées, avec objectif affiché (< 2 h / < 24 h) et suivi hebdomadaire.
- **Signaux de contournement** : file dédiée où arrivent les messages contenant IBAN, numéro de téléphone, montants ou expressions de type « en direct ». Traitement humain, mesure graduée (rappel des CGU, puis discussion), jamais de blocage automatique du compte.
- **Consolidation multi-canal** : les SMS entrants et les e-mails à `contact@leoclean.fr` remontent dans la même inbox. Sans cela, l'outil est contourné dès la première semaine.

### 5.5 Qualité et litiges
- File des réclamations avec type, gravité, mission, montant en jeu, SLA.
- Écran de traitement : version du client, version de l'intervenant (sollicitée en un clic), photos du rapport, historique des deux parties, décision (geste commercial / re-passage / remboursement / déclaration d'assurance / classement sans suite) avec motif, notification automatique des deux parties.
- Suivi des sinistres assurance : dossier, montant, statut, franchise.
- **Tableau de récurrence** : réclamations par intervenant, par cause, par zone. Objectif : distinguer un incident isolé d'un problème systémique (produits inadaptés, durée sous-estimée sur un type de logement, brief client insuffisant).

## 6. Modules de pilotage

### 6.1 Finance
- **Vue mensuelle** : CA brut, commissions perçues, reversements dus/versés, gestes commerciaux, impayés, marge par mission et par zone.
- Facturation : suivi des factures émises (client) et des factures d'intervenants émises sous mandat, anomalies de numérotation, mentions manquantes.
- Encaissements : échecs Stripe avec relances, taux d'échec, délai moyen d'encaissement.
- Reversements : lot hebdomadaire, contrôle avant exécution, statut Connect par intervenant, écarts.
- **Unit economics** : coût d'acquisition client par canal, valeur vie client par cohorte de mois d'entrée, coût d'acquisition intervenant, marge par mission, seuil de rentabilité par zone.
- Export comptable CSV/FEC-compatible, réconciliation Stripe.

### 6.2 Frictions — voir § 7.

### 6.3 Parrainage
Suivi client et intervenant : codes actifs, invitations, conversions, crédits émis/consommés, coût d'acquisition par parrainage, **détection d'abus** (même adresse, même IBAN, même appareil, cadence anormale) avec file de revue.

### 6.4 Réglages
Tarification (toutes les tables de `00 § 7`, versionnées avec date d'effet et simulation d'impact avant application) · zones et rayons · règles de matching et poids · SLA · modèles de notifications et macros · contenu CMS (FAQ, pages SEO locales) · **feature flags** · rôles et permissions · **journal d'audit** (qui a fait quoi, quand, sur quelle entité, valeur avant/après — obligatoire sur les gestes commerciaux, les décisions de dossier, les accès aux documents et les modifications tarifaires).

**Rôles** : `owner` (tout) · `ops` (exploitation, pas de tarification ni finance) · `recruteur` (dossiers et documents uniquement) · `support` (inbox, gestes plafonnés) · `lecture`. Accès aux documents d'identité restreint à `owner` et `recruteur`, journalisé.

## 7. Module Frictions

Objectif : rendre visible ce qui coûte des clients et des intervenants sans que personne ne se plaigne.

### 7.1 Funnels instrumentés
- Funnel client : accueil → prix → créneau → compte → paiement → confirmation → 1ʳᵉ mission → 2ᵈ réservation.
- Funnel intervenant : les 10 étapes de `03`, avec branches.
- Chaque étape : entrants, sortants, taux d'abandon, **durée médiane**, erreurs de champ les plus fréquentes, comparaison à la période précédente et à la cible.

### 7.2 Frictions détectées (règles, pas ML)
Une friction est un fait daté avec une ampleur et une hypothèse de cause :

| Détecteur | Seuil | Sortie |
|---|---|---|
| Abandon d'étape anormal | +10 pts vs 30 j glissants | « Étape X : +14 pts d'abandon » |
| Étape lente | Durée médiane > 2× la médiane historique | « Le choix de créneau prend 3 min (vs 1 min) » |
| Erreur de champ récurrente | > 15 % des sessions | « Champ code postal : 22 % d'erreurs » |
| Créneaux sans capacité | Recherches sans résultat | « 31 recherches sans créneau sur Cadaujac vendredi » — friction et signal de capacité |
| Échec technique | Erreurs 5xx, timeouts, échecs d'upload par étape | « Upload RC Pro : 18 % d'échec sur Android » |
| Boucle de support | > 3 allers-retours sur le même sujet | « 9 conversations sur l'attestation fiscale » — signal de FAQ manquante |
| Répétition de question | Même intention détectée dans l'inbox | Suggestion de macro ou de contenu |
| Rage-clicks / retours arrière | PostHog | Écran suspect |

Chaque friction porte : ampleur (nombre de personnes affectées, € estimés), tendance, **et une action** (créer un ticket, ouvrir l'écran concerné, assigner). Une friction traitée est archivée avec son résultat mesuré — c'est ce qui transforme le module en boucle d'amélioration et pas en mur de graphiques.

### 7.3 Vue « santé du produit »
Une page, quatre lignes : conversion client, conversion intervenant, fiabilité opérationnelle (couverture, ponctualité, rapports complets), qualité perçue (note, NPS, taux de réclamation). Chacune avec la valeur, la cible, la tendance 8 semaines, et l'écart chiffré.

## 8. Scores — définitions et formules

Tous les scores respectent trois règles : **borne 0-100**, **décomposition affichée**, **action associée**. Recalcul nocturne + recalcul événementiel sur les facteurs critiques.

### 8.1 Risque de mission (`mission_risk`)

| Facteur | Points |
|---|---|
| Non couverte à H-48 | +40 |
| Non couverte à H-96 | +20 |
| Premier passage chez ce client | +12 |
| Premier passage de cet intervenant chez ce client | +8 |
| Intervenant avec ≥ 2 annulations sur 60 j | +15 |
| Trajet précédent > 18 min ou tournée serrée (< 15 min de marge) | +10 |
| Accès complexe (boîte à clés, code, absence du client) | +8 |
| Client avec réclamation ouverte ou note ≤ 3 au dernier passage | +12 |
| Moyen de paiement en échec ou expirant | +10 |
| Mission > 4 h ou option lourde (fin de bail) | +6 |
| Samedi / dimanche / veille de férié | +5 |

Seuils : ≥ 70 `critique` (action P0) · 50-69 `élevé` (P1) · 30-49 `à surveiller` · < 30 `normal`.

### 8.2 Churn client (`client_churn`)

| Facteur | Points |
|---|---|
| Aucune mission depuis > 2× sa fréquence habituelle | +25 |
| Fréquence en baisse sur 90 j | +15 |
| ≥ 2 annulations client sur 60 j | +15 |
| Dernière note ≤ 3 | +20 |
| Réclamation non résolue | +20 |
| Changement d'intervenant subi (non demandé) dans les 30 j | +12 |
| Mission non couverte ou reportée par nos soins dans les 60 j | +12 |
| Message client sans réponse > 24 h | +10 |
| Échec de paiement non régularisé | +10 |
| Abonnement en pause > 4 semaines | +8 |
| Ancienneté < 3 missions | +8 |
| — Facteurs protecteurs — | |
| ≥ 12 missions réalisées | −15 |
| Continuité d'intervenant ≥ 85 % | −10 |
| A parrainé quelqu'un | −10 |
| Note moyenne donnée ≥ 4,5 | −8 |

Priorisation par `score × valeur annuelle` : un client fidèle à 1 400 €/an à 65 passe avant un ponctuel à 90.

### 8.3 Fiabilité intervenant (`pro_reliability`)
Base 100, pondération sur 90 jours glissants :

| Facteur | Effet |
|---|---|
| Ponctualité (check-in dans la plage) | jusqu'à −25 |
| Taux d'acceptation des propositions | jusqu'à −15 |
| Délai médian de réponse aux propositions | jusqu'à −10 |
| Annulations tardives (< 48 h) | −10 par occurrence |
| No-show | −30, alerte immédiate |
| Rapports incomplets | jusqu'à −10 |
| Note moyenne pondérée récence | jusqu'à −20 |
| Réclamations fondées | −15 par occurrence |
| Conformité documentaire à jour | −40 si expirée (met de fait en pause) |
| Ancienneté et volume | jusqu'à +10 |

Usage strictement interne au matching et au suivi ; **jamais** présenté à l'intervenant comme une note de performance, jamais utilisé comme fondement d'une mesure présentée comme une sanction (cf. garde-fous `00 § 2.2`). L'intervenant a en revanche accès à ses indicateurs bruts (ponctualité, note, taux d'acceptation) — transparence sans notation disciplinaire.

### 8.4 Score de dossier candidat (`application_score`)

| Facteur | Points |
|---|---|
| Zone à forte demande non couverte | +20 |
| Disponibilités correspondant aux créneaux en tension | +20 |
| Expérience professionnelle vérifiable | +15 |
| Véhicule + rayon large | +10 |
| Statut et SAP déjà en règle | +15 |
| Dossier documentaire complet du premier coup | +10 |
| Réactivité dans le funnel (< 48 h par étape) | +10 |
| Provenance parrainage intervenant | +10 |
| — Signaux d'attention (n'entrent pas dans le score, s'affichent séparément) — | |
| Doublon détecté, IBAN au nom d'un tiers, SIRET < 3 mois, incohérence de nom | drapeaux |

Le score sert à **ordonner la file de revue**, pas à décider. Les signaux d'attention sont volontairement hors score pour qu'ils ne soient jamais compensés par de bons points.

## 9. Alerting

| Canal | Usage |
|---|---|
| Push Web (console) | Tous les P0 et P1 |
| SMS à Paul | P0 uniquement : no-show, réclamation sécurité, mission non couverte à H-24, 3ᵉ échec de paiement |
| E-mail récapitulatif | 7 h : journée du jour, actions ouvertes, signaux. 19 h : bilan et actions non traitées |
| Hebdomadaire (lundi 8 h) | Santé du produit, cohortes, frictions, recrutement, finance |

Anti-fatigue : regroupement, pas plus d'un SMS par 30 min sauf sécurité, snooze respecté, escalade uniquement si non traité.

## 10. Critères d'acceptation (extraits)

1. Depuis le Radar, toute mission à risque critique est traitable (réaffectation ou report) en **≤ 3 clics**.
2. Aucun score n'est affiché sans sa décomposition en facteurs et son action recommandée.
3. La file d'actions se vide : tout élément a un état terminal explicite (traité, snoozé avec date, clos avec motif). Aucun élément ne peut disparaître sans trace.
4. Un dossier de candidature est décidable depuis un seul écran, sans ouvrir d'onglet externe ni télécharger de fichier.
5. Toute décision sensible (geste commercial, refus de dossier, mise en pause, changement de tarif, accès à un document d'identité) apparaît dans le journal d'audit avec auteur, horodatage, motif et valeurs avant/après.
6. Le Radar et la File d'actions sont pleinement utilisables sur un écran de 390 px de large.
7. Le temps de chargement du Radar est < 1,5 s au P75 avec 500 missions actives et 50 intervenants.
8. Aucun refus ni validation de dossier ne peut être exécuté par un traitement automatisé.
