# 00 — Socle produit et technique

## 1. Thèse produit

Léo Clean est un service de ménage à domicile au sud de Bordeaux, structuré autour d'une contrainte assumée : **aucune mission au-delà de 20 minutes de trajet de l'intervenant**. Cette contrainte n'est pas une limite d'exploitation, c'est la proposition de valeur — elle produit de la régularité (même personne, même créneau), de la ponctualité, et une rémunération nette supérieure pour l'intervenant puisqu'il ne finance pas ses trajets.

Trois promesses opérationnalisées dans le produit :

| Promesse                      | Traduction produit                                                                              | Mesure                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------- |
| « Toujours la même personne » | Continuité d'affectation prioritaire dans le matching, cleaner favori verrouillable côté client | Taux de continuité ≥ 85 % au 3ᵈ passage |
| « À 20 minutes de chez vous » | Filtre dur de couverture, affichage du temps de trajet dans le funnel intervenant               | 100 % des missions sous seuil           |
| « Zéro angle mort »           | Rapport photo systématique, checklist par pièce, chat direct                                    | Taux de rapport complet ≥ 95 %          |

## 2. Modèle économique et cadre juridique

### 2.1 ⚠ DÉCISION — Prestataire ou mandataire

|                           | **A. Prestataire (sous-traitance)**                                 | **B. Mandataire / mise en relation** _(recommandé)_                           |
| ------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Qui vend                  | Léo Clean                                                           | L'intervenant                                                                 |
| Déclaration SAP           | Portée par Léo Clean                                                | Portée par **chaque intervenant**                                             |
| Facture au client         | Léo Clean, TVA selon régime                                         | Intervenant (franchise TVA le plus souvent) + facture de commission Léo Clean |
| Crédit d'impôt 50 %       | Sur la facture Léo Clean                                            | Sur la facture de l'intervenant déclaré                                       |
| Avance immédiate URSSAF   | Léo Clean s'inscrit comme tiers de prestation                       | L'intervenant est le prestataire ; Léo Clean peut agir comme tiers technique  |
| Risque de requalification | **Élevé** (donneur d'ordre unique, tarifs imposés, planning imposé) | Modéré, si les garde-fous sont respectés                                      |
| Complexité produit        | Moindre                                                             | Supérieure (accompagnement SAP intervenant, facturation multi-émetteurs)      |

Le corpus est écrit pour le **modèle B**, ce qui explique pourquoi le funnel d'inscription accompagne l'intervenant jusqu'à sa propre déclaration SAP (`03-funnel`). Toutes les zones de code dépendantes exposent un flag :

```ts
// lib/config/business-model.ts
export const BUSINESS_MODEL = "MANDATAIRE" as "MANDATAIRE" | "PRESTATAIRE";
```

### 2.2 Garde-fous anti-requalification (contraintes de conception, non négociables)

Ces règles ne sont pas des recommandations UX, ce sont des invariants à faire respecter par le code :

1. **Aucune exclusivité.** Le profil intervenant comporte un champ « clients hors Léo Clean » visible et assumé ; aucune clause, aucun blocage produit.
2. **Le tarif est proposé, pas imposé.** L'intervenant dispose d'un taux horaire personnel dans une fourchette (plancher plateforme, pas de plafond). Le pricing client s'ajuste. Si le modèle A est retenu, ce point disparaît — et le risque monte.
3. **Refus sans pénalité contractuelle.** Un refus de mission n'entraîne aucune sanction ; il influence le score de fiabilité utilisé pour l'ordre de proposition, ce qui doit être explicité à l'intervenant (transparence algorithmique).
4. **Pas de pouvoir disciplinaire.** Le vocabulaire produit exclut « sanction », « avertissement », « suspension pour faute ». On parle de « mise en pause de compte » liée à la conformité documentaire ou à la sécurité.
5. **Tournée suggérée, jamais imposée.** L'optimisation d'itinéraire est un outil d'aide affiché en lecture, avec un bouton « réorganiser à ma façon ». Aucun ordre de passage contraignant, aucune alerte punitive de type « vous êtes hors tournée ».
6. **Géolocalisation ponctuelle.** Capture de position au check-in et au check-out uniquement, jamais de suivi continu. Finalité : preuve de réalisation. Rétention : 13 mois. Opt-out possible avec check-in par code fourni par le client.
7. **Disponibilités déclarées par l'intervenant**, jamais imposées, modifiables à J-72h sans justification.

### 2.3 Cadre SAP et fiscal

- **Déclaration SAP** (portail NOVA) : condition d'accès du client au crédit d'impôt de 50 % et à la TVA réduite. Dans le modèle B, elle appartient à l'intervenant, et le funnel doit la produire, pas la supposer.
- **Activité exclusive** : l'entité déclarée SAP doit exercer à titre exclusif des activités de services à la personne. À vérifier avec le conseil : un auto-entrepreneur cumulant ménage et jardinage déclaré reste conforme ; cumulant ménage et un tout autre code APE, non.
- **Avance immédiate** (crédit d'impôt versé au moment du paiement) : nécessite l'inscription du prestataire au dispositif API URSSAF, l'adhésion du client, et un flux de demande de paiement par prestation. C'est un chantier technique lourd — le mettre en **V2**, avec en V1 une attestation fiscale annuelle automatique (janvier N+1) qui suffit à déclencher le crédit d'impôt en déclaration.
- **Attestation fiscale annuelle** : générée par le produit, PDF nominatif, montants réglés sur l'année, mentions obligatoires, n° de déclaration SAP du prestataire.

### 2.4 Assurance et sinistres

- RC Pro obligatoire pour l'intervenant, vérifiée à l'inscription et suivie en date d'expiration (relances J-45 / J-15 / J-0, pause de compte à échéance).
- Souscription d'une **RC complémentaire plateforme** couvrant le dommage aux biens du client jusqu'à un plafond annoncé (ex. 10 000 €), avec franchise prise en charge par Léo Clean sur le premier sinistre d'un intervenant. Argument de conversion majeur côté client, à afficher dans le funnel de réservation.
- Le produit doit tracer : photos avant/après horodatées, checklist signée, déclaration de sinistre côté client sous 48 h avec upload, statut du dossier.

## 3. Personas

| Persona                                                    | Contexte                                             | Attentes produit                                                            | Anti-pattern à éviter                                                                          |
| ---------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Camille, 38 ans, cadre, Léognan**                        | 2 enfants, maison 120 m², bi-mensuel                 | Réserver en < 3 min, savoir qui vient, ne plus y penser                     | Formulaire long, choix de créneau vide, obligation de créer un compte avant d'avoir vu un prix |
| **Marc, 67 ans, retraité, Cadaujac**                       | Appartement 70 m², hebdo, sensible au crédit d'impôt | Simplicité extrême, gros caractères, contact humain, facture claire         | Chat comme seul canal, jargon SAP, absence de numéro de téléphone                              |
| **Sonia, 34 ans, intervenante déjà auto-entrepreneur**     | 12 clients, cherche à combler des trous              | Missions proches, paiement rapide, pas de paperasse redondante              | Re-saisie de ce qu'elle a déjà fourni, missions à 35 min, paiement à 45 jours                  |
| **Fatou, 29 ans, expérimentée mais pas auto-entrepreneur** | Veut se lancer, bloquée par l'administratif          | Être prise par la main jusqu'au SIRET et au SAP                             | Un funnel qui la rejette à l'étape « votre SIRET ? »                                           |
| **Paul, exploitant**                                       | Seul aux commandes, 30 min/jour de pilotage          | Voir en un écran ce qui va casser aujourd'hui et ce qui menace la rétention | Un dashboard de vanity metrics sans file d'actions                                             |

## 4. Architecture technique

### 4.1 Stack retenue

| Couche        | Choix                                                                                                                     | Justification                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Front         | **Next.js 15 App Router**, React 19, TypeScript strict                                                                    | Déjà en place, rendu serveur pour le SEO local, PWA                                        |
| Styling       | Tailwind CSS + tokens CSS custom properties                                                                               | Deux thèmes (consumer / ops) sur le même socle                                             |
| Base          | **Supabase (Postgres 16)** + RLS                                                                                          | Multi-rôles avec isolation par ligne, storage pour photos/documents, realtime pour le chat |
| Auth          | Supabase Auth — OTP SMS pour client et intervenant, e-mail + TOTP pour admin                                              | Le mot de passe est un frein sur mobile ; SMS = identité vérifiée de fait                  |
| Paiement      | **Stripe** (Customer, SetupIntent, Subscriptions pour les récurrences, Connect Express pour les reversements en modèle B) | Standard marché, SCA géré                                                                  |
| Notifications | Brevo (e-mail transactionnel), Twilio ou OVH SMS, Web Push (VAPID)                                                        | Push d'abord, SMS en secours sur les événements critiques                                  |
| Cartographie  | Mapbox (geocoding, isochrones 20 min, matrix API pour les trajets)                                                        | Les isochrones sont le cœur de la contrainte produit                                       |
| Fichiers      | Supabase Storage, buckets séparés `documents-kyc` (privé, signed URL 60 s) / `mission-photos` (privé)                     | Cloisonnement RGPD                                                                         |
| Observabilité | Sentry, Vercel Analytics, PostHog (funnels + session replay masqué)                                                       | Le module « frictions » de l'admin s'alimente de PostHog                                   |
| Jobs          | Vercel Cron + table `jobs` avec verrou consultatif Postgres                                                               | Relances, scores nocturnes, attestations                                                   |
| Hébergement   | Vercel (région `cdg1`), Supabase région EU (Francfort ou Paris)                                                           | Données personnelles hors transfert extra-UE                                               |

### 4.2 Structure des applications

Un seul déploiement Next.js, trois surfaces séparées par route groups :

```
app/
  (public)/            # site vitrine, SEO local, /travailler-avec-nous
  (client)/mon-espace/ # espace client, thème consumer
  (pro)/pro/           # espace intervenant, thème consumer-pro
  (pro)/rejoindre/     # funnel d'inscription intervenant
  (ops)/admin/         # console d'administration, thème ops
  api/
middleware.ts          # garde de rôle + redirection par surface
```

Rationale : un monolithe modulaire tant que l'équipe est de 1 à 3 personnes. Le découpage en applications distinctes n'apporte rien avant ~50 intervenants et coûterait un partage de session complexe.

### 4.3 PWA et mobile-first

- Manifest par surface (`/mon-espace` et `/pro` installables séparément, `id` et `start_url` distincts, icônes distinctes).
- Service worker : cache `stale-while-revalidate` sur les shells, **cache réseau-first avec fallback pour la fiche mission de l'intervenant** (voir `02`, mode offline).
- Cibles de performance, mesurées sur Moto G Power / 4G bridée : LCP < 2,0 s, INP < 200 ms, CLS < 0,05, JS initial < 180 kB gzip par surface.
- Aucune dépendance à la rotation d'écran ; tout est utilisable à une main, actions primaires dans le tiers inférieur.

## 5. Design system

### 5.1 Deux registres assumés

L'esthétique Lite Ops (panneau d'instruments, monospace, zéro rayon) est un excellent langage pour l'outil d'exploitation et un mauvais langage pour un client de 67 ans qui réserve un ménage. Le corpus sépare donc :

|          | **Thème `consumer`** (client + intervenant)                           | **Thème `ops`** (admin)                      |
| -------- | --------------------------------------------------------------------- | -------------------------------------------- |
| Registre | Convivial, aéré, rassurant — référence Wecasa                         | Panneau d'instruments, dense, informationnel |
| Rayon    | 12 px (cartes), 999 px (pills), 10 px (boutons)                       | 0 px partout                                 |
| Titres   | DM Sans SemiBold                                                      | DM Sans Medium, `letter-spacing: -0.01em`    |
| Corps    | DM Sans Regular 16 px min                                             | DM Sans 13/14 px                             |
| Données  | JetBrains Mono pour montants, durées, identifiants                    | JetBrains Mono par défaut sur toute donnée   |
| Densité  | 8 pt, respiration large, une décision par écran                       | 4 pt, tableaux, pas de scroll inutile        |
| Ombres   | `0 1px 2px rgba(20,21,15,.06)`, `0 8px 24px` sur les feuilles modales | Aucune ; séparation par filets 1 px          |

> ⚠ Ce dédoublement est un choix. Si tu préfères l'unité de marque totale, on garde le rayon 0 et le monospace partout — au prix d'un taux de conversion probablement inférieur sur le segment senior, qui pèse lourd sur le crédit d'impôt. Recommandation : garder la signature (Signal Green, monospace sur les chiffres, tons papier) et abandonner le rayon 0 côté grand public.

### 5.2 Tokens

```css
:root {
  /* Tons papier */
  --paper-000: #ffffff;
  --paper-050: #faf8f4;
  --paper-100: #f2efe7;
  --paper-200: #e6e1d6;
  --paper-300: #d3cdbf;

  /* Encre */
  --ink-900: #14150f;
  --ink-700: #3a3b33;
  --ink-500: #6b6c61;
  --ink-400: #8e8f84;

  /* Signature */
  --signal-500: #a5d900; /* Signal Green — accents, jauges, états actifs */
  --signal-600: #8fbe00; /* survol */
  --signal-050: #f2fadb; /* fonds d'état */

  /* Sémantique */
  --ok-600: #0f7a4a;
  --warn-600: #b4740a;
  --risk-600: #c0392b;
  --info-600: #2c5aa0;
  --ok-050: #e8f5ee;
  --warn-050: #fdf3e1;
  --risk-050: #fbeae7;
  --info-050: #eaf0fa;

  /* Typo */
  --font-sans: "DM Sans", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  /* Grille */
  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-5: 24px;
  --sp-6: 32px;
  --sp-7: 48px;
  --tap-min: 44px;
}
[data-theme="consumer"] {
  --radius-card: 12px;
  --radius-btn: 10px;
  --radius-pill: 999px;
}
[data-theme="ops"] {
  --radius-card: 0;
  --radius-btn: 0;
  --radius-pill: 0;
}
```

Contraste : Signal Green ne passe **pas** AA en texte sur fond clair. Règle : `--signal-500` sert de fond avec texte `--ink-900` dessus, ou de trait/jauge, jamais de couleur de texte sur papier. CTA primaire consumer = fond `--ink-900`, texte `--paper-050`, liseré `--signal-500` de 2 px en état focus.

### 5.3 Composants partagés (bibliothèque `@leo/ui`)

`Button` (primary/secondary/ghost/danger, `size: md|lg`, `loading`, `fullWidth`) · `Sheet` (bottom sheet mobile, dialog desktop) · `Stepper` · `DateSlotPicker` · `AddressAutocomplete` · `PhotoUploader` (compression client 1600 px, EXIF strippé sauf date) · `SignaturePad` · `StatusPill` · `Timeline` · `EmptyState` · `Money` (mono, format fr-FR) · `Duration` · `PersonCard` · `RatingInput` (5 étoiles + tags) · `ChatThread` · `DocumentSlot` (upload + statut de vérification) · `MapRadius`.

### 5.4 Patterns mobile-first

- **Navigation** : barre d'onglets basse, 4 entrées maximum, libellés toujours visibles (pas d'icône seule), safe-area iOS respectée.
- **Actions primaires** : bouton collant en bas d'écran, hauteur 52 px, jamais deux CTA de même poids.
- **Formulaires** : une question par écran dans les funnels, `inputmode` et `autocomplete` corrects, clavier numérique sur code postal / téléphone, pas de champ « confirmer votre e-mail ».
- **États** : chaque écran spécifie ses 5 états — chargement (squelette, jamais de spinner plein écran), vide (avec action), erreur (message actionnable + retry), succès, hors-ligne.
- **Accessibilité** : WCAG 2.2 AA, cible 44 px, focus visible, `prefers-reduced-motion`, taille de police système respectée jusqu'à 200 %, libellés de lecteur d'écran en français.

## 6. Cycle de vie d'une mission

```
                       ┌─────────────┐
                       │  DRAFT      │ panier de réservation non payé
                       └──────┬──────┘
                              │ paiement autorisé / SetupIntent OK
                       ┌──────▼──────┐
      aucun cleaner ◄──┤  PENDING    ├──► proposée à 1..n intervenants
      trouvé sous 6 h  │ _MATCHING   │
            │          └──────┬──────┘ acceptation
     ┌──────▼──────┐   ┌──────▼──────┐
     │ UNCOVERED   │   │  SCHEDULED  │
     └─────────────┘   └──────┬──────┘
        (alerte admin)        │ J-24h rappel · J-2h rappel
                       ┌──────▼──────┐
                       │ IN_PROGRESS │ check-in intervenant
                       └──────┬──────┘
                              │ check-out + rapport
                       ┌──────▼──────┐
                       │  COMPLETED  ├──► facturation, notation client
                       └──────┬──────┘
                        ┌─────▼─────┐
                        │  DISPUTED │ réclamation < 48 h
                        └───────────┘
Transitions latérales : CANCELLED_CLIENT · CANCELLED_PRO · RESCHEDULED · NO_SHOW_PRO · NO_SHOW_CLIENT
```

Règles de transition :

| Événement                | Conditions                         | Effets                                                                               |
| ------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------ |
| Annulation client > 24 h | —                                  | Remboursement intégral, aucune retenue                                               |
| Annulation client < 24 h | 1ʳᵉ occurrence sur 90 j : gratuite | Sinon 50 % facturés, dont 100 % reversés à l'intervenant                             |
| Annulation intervenant   | Toujours possible                  | Retour en `PENDING_MATCHING` avec priorité haute + alerte admin immédiate si < 48 h  |
| `NO_SHOW_PRO`            | Pas de check-in à H+20 min         | Alerte admin critique, appel client automatique proposé, geste commercial préparé    |
| `UNCOVERED`              | Aucune acceptation à H-48          | Escalade admin + proposition de créneau alternatif au client                         |
| `COMPLETED` sans rapport | Check-out sans photos              | Mission marquée `report_incomplete`, relance intervenant, pas de blocage de paiement |

## 7. Moteur de tarification

```
durée_estimée = base(surface, typologie) × coef_fréquence × coef_état + Σ options
prix_client   = durée_estimée × taux_horaire_intervenant × (1 + commission)
              + majorations − remises
```

| Paramètre             | Valeur de départ                                                                                 | Modifiable en admin        |
| --------------------- | ------------------------------------------------------------------------------------------------ | -------------------------- |
| Base                  | 1 h pour 30 m² habitables, plancher 2 h                                                          | Oui, table `pricing_rules` |
| Coef fréquence        | hebdo 0,90 · bi-mensuel 0,95 · mensuel 1,00 · ponctuel 1,15                                      | Oui                        |
| Options               | vitres +30 min · four +30 min · réfrigérateur +20 min · repassage +1 h/panier · fin de bail ×1,8 | Oui                        |
| Majorations           | samedi +10 % · dimanche/férié +25 % · réservation < 48 h +10 %                                   | Oui                        |
| Remises               | 1ʳᵉ mission −20 % (plafonnée) · parrainage 20 € croisés · abonnement annuel −5 %                 | Oui                        |
| Commission plateforme | 22 % HT (modèle B)                                                                               | Oui, par cohorte           |

Affichage client : **prix TTC après crédit d'impôt mis en avant**, prix avant crédit d'impôt en second, avec mention explicite « estimation, sous réserve d'éligibilité ». Ne jamais afficher un prix « après crédit d'impôt » comme s'il était encaissé si l'avance immédiate n'est pas active (risque de pratique commerciale trompeuse).

## 8. Moteur de matching

Score par candidat intervenant, calculé sur la mission :

| Critère              | Poids          | Détail                                                                                        |
| -------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| Couverture 20 min    | **filtre dur** | Matrix API depuis le point d'ancrage de l'intervenant ou depuis sa mission précédente du jour |
| Continuité           | 30             | Déjà intervenu chez ce client (+30), cleaner favori verrouillé (**filtre dur**)               |
| Compacité de tournée | 20             | Réduit un trou existant dans la journée                                                       |
| Fiabilité            | 20             | Score `pro_reliability` (§ `04`)                                                              |
| Qualité perçue       | 15             | Note moyenne pondérée récence, ≥ 5 avis sinon neutre                                          |
| Charge               | 10             | Écart à l'objectif hebdo déclaré par l'intervenant                                            |
| Compétences          | 5              | Repassage, vitres, animaux, produits spécifiques                                              |

Diffusion en vagues : les 3 meilleurs scores reçoivent l'offre pendant 30 min, puis élargissement à 8, puis à toute la zone, puis escalade admin. Une mission récurrente est réservée à l'intervenant titulaire pendant 12 h avant diffusion.

## 9. Conformité RGPD

| Traitement                         | Base légale                 | Rétention                                                                                          | Note                                                                    |
| ---------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Compte client, historique missions | Exécution du contrat        | 3 ans après dernière mission                                                                       | Purge automatisée, job nocturne                                         |
| Consignes d'accès (codes, clés)    | Contrat                     | Chiffrement applicatif AES-GCM, clé KMS ; visible J-24h → J+2h par l'intervenant affecté seulement | Jamais dans les logs, jamais dans le chat                               |
| Photos de mission                  | Intérêt légitime (preuve)   | 13 mois                                                                                            | Cadrage : pièces, pas de personnes ; consigne explicite à l'intervenant |
| Géoloc check-in/out                | Intérêt légitime            | 13 mois                                                                                            | Point unique, pas de trace                                              |
| Documents d'identité intervenant   | Obligation légale / contrat | 5 ans après fin de relation                                                                        | Bucket privé, accès journalisé, pas de téléchargement en masse          |
| Cookies analytics                  | Consentement                | 13 mois                                                                                            | PostHog en mode cookieless jusqu'au consentement                        |
| Enregistrements d'appel            | Consentement explicite      | 6 mois                                                                                             | Hors périmètre V1                                                       |

Registre des traitements, DPA Supabase/Vercel/Stripe/Brevo/Mapbox, mentions légales, politique de confidentialité, page « exercer mes droits » avec export JSON auto-servi et suppression avec délai de 30 jours.

## 10. Phasage

| Phase           | Contenu                                                                                                                                                                                                                       | Critère de sortie                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **MVP (S1-S6)** | Réservation ponctuelle + récurrente, espace client minimal, espace intervenant (tournée, check-in/out, rapport), funnel intervenant branche « déjà auto-entrepreneur », admin : dashboard signaux + missions + fiches + inbox | 20 clients actifs, 8 intervenants, 0 mission non couverte sur 2 semaines |
| **V1 (S7-S14)** | Funnel branche « création auto-entreprise + SAP guidés », abonnements Stripe, parrainage, attestation fiscale, scores churn/risque, analytics de friction, revue de dossiers outillée                                         | 80 clients, rétention M3 ≥ 70 %                                          |
| **V2 (S15+)**   | Avance immédiate URSSAF, optimisation de tournée multi-jours, marketplace d'options (vitres, repassage), app native si besoin de notifications fiables iOS, extension géographique                                            | Rentabilité par zone                                                     |
