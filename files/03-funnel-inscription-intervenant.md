# 03 — Funnel d'inscription intervenant `/rejoindre`

## 1. Intention

Deux références assumées :

- **Airbnb (mise en ligne d'un logement)** pour la mécanique : une question par écran, progression visible, sauvegarde permanente, reprise possible à tout moment, aucune impression de formulaire administratif.
- **LegalStart** pour le fond : quand le candidat n'a ni SIRET ni déclaration SAP, le funnel ne le rejette pas — il devient un **parcours d'accompagnement** qui le mène jusqu'au bout de ses démarches, en gardant le lien pendant les 2 à 6 semaines que cela prend.

Le principe qui gouverne tout le document : **le candidat non-auto-entrepreneur n'est pas un candidat disqualifié, c'est un candidat à 4 semaines**. C'est là que se trouve le vivier réel au sud de Bordeaux, et c'est l'avantage concurrentiel du funnel.

## 2. Vue d'ensemble

```
Étape 0  Entrée              /travailler-avec-nous → simulateur de revenus
Étape 1  Éligibilité         commune, mobilité, disponibilités, expérience     2 min
Étape 2  Identité            prénom/nom/tél + OTP → compte créé, dossier ouvert
Étape 3  Profil              expérience, compétences, présentation, photo      5 min
─────────── AIGUILLAGE STATUT ───────────
Étape 4A  SIRET existant     saisie SIRET → vérification API INSEE            1 min
Étape 4B  Création AE        parcours guidé (5 sous-étapes, 1-3 semaines)
─────────── AIGUILLAGE SAP ─────────────
Étape 5A  SAP déclaré        n° de déclaration + récépissé                    2 min
Étape 5B  Déclaration SAP    parcours guidé NOVA (4 sous-étapes, 1-4 sem.)
Étape 6  Documents           identité, RC Pro, vigilance URSSAF, IBAN          8 min
Étape 7  Entretien           créneau visio 20 min
Étape 8  Mise en situation   1ʳᵉ mission accompagnée ou test terrain (option)
Étape 9  Charte & mandats    charte qualité, mandat de facturation, CGU
Étape 10 Activation          disponibilités, zones, premières propositions
```

Barre de progression persistante en haut : `Étape 4 sur 10 · 40 %`. Les étapes 4B et 5B ne dégradent pas la progression affichée : elles ouvrent un sous-parcours avec sa propre progression, pour ne pas donner l'impression de reculer.

## 3. Étape 0 — Page d'entrée et simulateur

- Promesse chiffrée honnête : `Entre 1 400 € et 2 200 € net par mois pour 30 h/semaine, à moins de 20 minutes de chez vous`. Fourchette, jamais un chiffre unique.
- **Simulateur** : commune + heures souhaitées → estimation de revenu, nombre de missions type, temps de trajet moyen. Le calcul utilise la demande réelle de la zone (données admin), donc il faut un fallback prudent quand la zone est vide.
- Trois arguments hiérarchisés : trajets courts (le vrai différenciateur), paiement hebdomadaire, accompagnement administratif complet.
- Double porte : `Je suis déjà auto-entrepreneur` / `Je veux me lancer, aidez-moi`. Les deux mènent au même funnel mais pré-positionnent l'aiguillage et adaptent la copie. La seconde porte doit être aussi grosse que la première.
- Une porte tierce : `Je représente une entreprise de nettoyage` → formulaire court distinct (SIRET, effectif, zone, assurance) avec traitement admin dédié. Ne pas mélanger les deux pipelines.

## 4. Étape 1 — Éligibilité (2 minutes, sans compte)

Une question par écran, réponses par gros boutons :

1. **Ta commune ?** — autocomplétion, vérification isochrone. Hors zone → « Pas encore chez nous, on te prévient » + capture, avec enregistrement dans la heatmap d'offre.
2. **Comment te déplaces-tu ?** — véhicule / deux-roues / transports / à pied. Détermine le rayon réel et le calcul d'isochrone.
3. **Combien d'heures par semaine ?** — < 10 / 10-20 / 20-35 / 35+.
4. **Quand es-tu disponible ?** — grille semaine simplifiée (matin/après-midi × jours).
5. **Ton expérience du ménage à domicile ?** — aucune / occasionnelle / plusieurs années / professionnelle.
6. **As-tu déjà un statut d'indépendant ?** — oui, SIRET actif / en cours de création / non, pas encore.

Écran de résultat immédiat : `Ton profil correspond. Dans ta zone, on a environ 6 missions par semaine à pourvoir sur tes créneaux.` — le chiffre doit être réel ; s'il est faible, dire la vérité et proposer une liste d'attente plutôt que de faire venir quelqu'un pour rien.

**Critères de disqualification douce** (jamais un mur, toujours une explication et une alternative) : hors zone, aucune disponibilité compatible, moins de 5 h/semaine, mineur.

## 5. Étape 2 — Identité et création du dossier

Prénom, nom, téléphone → OTP SMS. E-mail demandé juste après (nécessaire pour les documents et l'accompagnement).

À cette seconde, un enregistrement `pro_application` est créé avec `status = STARTED`. À partir de là, **toute sortie du funnel déclenche une séquence de relance** (§ 10) et le dossier est visible en admin.

## 6. Étape 3 — Profil

- Expérience : années, types de lieux (particuliers, bureaux, locations courte durée), employeurs ou clients notables (libre).
- Compétences : ménage courant, grand ménage, vitres, repassage, fin de bail, animaux, produits écologiques. Cases.
- Langues parlées, permis, matériel personnel (aspirateur, véhicule).
- **Présentation** en 300 caractères, avec 3 amorces suggérées (« Ce que j'aime dans ce métier… », « Ma façon de travailler… », « Un détail que mes clients apprécient… »). C'est le champ le plus abandonné : suggestions indispensables.
- **Photo** : capture caméra ou galerie, cadrage guidé, contrôle qualité basique (visage détecté, luminosité). Consigne : visage visible, sourire bienvenu, pas de lunettes de soleil. Peut être différée mais bloque l'activation finale.

## 7. Aiguillage statut — Étape 4

### 7.1 Branche A — SIRET existant

- Saisie du SIRET (14 chiffres, `inputmode="numeric"`, validation Luhn).
- Appel **API Sirene / INSEE** : raison sociale, date de création, code APE, état administratif, adresse. Pré-remplissage automatique, aucune re-saisie.
- Contrôles automatiques :

| Contrôle | Comportement si échec |
|---|---|
| Établissement actif | Blocage avec explication (« cet établissement est cessé ») |
| APE cohérent (81.21Z, 97.00Z, 88.10A…) | Avertissement non bloquant + revue admin |
| Nom = nom déclaré | Écart → revue admin manuelle |
| Régime micro-entreprise | Question déclarative + attestation |
| Date de création < 3 mois | Signal d'attention (pas un rejet) |

- Upload de l'avis de situation SIRENE (ou génération d'un PDF depuis l'API pour éviter l'upload — gain de conversion réel).

### 7.2 Branche B — Création d'auto-entreprise (parcours guidé)

Écran d'accueil de branche, ton rassurant et honnête : *« Tu n'as pas encore de statut. C'est normal, et c'est gratuit à créer. Compte 15 minutes de démarches et 1 à 3 semaines d'attente. On t'accompagne, et on garde tes missions en attente pendant ce temps. »*

**Sous-étape B1 — Comprendre** (1 écran, 6 lignes)
Ce qu'est l'auto-entreprise, ce que ça coûte (0 € à la création, ~21,2 % de cotisations sur le chiffre d'affaires en services BIC/BNC selon activité — à faire valider et à paramétrer, pas à coder en dur), ce que ça implique (déclaration trimestrielle, plafond annuel). Une vidéo de 90 s. Aucun jargon.

**Sous-étape B2 — Checklist de préparation**
Liste interactive : pièce d'identité, justificatif de domicile, numéro de sécurité sociale, IBAN personnel, choix de l'activité (« nettoyage courant des bâtiments »), choix du régime de versement libératoire (avec explication en 3 lignes). Chaque item cochable, avec un « pourquoi ? » dépliable.

**Sous-étape B3 — Faire la démarche**
- Lien profond vers le **Guichet unique (INPI) / formalites.entreprises.gouv.fr**, ouverture en nouvel onglet.
- **Guide pas à pas** affiché à côté : captures d'écran annotées des champs clés, valeurs recommandées (activité, date de début, lieu d'exercice, option versement libératoire, EI sans option IS).
- Bouton `J'ai envoyé ma demande` → dossier passe en `WAITING_SIRET`, date de démarche enregistrée.
- Bouton `Je suis bloqué` → ouverture d'un fil de chat avec Léo Clean + option de rappel téléphonique dans les 24 h. **C'est le point de sauvetage le plus rentable du funnel : il doit être visible sur chaque écran de la branche B.**

> ⚠ Ne jamais effectuer la démarche à la place du candidat, ne jamais collecter ses identifiants du Guichet unique, ne jamais promettre un délai d'obtention. Accompagner ≠ mandater. Si tu veux aller plus loin, la voie propre est un partenariat avec un acteur habilité (formaliste, expert-comptable) rémunéré séparément, ou un rôle de simple mandataire de formalité avec un mandat écrit — à valider juridiquement.

**Sous-étape B4 — Attente accompagnée** (`WAITING_SIRET`)
- Écran d'état : `Démarche envoyée le 12/08 · délai habituel 8 à 20 jours`.
- Pendant l'attente, le funnel **continue** sur ce qui ne dépend pas du SIRET : profil, photo, documents d'identité, modules de formation, entretien visio. Objectif : que le candidat ait tout terminé sauf le SIRET, pour une activation le jour même de sa réception.
- Relances : J+7 `Des nouvelles ?`, J+14 `Toujours rien ? On regarde ensemble.` (proposition d'appel), J+21 escalade admin manuelle.
- Bouton permanent `J'ai reçu mon SIRET` → retour en branche A pour vérification.

**Sous-étape B5 — Vérification** : identique à la branche A.

## 8. Aiguillage SAP — Étape 5

Contexte : en modèle mandataire, c'est la déclaration SAP de l'intervenant qui ouvre le crédit d'impôt au client. Sans elle, l'intervenant est deux fois moins attractif. Le funnel doit donc la traiter comme une étape de premier plan, pas comme une case administrative.

### 8.1 Écran pédagogique (toujours affiché)
*« La déclaration "services à la personne" permet à tes clients de récupérer 50 % de ce qu'ils te paient. Concrètement : tu factures 30 €, ça leur coûte 15 €. C'est gratuit, ça se fait en ligne, et ça change tout sur ta capacité à remplir ton planning. »*

### 8.2 Branche A — Déjà déclaré
- Saisie du numéro de déclaration (format `SAP` + 9 chiffres du SIREN), upload du récépissé.
- Contrôle de cohérence SIREN déclaration ↔ SIRET vérifié à l'étape 4. Incohérence → revue admin.

### 8.3 Branche B — Déclaration à faire (parcours guidé)

| Sous-étape | Contenu | Statut dossier |
|---|---|---|
| **S1 — Conditions** | Vérifier l'exclusivité d'activité SAP, la nature des prestations éligibles (entretien de la maison et travaux ménagers), l'absence d'activité incompatible dans le SIRET. Questionnaire de 4 questions avec explication de chaque cas de blocage. | `SAP_CHECK` |
| **S2 — Préparer** | Checklist : SIRET actif obligatoire (donc S2 est bloquée en amont si branche 4B non terminée — l'ordre est important et doit être expliqué), coordonnées, description des activités, identifiants de connexion au portail. | `SAP_PREP` |
| **S3 — Déclarer sur NOVA** | Lien profond vers le portail de télédéclaration SAP, guide pas à pas annoté (création de compte, saisie de l'établissement, sélection des activités « entretien de la maison et travaux ménagers », validation). Bouton `J'ai déclaré` + `Je suis bloqué` (chat + rappel). | `SAP_SUBMITTED` |
| **S4 — Récépissé** | Attente du récépissé (immédiat à quelques jours), upload, contrôle, validation. | `SAP_VERIFIED` |

- Pendant `SAP_SUBMITTED`, l'intervenant **peut être activé** en mode « sans crédit d'impôt » si l'exploitation le décide, avec une mention claire côté client. Point de configuration admin : `ALLOW_ACTIVATION_WITHOUT_SAP` (défaut : non, car un client qui découvre après coup qu'il n'a pas droit au crédit d'impôt est un litige garanti).

## 9. Étapes 6 à 10

### Étape 6 — Documents et vérifications
`DocumentSlot` avec caméra native, recadrage guidé, détection de flou, feedback immédiat :

| Pièce | Vérification |
|---|---|
| Pièce d'identité (recto/verso) | Lisibilité, date de validité, nom = nom déclaré. Comparaison avec la photo de profil en revue humaine (pas de reconnaissance faciale automatisée sans base légale et AIPD) |
| Justificatif de domicile | < 3 mois, cohérence avec la commune déclarée |
| Attestation de vigilance URSSAF | Émise < 6 mois, SIREN cohérent. Guide « où la télécharger » (espace auto-entrepreneur) avec captures |
| RC Professionnelle | Activité couverte = nettoyage à domicile, en cours de validité, plafond ≥ seuil défini. Si absente : orientation vers 2 ou 3 assureurs partenaires, avec la mention explicite que le choix est libre |
| IBAN | Nom du titulaire = nom déclaré (contrôle anti-fraude essentiel) |
| Autorisation de travail (si applicable) | Validité, type de titre |

Le candidat voit un panneau de complétion `5 documents sur 6 · il manque ta RC Pro` en permanence.

### Étape 7 — Entretien visio (20 min)
- Prise de créneau intégrée (Google Calendar, créneaux réels), lien de visio généré, rappels J-1 et H-1.
- Grille d'évaluation structurée côté admin (§ `04 § 6`) : expérience concrète, fiabilité, compréhension du modèle indépendant, français opérationnel, présentation, motivation, cohérence des disponibilités.
- Résultat : `favorable` / `favorable sous réserve` / `défavorable` + notes. En cas de défavorable : message respectueux, motif général, pas de justification détaillée (risque de contentieux discriminatoire), possibilité de re-candidater après 6 mois.

### Étape 8 — Mise en situation (optionnelle, recommandée)
Première mission accompagnée par un intervenant référent ou par Paul, rémunérée normalement. Grille d'observation : méthode, rythme, soin, relation client, respect du protocole d'entrée. Attention juridique : cette étape doit être une **prestation rémunérée**, jamais un « test gratuit » (travail dissimulé).

### Étape 9 — Charte et mandats
Trois documents à accepter distinctement, chacun résumé en 5 puces avant le texte intégral :
1. **CGU intervenant** (nature de la relation, indépendance, absence d'exclusivité, commission, conditions de retrait).
2. **Charte qualité et sécurité** (protocole d'entrée, discrétion, confidentialité des codes, gestion des clés, conduite en cas de dégât).
3. **Mandat de facturation** (autorisation d'émettre les factures au nom et pour le compte de l'intervenant) — révocable, avec la conséquence expliquée.
Signature électronique horodatée, adresse IP, version du document, PDF archivé et accessible dans l'espace intervenant. Conservation 5 ans.

### Étape 10 — Activation
- Disponibilités récurrentes + zones + objectif d'heures.
- Deux modules de formation obligatoires.
- Écran de bienvenue : `Ton compte est actif. 3 missions correspondent à tes créneaux cette semaine.` avec les propositions immédiatement affichées. Le délai entre activation et première proposition doit être proche de zéro, sinon l'intervenant se démobilise.
- Contact humain : message de bienvenue personnalisé sous 24 h (semi-automatisé, envoyé par Paul).

## 10. Statuts du dossier, SLA et relances

| Statut | Signification | SLA admin | Relance candidat |
|---|---|---|---|
| `STARTED` | Compte créé, étape 1-3 | — | J+1, J+3, J+7 (push/SMS/e-mail, décroissant) |
| `PROFILE_DONE` | Profil complet | — | J+2 |
| `WAITING_SIRET` | Démarche AE envoyée | Suivi hebdo | J+7, J+14, J+21 |
| `SAP_SUBMITTED` | Déclaration SAP envoyée | Suivi hebdo | J+5, J+12 |
| `DOCS_PENDING` | Documents incomplets | — | J+1, J+3, J+7 |
| `DOCS_SUBMITTED` | Tout déposé | **Revue sous 24 h ouvrées** | Informé du délai |
| `DOCS_REJECTED` | Pièce refusée | — | Immédiat + motif clair + comment corriger |
| `INTERVIEW_SCHEDULED` | Créneau pris | — | J-1, H-1 |
| `INTERVIEW_DONE` | Entretien passé | **Décision sous 48 h** | Informé du délai |
| `TRIAL_SCHEDULED` / `TRIAL_DONE` | Mise en situation | 48 h | — |
| `APPROVED` | Validé, en attente d'activation | 24 h | Relance activation J+1, J+3 |
| `ACTIVE` | Actif | — | — |
| `PAUSED` | Conformité expirée | 24 h | Régularisation |
| `REJECTED` / `WITHDRAWN` | Refusé / abandon | — | Aucune (hors re-candidature à 6 mois) |

Les relances doivent être **contextuelles**, jamais génériques : `Il te manque juste ta RC Pro pour finir` convertit ; `Votre inscription est incomplète` non.

## 11. Anti-fraude et sécurité

- Rate limiting et vérification OTP par téléphone unique ; blocage des numéros VoIP jetables.
- Détection de doublons : téléphone, e-mail, IBAN, SIRET, nom+date de naissance, empreinte d'appareil.
- Contrôle nom IBAN ↔ nom déclaré ↔ nom du document d'identité (le principal vecteur de fraude sur ce type de plateforme).
- Journalisation de tous les accès aux documents (qui, quand, quel document) — obligation RGPD et protection en cas de litige.
- Limitation stricte du nombre de dossiers par IP/appareil.
- Aucun document accessible par URL publique : signed URLs de 60 secondes, générées à la demande, jamais mises en cache.

## 12. Instrumentation et objectifs de conversion

Événements : `application_step_viewed/completed/abandoned`, `application_branch_taken` (`SIRET_EXISTING|SIRET_CREATE|SAP_EXISTING|SAP_CREATE`), `application_help_requested` (étape), `document_upload_failed` (raison), `application_status_changed`.

Objectifs de référence (à ajuster après 100 dossiers) :

| Transition | Cible |
|---|---|
| Page d'entrée → étape 1 démarrée | 25 % |
| Étape 1 → compte créé | 55 % |
| Compte créé → profil complet | 70 % |
| Branche A (SIRET existant) → documents déposés | 65 % |
| Branche B (création AE) → SIRET obtenu | **35 %** — c'est la métrique la plus importante du funnel |
| Documents déposés → activé | 60 % |
| **Global page d'entrée → actif** | 4 à 7 % |
| Délai médian branche A | ≤ 5 jours |
| Délai médian branche B | ≤ 28 jours |

## 13. Critères d'acceptation (extraits)

1. Un candidat peut interrompre le funnel à n'importe quel écran et le reprendre au même point depuis un autre appareil via OTP, sans perte de donnée.
2. Aucune étape ne redemande une information déjà fournie ou dérivable de l'API Sirene.
3. Un candidat sans SIRET atteint l'étape 7 (entretien) **sans avoir son SIRET**, et l'obtention du SIRET déclenche une activation en moins de 24 h ouvrées.
4. Le bouton `Je suis bloqué` est présent sur 100 % des écrans des branches 4B et 5B et crée un ticket admin traçable.
5. Toute pièce refusée génère un motif rédigé en langage courant et l'action précise à effectuer, testé sur les 12 motifs de refus standard.
6. Aucun document d'identité n'est accessible par une URL vivant plus de 60 secondes ; test d'intrusion automatisé en CI.
