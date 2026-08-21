# 05 — Annexes techniques

## 1. Modèle de données (Postgres / Supabase)

Conventions : `id uuid default gen_random_uuid()`, `created_at/updated_at timestamptz`, suppression logique par `archived_at` sur les entités métier, énumérations en types Postgres pour bénéficier des contraintes.

### 1.1 Identité et rôles

```sql
-- profiles : 1-1 avec auth.users
profiles(id uuid pk → auth.users, role user_role, first_name, last_name,
         phone text unique, email text, avatar_url, locale default 'fr-FR',
         notif_prefs jsonb, last_seen_at, archived_at)

user_role: 'client' | 'pro' | 'admin_owner' | 'admin_ops' | 'admin_recruiter' | 'admin_support' | 'admin_read'
```

### 1.2 Client et logement

```sql
clients(id, profile_id fk, segment client_segment, acquisition_channel,
        referred_by_code, stripe_customer_id, churn_score int,
        churn_factors jsonb, lifetime_value_cents int, first_mission_at, archived_at)

properties(id, client_id fk, label, address_line1, address_line2, postal_code, city,
           lat numeric(9,6), lng numeric(9,6), place_id,
           property_type, surface_sqm int, rooms int, bathrooms int, wc int,
           floor int, has_elevator bool, parking_notes,
           access_type access_type,            -- interphone|code|keybox|gardien|voisin|presence
           access_secret_enc bytea,            -- AES-GCM, clé KMS, jamais en clair
           access_notes, forbidden_zones text,
           pets jsonb, allergies text, supplies jsonb, own_products bool,
           default_checklist jsonb)

property_key_log(id, property_id, pro_id, action, -- handed_over|returned|lost
                 signed_by_client bool, signed_at, notes)
```

### 1.3 Intervenant

```sql
pros(id, profile_id fk, status pro_status, anchor_lat, anchor_lng, anchor_city,
     travel_mode, radius_minutes int default 20,
     hourly_rate_cents int, target_hours_week int,
     siret char(14), siret_verified_at, ape_code, legal_name,
     sap_number text, sap_verified_at,
     stripe_connect_id, billing_mandate_signed_at,
     reliability_score int, reliability_factors jsonb,
     rating_avg numeric(3,2), missions_count int,
     activated_at, paused_at, pause_reason, archived_at)

pro_status: 'applicant'|'approved'|'active'|'paused'|'inactive'|'rejected'

pro_skills(pro_id, skill)                       -- ironing|windows|pets|eco|end_of_lease...
pro_zones(pro_id, insee_code, city, excluded bool)
pro_availability(id, pro_id, weekday int, slot slot_enum, active bool)
pro_absences(id, pro_id, starts_on, ends_on, reason, created_at)

pro_documents(id, pro_id, doc_type, storage_path, status doc_status,
              issued_on, expires_on, verified_by, verified_at, reject_reason,
              extracted jsonb)
doc_type: 'id_front'|'id_back'|'address_proof'|'sirene'|'urssaf_vigilance'|
          'sap_receipt'|'rc_pro'|'iban'|'vehicle_insurance'|'work_permit'
doc_status: 'missing'|'pending'|'verified'|'rejected'|'expired'

document_access_log(id, document_id, actor_id, action, at, ip)  -- RGPD
```

### 1.4 Candidature

```sql
pro_applications(id, profile_id, status application_status,
                 branch_legal branch_enum,     -- existing_siret | create_ae
                 branch_sap branch_enum,       -- existing_sap  | create_sap
                 score int, score_factors jsonb, flags jsonb,
                 declared_city, declared_availability jsonb, experience_level,
                 siret_submitted_at, siret_received_at,
                 sap_submitted_at, sap_received_at,
                 interview_at, interview_scores jsonb, interview_notes,
                 trial_at, trial_notes,
                 decided_by, decided_at, decision_reason,
                 source, utm jsonb, last_activity_at)

application_events(id, application_id, event, payload jsonb, at)
```

### 1.5 Missions

```sql
missions(id, client_id, property_id, pro_id, subscription_id,
         status mission_status, scheduled_date date, slot slot_enum,
         eta_start time, estimated_minutes int, actual_minutes int,
         checkin_at, checkin_lat, checkin_lng, checkin_method,
         checkout_at, checkout_lat, checkout_lng,
         price_cents int, pro_payout_cents int, commission_cents int,
         options jsonb, checklist jsonb, client_notes,
         risk_score int, risk_factors jsonb,
         cancelled_by, cancel_reason, cancel_fee_cents,
         report_complete bool, rating int, rating_tags text[], rating_comment,
         created_at, updated_at)

mission_status: 'draft'|'pending_matching'|'scheduled'|'in_progress'|'completed'|
                'uncovered'|'cancelled_client'|'cancelled_pro'|'rescheduled'|
                'no_show_pro'|'no_show_client'|'disputed'

mission_offers(id, mission_id, pro_id, wave int, sent_at, expires_at,
               status offer_status, response_at, decline_reason, match_score int)

mission_photos(id, mission_id, phase, -- before|after
               room, storage_path, taken_at, uploaded_at)

mission_anomalies(id, mission_id, type, description, photo_path,
                  duration_adjust_minutes int, admin_decision, decided_at)

mission_transitions(id, mission_id, from_status, to_status, actor_id, reason, at)

subscriptions(id, client_id, property_id, pro_id, frequency freq_enum,
              weekday int, slot slot_enum, options jsonb,
              status sub_status, paused_from, paused_to, pause_reason,
              stripe_subscription_id, price_cents,
              cancelled_at, cancel_reason, cancel_survey jsonb)
```

### 1.6 Finance

```sql
invoices(id, mission_id, client_id, pro_id, issuer issuer_enum, -- platform|pro
         number text unique, amount_cents, vat_cents, sap_number,
         pdf_path, issued_at, due_at, paid_at, status)

payments(id, client_id, mission_id, stripe_payment_intent, amount_cents,
         status, attempt int, failure_code, failed_at, retried_at)

payouts(id, pro_id, batch_id, amount_cents, stripe_transfer_id,
        period_start, period_end, status, executed_at)

credits(id, client_id, amount_cents, source, -- referral|gesture|compensation
        reason, created_by, expires_at, consumed_mission_id, consumed_at)

gestures(id, client_id, mission_id, type, amount_cents, reason_code,
         created_by, at)   -- journalisé, plafonné par rôle
```

### 1.7 Relation et qualité

```sql
conversations(id, kind, -- client_pro | client_ops | pro_ops | applicant_ops
              client_id, pro_id, mission_id, assigned_to,
              status, tags text[], sla_first_response_at, sla_resolved_at,
              last_message_at, closed_at)

messages(id, conversation_id, sender_id, body, attachments jsonb,
         is_internal_note bool, flags text[],  -- bypass_signal, negative_sentiment
         read_at, at)

claims(id, mission_id, client_id, pro_id, category, severity,
       description, photos jsonb, status, resolution, amount_cents,
       insurance_case_ref, sla_due_at, resolved_by, resolved_at)

referrals(id, code, owner_type, owner_id, invitee_type, invitee_id,
          status, reward_cents, awarded_at, abuse_flags jsonb)
```

### 1.8 Ops et configuration

```sql
action_items(id, type, priority, entity_type, entity_id, title, reason,
             sla_due_at, assigned_to, status, -- open|snoozed|done|closed
             snooze_until, snooze_reason, closed_reason, resolved_at)

frictions(id, detector, scope, magnitude numeric, affected_count int,
          estimated_impact_cents int, hypothesis, first_seen_at, last_seen_at,
          status, action_item_id, resolved_at, outcome)

pricing_rules(id, key, value jsonb, effective_from, effective_to, created_by)
zones(insee_code pk, city, status, radius_minutes, price_floor_cents,
      surcharges jsonb, demand_score, supply_score)
feature_flags(key pk, enabled bool, rollout jsonb)
audit_log(id, actor_id, action, entity_type, entity_id, before jsonb,
          after jsonb, reason, ip, at)
jobs(id, kind, run_at, payload jsonb, status, attempts, locked_at)
waitlist(id, kind, -- client|pro
         email, phone, city, lat, lng, created_at)
```

### 1.9 Index critiques

```sql
create index on missions (scheduled_date, status);
create index on missions (pro_id, scheduled_date);
create index on missions (client_id, scheduled_date desc);
create index on mission_offers (pro_id, status, expires_at);
create index on action_items (status, priority, sla_due_at);
create index on messages (conversation_id, at desc);
create index on pro_documents (pro_id, status, expires_on);
create index on clients (churn_score desc) where archived_at is null;
create index on properties using gist (point(lng, lat));
```

## 2. Politiques RLS (principes)

| Table | Client | Intervenant | Admin |
|---|---|---|---|
| `missions` | `client_id = auth_client()` | `pro_id = auth_pro()` **ou** offre active en cours | selon rôle |
| `properties` | ses propres logements | lecture des logements de ses missions **et** `access_secret_enc` déchiffré via RPC uniquement dans la fenêtre J-24h/J+2h | `owner`/`ops` |
| `pro_documents` | aucun accès | ses propres documents | `owner`, `admin_recruiter` seulement, accès journalisé |
| `messages` | conversations où il est partie | idem | selon rôle, notes internes invisibles aux non-admins |
| `gestures`, `pricing_rules` | aucun | aucun | `owner` en écriture, plafonds par rôle |
| `audit_log` | aucun | aucun | lecture `owner` seulement, aucune écriture applicative directe |

Le déchiffrement du code d'accès passe obligatoirement par une fonction `security definer` (`rpc_get_access_secret(mission_id)`) qui vérifie l'affectation et la fenêtre temporelle, et écrit dans `audit_log`. Aucun accès direct à la colonne.

## 3. Endpoints principaux

### Public / client
```
POST /api/quote                        estimation de prix (sans compte)
GET  /api/coverage?lat&lng             couverture isochrone
GET  /api/slots?propertyId&from&to     créneaux réellement disponibles
POST /api/bookings                     création (draft → pending_matching)
PATCH/api/bookings/:id                 report, modification
POST /api/bookings/:id/cancel          annulation + politique appliquée
GET  /api/missions/:id/report          rapport de mission
POST /api/missions/:id/rating          notation
POST /api/claims                       réclamation
GET  /api/invoices, /api/tax-certificate/:year
POST /api/subscriptions/:id/pause | /resume | /cancel
POST /api/referrals/share
```

### Intervenant
```
GET  /api/pro/today                    tournée + ordre suggéré
GET  /api/pro/offers                   propositions actives
POST /api/pro/offers/:id/accept | /decline
POST /api/pro/missions/:id/checkin     { lat, lng, method, offline_at? }
POST /api/pro/missions/:id/checkout    { checklist, actual_minutes }
POST /api/pro/missions/:id/photos      upload signé
POST /api/pro/missions/:id/anomalies
PUT  /api/pro/availability | /zones | /absences
GET  /api/pro/earnings?period
POST /api/pro/documents                upload + déclenchement de vérification
POST /api/pro/delay-notice             prévenir d'un retard (1 tap)
```

### Candidature
```
POST /api/apply/start                  éligibilité + création dossier
PATCH/api/apply/:id                    sauvegarde incrémentale par étape
POST /api/apply/:id/verify-siret       proxy API Sirene
POST /api/apply/:id/sap                déclaration SAP (n° + récépissé)
POST /api/apply/:id/help               "je suis bloqué" → ticket
POST /api/apply/:id/interview-slot
POST /api/apply/:id/sign               charte, CGU, mandat de facturation
```

### Admin
```
GET  /api/admin/radar                  agrégat unique de l'écran d'accueil
GET  /api/admin/actions?filters
POST /api/admin/actions/:id/resolve | /snooze | /assign
POST /api/admin/missions/:id/reassign  { proId | broadcast }
GET  /api/admin/clients/:id/360
POST /api/admin/clients/:id/gesture
GET  /api/admin/pros/:id/360
POST /api/admin/pros/:id/pause | /resume
GET  /api/admin/applications?status
POST /api/admin/applications/:id/decide { decision, reasonCode, note }
GET  /api/admin/inbox?queue
POST /api/admin/conversations/:id/reply | /assign | /resolve
GET  /api/admin/frictions
GET  /api/admin/finance/summary?month
```

## 4. Taxonomie d'événements analytics

Nommage `objet_verbe_au_passé`, propriétés en `snake_case`, `user_id` pseudonymisé.

**Client** : `quote_requested` · `coverage_checked` (`covered`) · `booking_step_viewed` (`step`) · `booking_step_completed` (`step`, `duration_ms`) · `booking_abandoned` (`step`, `last_field`) · `account_created` (`method`) · `booking_confirmed` (`frequency`, `price_cents`, `options`) · `mission_rescheduled` · `mission_cancelled` (`hours_before`) · `rating_submitted` (`stars`) · `claim_submitted` (`category`) · `subscription_paused` / `_cancelled` (`reason`) · `referral_shared` / `_converted` · `payment_failed` (`code`) · `tax_certificate_downloaded`.

**Intervenant** : `offer_received` / `_viewed` / `_accepted` / `_declined` (`reason`, `response_ms`) · `checkin_recorded` (`method`, `delta_minutes`, `offline`) · `checkout_recorded` (`actual_minutes`, `photos_count`) · `anomaly_reported` (`type`) · `delay_notice_sent` · `availability_changed` · `document_uploaded` (`type`, `attempt`) · `payout_received` · `training_module_completed`.

**Candidature** : `application_started` (`source`) · `application_step_completed` (`step`) · `application_branch_taken` (`branch`) · `application_help_requested` (`step`) · `siret_verification_succeeded` / `_failed` (`reason`) · `sap_declared` · `application_decided` (`decision`, `reason_code`, `days_in_pipeline`).

**Ops** : `action_created` (`type`, `priority`) · `action_resolved` (`sla_met`, `minutes_to_resolve`) · `gesture_granted` (`type`, `amount_cents`, `reason`) · `mission_reassigned` (`trigger`) · `friction_detected` (`detector`, `magnitude`) · `friction_resolved` (`outcome`).

## 5. Matrice de notifications

| Événement | Client | Intervenant | Admin |
|---|---|---|---|
| Réservation confirmée | Push + e-mail | Proposition (push + SMS) | — |
| Mission acceptée | Push | Push | — |
| Aucune acceptation H-48 | — | Rediffusion élargie | **P0 + SMS** |
| Rappel J-1 | Push + SMS 18 h | Push 18 h | — |
| Heure resserrée | Push matin | — | — |
| En route | Push | — | — |
| Check-in | Push | — | — |
| Check-in manquant H+10 | — | Push | — |
| Check-in manquant H+20 | — | — | **P0 + SMS** |
| Mission terminée | Push + rapport | — | — |
| Note ≤ 3 | — | Groupé quotidien | **P1** |
| Réclamation | Accusé + SLA | Sollicitation de version | **P0/P1** |
| Annulation client < 24 h | Confirmation + montant | Push + SMS | P2 |
| Annulation intervenant | Push + SMS | Accusé | **P0 si < 48 h** |
| Paiement échoué | J+1 push/e-mail, J+3 SMS | — | P1 puis P0 |
| Document expirant | — | J-45/15/3/0 | P2 |
| Compte mis en pause | — | Push + e-mail + chemin de régularisation | — |
| Virement exécuté | — | Push + e-mail | — |
| Dossier : pièce refusée | — | Push + e-mail avec motif clair | — |
| Dossier validé | — | Push + e-mail + propositions immédiates | — |
| Relances funnel | — | J+1/3/7 contextuelles | — |
| Attestation fiscale | E-mail janvier | — | — |
| Récap quotidien | — | — | E-mail 7 h et 19 h |

Règles transverses : fenêtre 7 h-21 h sauf urgence opérationnelle du jour ; regroupement des notifications non critiques ; préférences respectées sauf pour les notifications strictement contractuelles (annulation, paiement, mission) ; tout envoi journalisé avec statut de délivrabilité.

## 6. Jobs planifiés

| Job | Fréquence | Rôle |
|---|---|---|
| `matching_waves` | 5 min | Progression des vagues de diffusion, expiration des offres |
| `mission_reminders` | 15 min | J-1, H-1, resserrement d'ETA |
| `checkin_watchdog` | 5 min | Détection H+10 / H+20 / H+40 |
| `recurrence_generator` | quotidien 2 h | Génération des missions récurrentes à J+21 |
| `scores_recompute` | quotidien 3 h | Churn, fiabilité, risque, score de dossier |
| `friction_detectors` | quotidien 4 h | Règles du § 7 de `04` |
| `document_expiry` | quotidien 6 h | Relances et mises en pause |
| `application_nudges` | quotidien 9 h | Relances contextuelles du funnel |
| `payout_batch` | vendredi 6 h | Lot de reversements |
| `payment_retries` | quotidien | Relances Stripe échelonnées |
| `tax_certificates` | 5 janvier | Génération et envoi |
| `gdpr_retention` | quotidien 1 h | Purge photos > 13 mois, géoloc > 13 mois, comptes > 3 ans |
| `sirene_revalidation` | mensuel | Revérification des SIRET actifs |

## 7. Sécurité

- Authentification : OTP SMS (client, intervenant) avec rate limiting agressif ; e-mail + **TOTP obligatoire** pour tous les rôles admin ; sessions admin de 12 h.
- Autorisation : RLS Postgres **plus** vérification applicative dans chaque route handler (défense en profondeur — ne jamais compter sur la RLS seule pour les routes admin).
- Chiffrement applicatif des codes d'accès (AES-256-GCM), clé hors base, rotation annuelle.
- Documents : buckets privés, signed URLs 60 s, `Content-Disposition: attachment`, aucun accès en masse, journalisation de chaque lecture.
- Webhooks Stripe : vérification de signature, idempotence par `event.id`.
- Uploads : type MIME et magic bytes vérifiés côté serveur, taille limitée, EXIF de géolocalisation strippé sur les photos de mission, ré-encodage systématique.
- CSP stricte, en-têtes de sécurité, protection CSRF sur les mutations, rate limiting par IP et par compte sur `/api/quote`, `/api/apply/*`, envois d'OTP.
- Sauvegardes : PITR Supabase, test de restauration trimestriel documenté.
- Journal d'audit immuable (append-only, pas de `update`/`delete` accordés au rôle applicatif).

## 8. Environnements et qualité

| Environnement | Données | Usage |
|---|---|---|
| `local` | seed anonymisé | Développement |
| `preview` (par PR) | seed | Revue, tests E2E |
| `staging` | anonymisé, Stripe test, SMS mock | Recette |
| `production` | réel | — |

- Tests : unitaires sur pricing/matching/scores (cœur métier, couverture ≥ 85 %), intégration sur les transitions de mission, E2E Playwright sur les 4 parcours critiques (réservation client, cycle mission intervenant, funnel intervenant branche B, revue de dossier admin), test d'accès sur les documents et codes d'accès.
- CI : typecheck, lint, tests, budget de bundle par surface, audit lexical anti-vocabulaire disciplinaire (`02 § 11.5`), scan de secrets.
- Feature flags sur toute fonctionnalité touchant au paiement, au matching ou au funnel.
