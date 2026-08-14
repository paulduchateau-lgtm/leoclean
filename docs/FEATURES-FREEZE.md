# Gel fonctionnel — inventaire de référence

**État du dépôt au 14 août 2026**, commit `33bb013`, avant toute modification
d'expérience.

Ce document est le **contrat de non-régression** de la refonte UX. Il décrit ce
qui existe, pas ce qui devrait exister. Chaque fin de phase se relit contre lui :
toute ligne qui n'a plus d'équivalent à l'écran est une régression, quelle que
soit la qualité du parcours qui l'a remplacée.

Règle d'usage : une fonctionnalité peut **changer d'écran**, **être découpée**
ou **être renommée**. Elle ne peut pas disparaître. Si une amélioration exige de
retirer quelque chose, on s'arrête et on demande.

## Comment lire

- **Entrées** = ce qu'un humain saisit ou choisit.
- **Appels serveur** = server actions et route handlers effectivement invoqués.
- Les identifiants entre `backticks` sont les sélecteurs réellement utilisés par
  les tests de bout en bout : les changer casse `e2e/`, ce qui est le signal
  attendu, pas un accident à contourner.

---

## 1. Site public

### 1.1 `/` — Accueil

| | |
|---|---|
| Fichier | `src/app/page.tsx` |
| Rendu | statique, `revalidate = 86 400` |
| Entrées | aucune |
| Appels serveur | aucun |

Contenu à conserver :

- badge « 16 communes au sud de Bordeaux » ;
- titre, description issue de `SITE.description` ;
- `ContactChannels` (téléphone, WhatsApp, email) ;
- lien « Voir le détail des tarifs » → `/tarifs` ;
- mention « à partir de 29 €/h, minimum 2 heures », horaires d'ouverture ;
- 4 promesses (`PROMISES`) : intervenant attitré, proximité, vrai numéro,
  professionnels vérifiés ;
- liste des communes publiées avec temps de trajet, liens vers
  `/menage-a-domicile/<commune>` ;
- bloc « Également desservies » — affiché seulement si une commune desservie
  n'a pas de page (aujourd'hui vide, garde volontaire) ;
- JSON-LD `Organization` + `BreadcrumbList`.

> **Absent aujourd'hui** : aucun lien vers `/reserver` depuis cette page. Le
> seul accès au tunnel est le bouton de l'en-tête. Voir l'audit, friction 1.

### 1.2 `/menage-a-domicile` — Index des communes

| | |
|---|---|
| Fichier | `src/app/menage-a-domicile/page.tsx` |
| Rendu | statique, `revalidate = 86 400` |
| Entrées | aucune |

Liste des 16 communes, liens vers les pages locales, garde sur les communes
sans page dédiée.

### 1.3 `/menage-a-domicile/[commune]` — 16 pages locales

| | |
|---|---|
| Fichier | `src/app/menage-a-domicile/[commune]/page.tsx` |
| Rendu | `generateStaticParams` sur `PUBLISHED_COMMUNE_SLUGS`, `dynamicParams = false`, `revalidate = 86 400` |
| Entrées | formulaire de rappel (voir 4.4) |
| Appels serveur | `submitLead` |

Blocs à conserver, dans l'ordre :

1. fil d'Ariane ;
2. badge commune · code postal · Gironde ;
3. titre `Ménage à domicile à <commune>`, intro éditoriale ;
4. 4 indicateurs : à partir de, habitants, minutes depuis Léognan (ou « notre
   siège »), durée minimale ;
5. section « Les logements de <commune> » + points d'intérêt (`landmarks`) ;
6. tableau des tarifs (colonne crédit d'impôt conditionnée à
   `NEXT_PUBLIC_SAP_DECLARED`) + exemple 80 m² ;
7. FAQ propre à la commune (JSON-LD `FAQPage`) ;
8. CTA `Voir les créneaux à <commune>` → `/reserver` ;
9. `ContactChannels` avec `communeName` (préremplit l'objet du mail et le
   message WhatsApp) ;
10. `LeadForm` avec `defaultCommuneInsee` et `sourcePath` ;
11. horaires d'ouverture ;
12. liens vers les intentions secondaires de la commune, si publiées ;
13. liens vers les 15 autres communes avec leur temps de trajet ;
14. JSON-LD `Organization`, `Service`, `BreadcrumbList`, `FAQPage`.

> **Perte de contexte connue** : le CTA mène à `/reserver` sans transmettre la
> commune, alors que `BookingFunnel` accepte `defaultQuery`. Voir friction 2.

### 1.4 `/femme-de-menage/[commune]` et `/repassage/[commune]` — 12 pages

| | |
|---|---|
| Fichiers | `src/app/femme-de-menage/[commune]/page.tsx`, `src/app/repassage/[commune]/page.tsx`, composant `src/components/intention-page.tsx` |
| Rendu | statique, périmètre borné par `src/lib/intentions.ts` (6 communes par intention, ensembles différents) |
| Entrées | formulaire de rappel |
| Appels serveur | `submitLead` |

Contient : titre et intro propres à l'intention, sections éditoriales, FAQ,
`ContactChannels`, `LeadForm` prérempli, maillage vers la page commune.

### 1.5 `/tarifs`

| | |
|---|---|
| Fichier | `src/app/tarifs/page.tsx` |
| Rendu | statique, `revalidate = 86 400` |
| Entrées | aucune |

À conserver : tableau des deux formules (`PUBLIC_RATES`), colonne crédit
d'impôt conditionnée, tableau durée/prix pour 4 surfaces de référence
(40/70/100/140 m²), barème d'annulation à 6 paliers (`CANCELLATION_TIERS`), FAQ
de 4 entrées, JSON-LD `Service` + `FAQPage`.

### 1.6 `/blog` et `/blog/[article]`

| | |
|---|---|
| Fichiers | `src/app/blog/page.tsx`, `src/app/blog/[article]/page.tsx`, `src/components/article-body.tsx` |
| Rendu | statique |
| Entrées | aucune |

Articles en blocs typés (`src/lib/blog.ts`), rendus par `ArticleBody`. L'article
portant `requiresSapDeclaration` est retiré des listes, du sitemap, de
`llms.txt` et de `generateStaticParams` tant que `NEXT_PUBLIC_SAP_DECLARED` est
faux ; son URL renvoie 404. **Ce comportement est une contrainte juridique, pas
une préférence.**

### 1.7 `/a-propos`

Page éditoriale : histoire, méthode de recrutement, engagements, NAP.

### 1.8 `/etre-rappele`

| | |
|---|---|
| Fichier | `src/app/etre-rappele/page.tsx` |
| Entrées | `LeadForm` sans commune préremplie |
| Appels serveur | `submitLead` |

Comprend aussi `ContactChannels` sous le formulaire.

### 1.9 `/reserver` — Tunnel de réservation

| | |
|---|---|
| Fichiers | `src/app/reserver/page.tsx`, `src/components/booking-funnel.tsx` |
| Rendu | `dynamic = "force-dynamic"`, `robots: noindex, follow` |
| Appels serveur | `searchAddress`, `getQuote`, `getSlots`, `confirmBooking` |

Détail écran par écran en section 3.

Contient aussi, sous le tunnel : section « Vous préférez en parler ? » avec
`ContactChannels` et lien vers `/tarifs`.

---

## 2. Espace connecté et authentification

### 2.1 `/connexion`

| | |
|---|---|
| Fichiers | `src/app/(auth)/connexion/page.tsx`, `sign-in-form.tsx` |
| Entrées | email (`#email`) |
| Appels serveur | `requestMagicLink` |

Comportements à conserver :

- redirection vers `/` si une session existe déjà ;
- `callbackUrl` accepté seulement s'il est un chemin interne (pas de `//`) ;
- **réponse identique que l'adresse existe ou non** — anti-énumération ;
- limitation à 3 liens par 10 minutes et par adresse, silencieuse ;
- écran de succès « Regardez votre boîte mail », validité 15 minutes ;
- erreur de champ rendue dans `#email-error` ;
- `noindex, nofollow`.

### 2.2 `/connexion/verification`

Écran d'attente du lien, rappel des indésirables, lien de renvoi.

### 2.3 `/connexion/erreur`

Traduction française des codes Auth.js (`Verification`, `AccessDenied`,
`Configuration`) + repli générique, bouton « Demander un nouveau lien »,
contact email.

### 2.4 `/mon-compte`

| | |
|---|---|
| Fichier | `src/app/(app)/mon-compte/page.tsx` |
| Entrées | bouton de déconnexion |
| Appels serveur | `auth()`, `signOut()` |

Contenu **complet** aujourd'hui : adresse email de la session, liste des
appartenances avec libellé de rôle en français, état vide « rattaché à aucun
espace », déconnexion.

> **Il n'existe aucune liste de réservations, aucune modification, aucune
> annulation, aucune notation, aucun carnet d'adresses, aucun moyen de paiement,
> aucun parrainage dans l'interface.** Voir section 5 et l'audit.

### 2.5 `src/proxy.ts`

Redirection optimiste vers `/connexion?callbackUrl=…` pour `/mon-compte`,
`/intervenant`, `/gestion`, `/administration` en l'absence de cookie de session.
Ne fait pas d'autorisation. Ne pas y déplacer de contrôle.

---

## 3. Le tunnel, écran par écran

Ordre actuel : **Adresse → Logement → Créneau → Coordonnées → Confirmation**.
Barre d'étapes `Steps` en haut, libellés `["Adresse", "Logement", "Créneau",
"Coordonnées"]`.

### Étape 1 — Adresse

| Élément | Détail |
|---|---|
| Champ `#address` | recherche BAN, anti-rebond 300 ms, minimum 3 caractères |
| Indicateur de recherche | icône animée dans le champ |
| Résultats | jusqu'à 6, badge « Desservie » / « Hors zone », bouton désactivé si hors zone |
| Mention « Précisez le numéro » | si `isPreciseToHouseNumber` est faux |
| Message hors zone | si tous les résultats sont hors zone, avec lien `/menage-a-domicile` |
| Bascule | bouton « Saisir mon adresse manuellement », toujours présent |
| Saisie manuelle | `#manual-street` (min. 3 car.), `#manual-commune` (16 communes du référentiel, **jamais une saisie libre**), boutons « Rechercher plutôt » et « Continuer » |
| Effet du choix | déclenche `getQuote` **et** passe à l'étape 2 dans le même geste |

Invariant : la liste manuelle ne contient que des communes desservies — il est
structurellement impossible de réserver hors zone par ce chemin. Testé.

### Étape 2 — Logement

| Élément | Détail |
|---|---|
| Champ `#surface` | nombre, 15 à 400, pas de 5, défaut **80** |
| Aide | « La surface habitable, hors garage et cave. » |
| Fréquence | 4 choix : `WEEKLY`, `BIWEEKLY` (**défaut**), `MONTHLY`, `ONE_OFF`, chacun avec un sous-titre |
| Devis | durée estimée, tarif horaire, montant par intervention, mention minimum 2 h et « sans frais de déplacement » |
| Actions | « Retour », « Voir les créneaux » (désactivée tant que le devis manque) |
| Effet d'un changement | vide les créneaux et le créneau choisi, redemande le devis |

### Étape 3 — Créneau

| Élément | Détail |
|---|---|
| Regroupement | par journée civile française, en-tête au format `lundi 17 août` |
| Créneaux | heure de début seule, format `HH:MM`, un seul intervenant par heure |
| État vide | « Aucun créneau sur les trois prochaines semaines » + numéro de téléphone cliquable |
| Actions | tap sur un créneau = passage à l'étape 4 ; bouton « Retour » |

Horizon : 21 jours, 60 créneaux maximum.

### Étape 4 — Coordonnées

| Champ | Obligatoire | Notes |
|---|---|---|
| `#firstName` | oui | min. 2 caractères |
| `#lastName` | oui | min. 2 caractères |
| `#email` | oui | crée le compte |
| `#phone` | oui | formats libres acceptés, normalisés serveur |
| `#accessNotes` | non | « Étage, digicode, où sont les clés, présence d'un animal », max. 500 |
| `#clientNotes` | non | « Priorités pour la première fois », max. 1000 |

Comprend un récapitulatif (jour, heure, adresse, durée, montant), la mention
« Aucun paiement maintenant. Vous réglez après la prestation. », les boutons
« Retour » et « Réserver ».

**Sur créneau pris (`code === "BUSINESS"`)** : retour automatique à l'étape 3 et
message d'erreur. Ce comportement est non négociable.

### Écran de confirmation

Coche, « C'est réservé. », jour + heure + adresse + montant, annonce de l'email
de confirmation avec le nom de l'intervenant, numéro de téléphone.

---

## 4. Composants transverses

### 4.1 `SiteHeader`

Logo, liens `Tarifs` / `Conseils` / `À propos` (masqués sous 640 px), bouton
`Réserver`, téléphone (icône seule sous 640 px, intitulé accessible complet).

### 4.2 `SiteFooter`

Logo, NAP, téléphone, email, liste des communes publiées, liens vers les
intentions secondaires, `/blog`, `/etre-rappele` (**seul lien vers cette page
dans tout le site**), population desservie.

### 4.3 `ContactChannels`

Trois canaux dans cet ordre : téléphone (`tel:`), WhatsApp (`wa.me`, avec
message préremplissable par commune), email (`mailto:` avec objet
préremplissable par commune).

### 4.4 `LeadForm`

| Champ | Obligatoire |
|---|---|
| `#name` | oui |
| `#phone` | oui, formats libres |
| `#communeInsee` | non, préremplissable |
| `#email` | non |
| `#message` | non |

Protections à conserver **intégralement** : champ piège `website` invisible,
horodatage `renderedAt` relevé après montage, rejet silencieux sous 3 secondes
répondant comme un envoi légitime. Écran de succès « C'est noté, merci. » avec
numéro de téléphone.

### 4.5 `DemoBanner`

Bandeau non fermable affiché quand `NEXT_PUBLIC_DEMO_STATIQUE` est vrai.

---

## 5. Contrats serveur — intouchables

Aucune de ces signatures ne change pendant la refonte.

| Action | Fichier | Entrée | Sortie |
|---|---|---|---|
| `searchAddress` | `src/app/reserver/actions.ts` | `{ query: string ≥ 3 }` | `AddressChoice[]`, hors zone inclus |
| `getQuote` | idem | `{ surfaceSqm 15–400, frequency, optionSlugs ≤ 6 }` | `{ durationMinutes, hourlyRateCents, grossAmountCents, taxCreditAmountCents, netAmountCents }` |
| `getSlots` | idem | `{ lat, lng, inseeCode, durationMinutes 120–360 }` | `{ start, end }[]` en ISO UTC |
| `confirmBooking` | idem | 18 champs, cf. `confirmSchema` | `{ bookingId, startAt, endAt, grossAmountCents, netAmountCents }` |
| `submitLead` | `src/app/etre-rappele/actions.ts` | nom, téléphone, email, commune, message, source, piège, horodatage | `{ received: true }` |
| `requestMagicLink` | `src/app/(auth)/actions.ts` | `{ email, callbackUrl }` | `{ sent: true, throttled }` |

Interface `BookingBackend` (`src/lib/booking/backend.ts`) : quatre opérations,
deux implémentations — server actions en production, `src/lib/demo/backend.ts`
sur la vitrine statique. **Tout écran du tunnel doit rester servi par cette
interface**, sinon la vitrine de démonstration cesse de fonctionner.

---

## 6. Capacités présentes en base ou en bibliothèque, sans interface

Elles ne sont pas des fonctionnalités visibles : elles ne sont donc pas
couvertes par le compteur de non-régression d'écran. Elles ne doivent pas non
plus être supprimées, ni **recevoir une interface sans arbitrage** — ce serait
ajouter une fonctionnalité, ce que le gel interdit.

| Capacité | Où | État |
|---|---|---|
| Prestations `grand-menage` et `fin-de-bail` | `prisma/seed.ts`, catalogue | Le tunnel force `menage-regulier` |
| 7 options (repassage, vitres, four, réfrigérateur, placards, terrasse, vitrerie) | catalogue, `quoteFromCatalogue` | Le tunnel envoie toujours `optionSlugs: []` |
| Ajustement manuel de la durée | `durationOverrideMinutes` dans `quoteFromCatalogue` | Absent du schéma de `getQuote` |
| Abonnement récurrent | modèle `Subscription` | `createBooking` n'en crée pas ; la fréquence ne sert aujourd'hui qu'à choisir le tarif |
| Barème d'annulation | `src/lib/pricing/cancellation.ts` | Affiché sur `/tarifs`, aucune action d'annulation |
| Parrainage | `src/lib/referral/`, modèles `ReferralCode`, `Referral`, `ReferralReward` | Aucune interface, aucune server action |
| Avis | modèle `Review` | Aucune interface |
| Paiement | modèles `Payment`, `Payout`, `Invoice` | Phase 7, non commencée |
| Crédit d'impôt | calculé et stocké systématiquement | Affiché seulement si `NEXT_PUBLIC_SAP_DECLARED` |

---

## 7. Invariants à ne jamais franchir

1. **Le prix est recalculé côté serveur à la confirmation.** Jamais repris du
   formulaire, jamais calculé dans le navigateur.
2. **L'organisation est résolue côté serveur.** Aucune valeur venue du client.
3. **Couverture vérifiée serveur** dans `getSlots` et `confirmBooking`, avec un
   nom de commune issu du référentiel, jamais de la requête.
4. `/reserver` et tout espace connecté restent en `noindex`.
5. Sur la vitrine statique : toutes les pages en `noindex`, `robots.txt`
   interdisant tout, bandeau non fermable.
6. Le formulaire de rappel garde son champ piège **et** son délai de 3 secondes,
   avec réponse identique à un envoi légitime.
7. La connexion ne révèle jamais l'existence d'un compte.
8. L'article sur le crédit d'impôt reste invisible tant que
   `NEXT_PUBLIC_SAP_DECLARED` est faux.
9. Le client choisit une heure, **jamais une personne**.
10. Toutes les dates transitent en ISO UTC ; `Europe/Paris` n'existe qu'à
    l'affichage.

---

## 8. Contrôle de non-régression — à passer en fin de chaque phase

```bash
npm run check && npm run e2e
```

Puis, à la main :

- [ ] les 5 canaux de conversion sont atteignables : tunnel, rappel, téléphone,
      WhatsApp, email ;
- [ ] les 16 pages communes et 12 pages d'intention rendent leurs 14 blocs ;
- [ ] `LeadForm` conserve ses 5 champs et ses 2 protections anti-robot ;
- [ ] le tunnel conserve ses 12 entrées utilisateur (adresse ou saisie manuelle,
      surface, fréquence, créneau, 4 coordonnées, 2 champs libres) ;
- [ ] la bascule en saisie manuelle reste accessible à tout moment ;
- [ ] un créneau pris renvoie au choix de créneau avec un message ;
- [ ] `/mon-compte` affiche email, appartenances, déconnexion ;
- [ ] `npm run build:demo` produit toujours une vitrine dont le tunnel calcule
      réellement prix et créneaux.
