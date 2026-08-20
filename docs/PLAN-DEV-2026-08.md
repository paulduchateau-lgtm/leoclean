# Plan de développement — d'ici la mise en production complète

Établi le 19 août 2026, à partir de [l'analyse d'écarts](ANALYSE-ECARTS-SPECS.md)
et des arbitrages rendus par le porteur du projet le même jour.

Dix jalons, cinquante lots. Le plan couvre l'intégralité du corpus de
spécifications ; il n'est pas fait pour être exécuté d'un bloc, il est fait pour
que chaque lot sache ce qu'il attend des autres.

---

## État d'avancement au 20 août 2026

| Jalon                         | État | Livré, et ce qui manque                                                                                                                                          |
| ----------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** — Fondations            | ✅   | stockage (politique + interface), taxonomie d'événements, densité de la console, absences                                                                        |
| **B** — Le prix et la demande | ✅   | contre-proposition d'horaire dès l'écran de proposition, majorations, captation hors zone                                                                        |
| **C** — Le logement           | ✅   | champs du logement, code de porte chiffré et fenêtré, journaux de lecture et de clés                                                                             |
| **D** — La mission se termine | ◐    | pointage, checklist, anomalies, `COMPLETED`, notation de bout en bout, écran « Aujourd'hui ». **Manquent** photos (adaptateur écrit, bucket à créer), hors ligne |
| **E** — L'argent              | ◐    | calendrier pur, préautorisation, prélèvement, libération, webhook. **Manquent** SetupIntent au tunnel, Connect, factures, attestation                            |
| **F** — Le recrutement        | ◐    | machine à états, vérification SIRET par l'API Sirene, éligibilité, ouverture de dossier. **Manquent** pièces, entretien, signature, parcours guidés              |
| **G** — La récurrence         | ✅   | abonnement écrit par le tunnel, générateur idempotent, pause et rétention                                                                                        |
| **H** — Les espaces           | ◐    | abonnement (pause, reprise, résiliation), notation, parrainage client et cooptation, revenus, suivi de candidature. **Manquent** messagerie, profil public       |
| **I** — Le pilotage           | ◐    | file d'actions à dix règles, priorités et délais. **Manquent** Radar, scores, CRM, inbox                                                                         |
| **J** — Conformité            | ◐    | rétention automatique branchée sur l'ordonnanceur. **Manquent** réclamations, rôles étendus, TOTP                                                                |

**724 tests unitaires** (52 fichiers), vitrine statique vérifiée à chaque jalon.

**Le stockage est tranché : Scaleway Object Storage** (arbitrage du 20 août
2026), compatible S3 et hébergé en France — les pièces d'identité ne quittent
pas l'Union européenne, ce qui évite d'avoir à documenter un transfert.
L'adaptateur est écrit (`src/lib/stockage/s3.ts`) ; **il attend le bucket et sa
clé**, et tant qu'ils manquent le dépôt reste fermé plutôt que d'accepter un
fichier qu'on perdrait. Réglages à faire dans
[SECURITE-ACCES.md](SECURITE-ACCES.md).

Stripe est connecté chez l'hébergeur mais pas en local, si bien que le code du
paiement n'a pas pu être exercé contre le vrai service.

**Ce qui reste est surtout de l'interface.** Chaque jalon partiel a son module
pur écrit et testé ; ce qui manque tient dans des écrans — revue de dossier,
inbox, CRM, entretien, signature, messagerie — plus le dépôt de pièces, qui
n'attend que le bucket.

---

## 0. Arbitrages rendus — ce qui est désormais fermé

| Sujet                  | Décision                                                                                                                                                          | Conséquence sur le plan                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Créneau vendu**      | **Heure ferme.** Le client choisit l'heure de son intervention, comme le tunnel le fait déjà, et le moteur ne restreint pas les heures proposées.                 | Aucun lot, aucun changement de schéma, aucune migration                                                                                             |
| **Encaissement**       | **Modèle du dépôt** : préautorisation à H-24, prélèvement à H+24.                                                                                                 | Jalon E. La carte est enregistrée à la réservation par SetupIntent — sans quoi il n'y a rien à préautoriser à H-24                                  |
| **Parrainage**         | **5 % du CA du filleul**, dès sa 5ᵉ mission, 12 mois, plafond 150 €/mois. `referral/rules.ts` reste la vérité.                                                    | Jalon H. Aucune réécriture du moteur, seulement des écrans et un versement                                                                          |
| **Crédit d'impôt**     | Rien ne s'affiche tant que `NEXT_PUBLIC_SAP_DECLARED` est faux. Le jour où la déclaration est obtenue, la variable et le numéro suffisent.                        | Aucun lot. `fiscal.ts` tient déjà la règle. Le seul travail est de ne pas la contourner dans les écrans neufs — un test le vérifiera à chaque jalon |
| **Contre-proposition** | **L'intervenant peut proposer une autre heure dès l'écran de proposition.** Sous une heure d'écart, elle part au client immédiatement, comme une pré-acceptation. | Lot B1. `SlotProposal` existe déjà : c'est un déclencheur et un seuil qui changent, pas un modèle                                                   |
| **Majorations**        | **Samedi +10 %, dimanche et férié +25 %, réservation < 48 h +10 %.**                                                                                              | Lot B2                                                                                                                                              |
| **Console**            | **Pas de thème ops.** Une variante dense de tropical punch, même palette, mêmes tokens.                                                                           | Lot A3                                                                                                                                              |

### Deux précisions que ces arbitrages appellent

**La capacité se gagne côté intervenant, pas côté client.** Vendre une heure
ferme sans restreindre les heures proposées signifie que la journée d'un
intervenant se fragmente : une mission placée au milieu d'une journée vide la
coupe en deux, et Léo Clean refusera parfois une mission qui tenait
physiquement.

C'est un arbitrage assumé, et il est cohérent avec tout le reste du produit :
**on ne corrige pas cela en réduisant le choix du client, mais en donnant la
main à celui qui a l'information.** L'intervenant est le seul à connaître sa
journée en entier ; le lot B1 lui permet de proposer une autre heure quand cela
arrange sa tournée, et le lot D5 lui montre ses trous avec de quoi les remplir.
Le moteur ne décide donc rien à la place de personne — ni du client, ni de
l'intervenant.

**Une majoration a un bénéficiaire, et il n'est pas le même selon sa cause.**
La majoration de jour — samedi, dimanche, férié — revient à **l'intervenant** :
c'est lui qui travaille le week-end. La majoration de délai — réservation à
moins de 48 h — revient à **la plateforme** : c'est elle qui place une mission
en urgence, sans tournée à remplir. Ce partage prolonge la règle déjà tenue par
le dépôt, où la marge est un écart et non un taux, et il évite la question
insoluble d'un pourcentage réparti au prorata.

---

## 1. Ordre et dépendances

```
A ── Fondations ─────────────────────────────┐
     stockage · événements · densité · absences
                                             │
B ── Le prix et la demande ───────────────────┤   B indépendant
     contre-proposition · majorations · hors zone│
                                             │
C ── Le logement ────────────────────────────┤   C après A1 (photos, pièces)
     Property · secret d'accès · consignes   │
                                             │
D ── La mission se termine ──────────────────┤   D après A1, C
     check-in/out · rapport · notation       │
     écran du jour · notifications · offline │
                                             │
E ── L'argent ───────────────────────────────┤   E après D (capture ⇢ COMPLETED)
     Stripe · factures · attestation · revenus│
                                             │
     ══ ligne de mise en production ══════════╡
                                             │
F ── Le recrutement ─────────────────────────┤   F après A1, C ; amène Inngest
G ── La récurrence ──────────────────────────┤   G après E
H ── Les espaces complets ───────────────────┤   H après E, G
I ── Le pilotage ────────────────────────────┤   I après A2 et beaucoup de volume
J ── Litiges et conformité ──────────────────┘   J après D, E
```

**La ligne de mise en production passe après E.** À ce stade le service tourne
et encaisse. Le recrutement continue de se faire à la main par
`npm run db:intervenant` — c'est tenable jusqu'à une dizaine d'intervenants, et
au-delà c'est F qui devient le goulot.

---

## Jalon A — Fondations

Rien de visible. Tout le reste en dépend.

### A1 · Stockage de fichiers

Il n'y en a aucun aujourd'hui, et il conditionne les photos de mission, les
pièces justificatives et les PDF de factures.

- `src/lib/stockage/` avec une interface remplaçable, sur le modèle de
  `scheduling/travel.ts` : une implémentation **Scaleway Object Storage**
  (compatible S3, hébergée en France — arbitrage du 20 août 2026, Vercel Blob
  était l'hypothèse initiale), une implémentation mémoire pour les tests.
- Deux préfixes cloisonnés, `kyc/` et `missions/`, jamais servis en direct :
  URL signée de 60 secondes engendrée à la demande, `Content-Disposition:
attachment`, aucun accès en masse.
- Contrôle d'entrée : type MIME **et** nombres magiques, taille plafonnée,
  ré-encodage systématique des images, EXIF de géolocalisation retiré, date
  conservée.
- Modèle `FileAccessLog` — qui, quand, quel fichier. Exigence RGPD et
  protection en cas de litige.

_Sortie_ : un fichier déposé n'est lisible que par une URL signée vivant moins
de 60 secondes, vérifié par test.

### A2 · Taxonomie d'événements

Le seul lot dont le coût monte chaque semaine où il n'est pas fait.

- `src/lib/analytics/evenements.ts` : union typée reprenant la taxonomie du
  corpus (`05 § 4`), nommage `objet_verbe_au_passé`, propriétés en
  `snake_case`. Pur.
- Écriture dans une table `AnalyticsEvent` plutôt que chez un tiers : le module
  Frictions lira la même base, et cela évite une bannière de consentement pour
  une mesure qui n'en a pas besoin. Un export vers PostHog reste possible plus
  tard, il ne conditionne rien.
- Émission **côté serveur** partout où c'est possible : aucun poids ajouté au
  premier octet, aucun blocage par un bloqueur de publicité.
- Instrumentation immédiate des deux funnels existants : tunnel de réservation
  et formulaire de rappel.

_Sortie_ : les six écrans du tunnel émettent `vus` / `complétés` / `abandonnés`
avec leur durée, et une requête SQL suffit à sortir le taux d'abandon par
écran.

### A3 · Variante dense de tropical punch

Pas un second design system : une densité.

- `data-density="compact"` posé sur le gabarit de `(app)/administration`.
- Redéfinition des seuls tokens d'espacement et de rayon — `--sp-*` divisés par
  deux, rayons pris sur les barreaux bas de l'échelle existante (6 px et
  14 px), **jamais 0** : le système interdit l'angle vif et la console n'y fait
  pas exception.
- Corps à 14 px, JetBrains Mono sur toute donnée chiffrée, tableaux plutôt que
  cartes, filets plutôt qu'ombres.
- **Aucune couleur touchée.** Mangue, sarcelle, ananas, papaye et encre restent
  ceux du site. Une console qui ne ressemble pas à la marque est une console
  qu'on oublie de tenir à jour.

_Sortie_ : la même page rendue avec et sans l'attribut affiche le même contenu,
et `contrast.test.ts` passe dans les deux densités.

### A4 · Absences de l'intervenant

Le moteur lit `AvailabilityException` et les fait gagner sur les ouvertures
exceptionnelles ; rien ne les écrit. Un intervenant en congé reçoit aujourd'hui
des missions.

- Écran `/intervenant/absences` : plages de dates, motif optionnel.
- Server action portant la capacité `availability:manage:own` — celle qu'aucun
  rôle de gestion ne détient, et c'est intentionnel.
- Assistant lorsqu'une absence recouvre des missions acceptées : liste des
  missions concernées, et remise en diffusion à la demande de l'intéressé.

_Sortie_ : poser une absence retire les créneaux correspondants de la recherche
client en moins de 60 secondes. Le lot le moins cher du plan et le plus urgent.

**Charge estimée : 2 à 3 semaines-personne.**

---

## Jalon B — Le prix et la demande

Les lots consacrés à la plage de trois heures et au filtrage des heures
proposées sont **retirés** : le client choisit son heure et voit toutes celles
qui sont faisables. Ce qui reste est indépendant du reste du plan et peut se
faire quand on veut.

### B1 · La contre-proposition d'horaire, dès l'écran de proposition

Le second levier de compaction, et il vient de l'intervenant plutôt que du
moteur : lui seul connaît sa journée en entier.

**Presque tout existe.** `SlotProposal`, `proposerUnAutreCreneau`,
`repondreAProposition`, l'expiration par l'ordonnanceur et l'acceptation en deux
temps sont écrits et testés. Une seule ligne les bride : `canProposeSlot` exige
`bookingStatus === "PENDING_ASSIGNMENT"`, c'est-à-dire une recherche déjà
échouée. Le lot lève cette condition et ajoute un seuil.

- **Troisième action sur l'écran de proposition**, à côté d'accepter et de
  refuser : « je peux, mais à telle heure ». Ouverte tant que l'affectation est
  `PROPOSED`.
- **Sous une heure d'écart, la proposition part au client tout de suite** — une
  pré-acceptation : l'intervenant s'engage, le client n'a qu'à dire oui. Au-delà
  d'une heure, la contre-proposition est conservée et ne remonte au client que si
  le lot expire sans acceptation, c'est-à-dire le comportement actuel. Un seul
  mécanisme, deux vitesses, et le seuil est le seul paramètre neuf.
- **Une acceptation à l'heure demandée l'emporte toujours** sur une
  pré-acceptation : c'est l'heure que le client a choisie. Les
  pré-acceptations vivantes passent alors en `SUPERSEDED` — le statut existe et
  dit déjà la bonne chose, une course perdue et non un refus. L'intervenant en
  est prévenu à l'avance, pour qu'il n'y ait pas de mauvaise surprise.
- **Une pré-acceptation ne bloque rien en base**, conformément à la règle du
  dépôt : seul `ACCEPTED` occupe un planning. Mais tant qu'elle vit, le moteur
  cesse de proposer à cet intervenant des missions qui la contrediraient. Un
  filtre doux, pas un verrou : l'engagement devient tenable sans geler une heure
  pour une mission non confirmée.
- **Le prix ne bouge jamais.** L'heure proposée doit rester dans le même jour
  civil et la même tranche tarifaire — la règle existe déjà pour la durée
  (« un prix qui bouge après la réservation n'est plus une proposition »), on
  l'étend aux majorations du lot B2.
- **Fenêtre de réponse courte** pour la voie rapide : quelques heures, ou
  l'échéance du lot si elle tombe avant. Une pré-acceptation qui dort un jour
  entier est presque sûrement périmée.
- Le client peut voir jusqu'à trois heures alternatives et **garder son heure
  d'origine** : refuser doit être un bouton de même poids qu'accepter.

_Sortie_ : un intervenant qui pouvait faire la mission à 10 h mais pas à 9 h ne
la refuse plus. Le taux de contre-proposition et le taux d'acceptation client
sont mesurés — s'ils dérivent, on le verra ; aucune pénalité n'est prévue, et
c'est volontaire.

### B2 · Majorations

- `PricingSurcharge` : `kind` (`SATURDAY` · `SUNDAY_HOLIDAY` · `SHORT_NOTICE`),
  `rateBp`, `beneficiary` (`PROFESSIONAL` · `PLATFORM`), historisée comme
  `PricingRule` par `validFrom` / `validUntil`.
- `src/lib/pricing/feries.ts`, pur : les onze fériés français, Pâques calculée
  et non listée — une table de dates en dur se périme en silence.
- Le devis applique la majoration **à la part de son bénéficiaire**, et la
  répartition continue d'additionner exactement au total : on calcule la part
  de l'intervenant et la coordination reste le reste.
- `public-grid.ts` porte les majorations pour que le site les annonce ; page
  tarifs et tunnel les affichent **avant** l'engagement.
- `npm run db:tarifs` les propage comme il propage déjà la grille.

_Sortie_ : un dimanche coûte 25 % de plus qu'un mardi, l'intervenant touche la
totalité de l'écart, et le test qui vérifie la répartition sur des milliers de
combinaisons passe toujours.

### B3 · Captation hors zone

Le tunnel rend une réservation hors zone structurellement impossible, ce qui
est bien — mais le produit n'a donc aucun signal d'expansion.

- Modèle `Waitlist` : type (client ou intervenant), contact, commune, point,
  origine.
- Formulaire posé sur la page des zones desservies et à l'entrée du funnel
  intervenant, avec la même protection anti-robot que `LeadForm`.

_Sortie_ : la demande hors zone est comptée par commune. Alimente le module
Zones du jalon I.

**Charge estimée : 1 semaine-personne.**

---

## Jalon C — Le logement

`Address` est un point postal. La mission a besoin d'un logement.

### C1 · `Address` → `Property`

- Champs nouveaux : type, pièces, salles de bain, WC, étage, ascenseur,
  stationnement, zones interdites, animaux, allergies, matériel disponible,
  produits fournis ou non, checklist par défaut.
- L'adresse reste ce qu'elle est — une position — et le logement la porte. La
  migration recopie l'existant et ne perd rien.
- Le dernier écran du tunnel se réécrit : il ne demande plus une adresse, il
  ouvre ou complète un logement. Pour un client connu, `known-client.ts`
  propose ses logements en un geste, comme il propose déjà ses adresses.

### C2 · Le secret d'accès

Le point le plus sensible du plan.

- `Property.accessSecretEnc`, chiffré en AES-256-GCM, clé hors base.
- `src/lib/logement/secret.ts`, `server-only`, **seul** module capable de
  déchiffrer. Trois conditions vérifiées ensemble : le demandeur détient une
  affectation `ACCEPTED` sur une réservation de ce logement, l'instant est
  compris entre J-24 h et J+2 h, et l'accès est journalisé nominativement.
- Le client écrit son code une fois et ne le revoit jamais en clair —
  « code enregistré · modifier ».
- Un test refuse tout autre module important ce fichier, et un test de bout en
  bout vérifie que le code n'apparaît dans **aucune** réponse d'API hors de la
  fenêtre. C'est le critère d'acceptation `01 § 14.3`, et il se teste.

### C3 · Consignes et checklist par défaut

Consignes par pièce, zones interdites, animaux avec leur tempérament,
allergies et produits à éviter. C'est ce qui rend un changement de prestataire
coûteux pour le client, donc c'est un actif de rétention autant qu'un confort.

### C4 · Journal de remise de clés

`PropertyKeyLog` : remise, restitution, perte, avec accord des deux parties et
horodatage. Sans ce journal, une clé perdue est une discussion sans pièce.

**Charge estimée : 2 semaines-personne.**

---

## Jalon D — La mission se termine

Le chaînon manquant. Aujourd'hui la vie d'une réservation s'arrête à
`CONFIRMED`.

### D1 · Check-in et check-out

- Modèle `MissionCheck` : sens, instant, position, précision, méthode, motif de
  forçage, instant d'enregistrement hors ligne.
- Position capturée **au tap seulement**, jamais en continu, tolérance 150 m,
  **jamais bloquante** : sous-sol, immeuble mal géocodé, refus de localisation.
  Forcer est possible et journalisé.
- Repli sans GPS : code à quatre chiffres fourni par le client dans son espace.
- Rétention 13 mois, purgée par le jalon J.

_Sortie_ : depuis l'écran d'accueil intervenant, le check-in de la mission
courante est atteignable en **un tap** — critère `02 § 11.1`.

### D2 · Checklist, photos, anomalies

- `MissionChecklistItem` — tâches standard du logement plus tâches ajoutées par
  le client pour ce passage, distinguées visuellement. **Non bloquante** au
  check-out : une confirmation suffit. Ce n'est pas un instrument de contrôle.
- `MissionPhoto` — avant et après, par pièce, `PhotoUploader` avec compression
  côté client et file d'envoi résistante à la coupure. Consigne affichée :
  cadrer les pièces, jamais les personnes ni les documents.
- `MissionAnomaly` — dégât préexistant, équipement en panne, produit épuisé,
  accès impossible, logement inhabituellement sale, présence non prévue. Une
  anomalie de salissure propose un ajustement de durée **soumis à validation**,
  jamais facturé unilatéralement.

### D3 · Passage en `COMPLETED`

- Le check-out écrit `COMPLETED` et la durée réelle, dans une transaction avec
  la clôture de l'affectation.
- **La durée réelle ne refacture pas d'elle-même.** Le montant reste celui qui
  a été annoncé ; l'écart n'est qu'un signal, et son arbitrage passe par une
  anomalie validée. Facturer autre chose que ce qui a été affiché serait un
  changement de contrat.
- `report_incomplete` quand le check-out se fait sans photo : relance, jamais
  blocage de paiement.

### D4 · Notation et ticket qualité

Cinq étoiles et tags en deux taps. Une note inférieure ou égale à 3 ouvre un
champ de cause et crée un élément de travail prioritaire — qui atterrira dans
la file du jalon I, et en attendant dans les quatre listes existantes.
`<Avis />` cesse d'être muet le jour où `FACTS.hasReviews` devient vrai, sans
autre modification.

### D5 · Écran « Aujourd'hui »

L'écran le plus utilisé du produit, et il n'existe pas.

Bandeau d'action unique et prioritaire · carte « Maintenant » avec CTA collant
et itinéraire en lien profond · suite de la tournée avec les trajets
inter-missions et les trous de plus de 45 minutes matérialisés · bilan du jour
en monospace · ordre suggéré et bouton de réorganisation.

### D6 · Notifications multicanal et suivi du jour J

- Couche de routage `src/lib/notifications/routage.ts` : par événement et par
  canal, préférences respectées sauf pour le strictement contractuel, fenêtre
  7 h – 21 h hors urgence du jour, regroupement, journal de délivrabilité.
- Web Push (VAPID) et SMS s'ajoutent à Resend. Les huit composeurs purs
  existants ne bougent pas ; ils gagnent des frères.
- Six moments neufs : rappel J-24 h, contre-proposition d'horaire à trancher,
  en route, arrivée, terminé avec aperçu du rapport, invitation à noter.

### D7 · Mode hors ligne

Un intervenant sans réseau dans un hall d'immeuble doit pouvoir travailler.

Tournée et fiches de J-1 à J+1 préchargées en IndexedDB, secrets d'accès
chiffrés au repos · check-in et check-out horodatés localement et synchronisés
à la reconnexion, marqués comme tels · file de photos persistante et reprise
automatique · checklist locale d'abord, fusion au dernier écrit · bandeau
global non bloquant.

_Sortie_ : un cycle complet check-in → checklist → 4 photos → check-out se
déroule **entièrement hors ligne** et se synchronise sans perte — critère
`02 § 11.3`.

**Charge estimée : 4 à 6 semaines-personne.**

---

## Jalon E — L'argent

Modèle du dépôt : préautorisation à H-24, prélèvement à H+24.

### E1 · Socle Stripe

SDK, client Stripe, webhooks avec vérification de signature et idempotence par
`event.id` — la table `WebhookEvent` attend depuis la phase 1. **SetupIntent à
la réservation** : la carte est enregistrée, rien n'est débité, et c'est ce qui
rend la préautorisation possible vingt jours plus tard. Une autorisation prise
à la réservation, elle, expirerait au bout de sept jours.

### E2 · Préautorisation et prélèvement

- Travail `preautoriser` à H-24 : `PaymentIntent` en capture manuelle,
  hors session, sur le moyen enregistré. Un échec crée un élément de travail et
  prévient le client ; il n'annule **jamais** la mission tout seul.
- Travail `prelever` à H+24 : capture. **Conditionnée à `COMPLETED`**, jamais à
  l'horloge seule — sans quoi une mission non faite serait encaissée.
- Annulation : `decideCancellation` décide déjà du montant, et c'est la même
  fonction pour l'écran et pour le prélèvement.

### E3 · Connect Express et reversements

_Separate charges and transfers_, imposé par le modèle à deux factures : la
charge est portée par la plateforme, le transfert de `professionalAmountCents`
part vers le compte connecté. Lot hebdomadaire, huit jours de décalage, avec
contrôle avant exécution et statuts visibles côté intervenant — le délai de
paiement est le premier motif de départ d'un intervenant, il s'affiche et il se
tient.

### E4 · Factures

Deux émetteurs, numérotation séquentielle et continue par organisation,
mentions obligatoires, part éligible au crédit d'impôt calculée facture par
facture. Le **mandat de facturation** — l'intervenant autorise Léo Clean à
émettre ses factures en son nom — est signé au jalon F et révocable ; sans lui,
c'est vingt factures manuelles par mois et par intervenant.

### E5 · Attestation fiscale annuelle

Générée le 5 janvier, PDF nominatif, montants réglés sur l'année, numéros de
déclaration SAP des deux émetteurs. **Ce lot ne se publie que si
`NEXT_PUBLIC_SAP_DECLARED` est vrai** — comme tout le reste du fiscal, et pour
la même raison.

### E6 · Échecs de paiement

Relance J+1 par notification, J+3 par SMS, J+7 par appel — donc élément de
travail. Au troisième échec, suspension de la mission suivante **avec préavis
explicite**. Jamais d'annulation silencieuse.

### E7 · Revenus de l'intervenant

Relevé détaillé, filtrable, export CSV — indispensable à la déclaration URSSAF
trimestrielle. Jauge de plafond micro-entreprise avec alerte à 80 %. Rappel de
l'échéance déclarative à J-7. Rappel de dates et de cumuls, jamais de conseil
fiscal.

**Charge estimée : 4 à 5 semaines-personne.**

> ### Ligne de mise en production
>
> À la fin de E, le service prend des réservations, les fait exécuter, les
> clôture et les encaisse. Ce qui suit augmente la capacité, pas la validité.

---

## Jalon F — Le recrutement

Le plus gros chantier neuf, et l'avantage concurrentiel que le corpus
identifie : le candidat sans SIRET n'est pas disqualifié, c'est un candidat à
quatre semaines.

**F1 · Modèle de candidature** — `ProApplication` avec ses quinze statuts, son
journal d'événements, la sauvegarde incrémentale et la reprise depuis un autre
appareil.

**F2 · Branche « SIRET existant »** — vérification par l'API Sirene, contrôle de
Luhn déjà écrit dans `cleaner/identifiants.ts`, pré-remplissage sans aucune
re-saisie, avis de situation engendré depuis l'API plutôt que téléversé.

**F3 · Documents et vérifications** — `DocumentType` passe de quatre à dix
types, `DocumentSlot` avec caméra native et retour immédiat, douze motifs de
refus rédigés en langage courant, suivi d'expiration et relances
J-45 / 15 / 3 / 0, mise en pause de compte à échéance avec son chemin de
régularisation en un écran.

**F4 · Entretien, signature, activation** — prise de créneau, grille
d'évaluation à sept critères, signature électronique horodatée des trois
documents (CGU, charte, mandat de facturation), archivage cinq ans, puis
activation qui affiche immédiatement des propositions réelles.

**F5 · Branche « création d'auto-entreprise »** — cinq sous-étapes, guide
annoté vers le Guichet unique, attente accompagnée pendant laquelle le funnel
continue sur tout ce qui ne dépend pas du SIRET. Le bouton **« je suis
bloqué »** figure sur chaque écran de la branche : c'est le point de sauvetage
le plus rentable du parcours. On accompagne, on ne mandate pas, et on ne
collecte aucun identifiant du Guichet unique.

**F6 · Branche « déclaration SAP »** — quatre sous-étapes vers NOVA, avec le
recoupement SIREN ↔ numéro SAP que `cleaner/identifiants.ts` sait déjà faire.
`ALLOW_ACTIVATION_WITHOUT_SAP` reste à faux par défaut : un client qui découvre
après coup qu'il n'a pas droit au crédit d'impôt est un litige garanti.

**F7 · Anti-fraude** — doublons par téléphone, IBAN, SIRET, nom et empreinte
d'appareil ; contrôle nom du titulaire de l'IBAN ↔ nom déclaré ↔ nom de la
pièce d'identité, qui est le principal vecteur de fraude sur ce type de
plateforme.

**F8 · Léo Academy et simulateur de revenus** — modules courts cadrés
**sécurité et qualité**, jamais méthode d'exécution : une formation détaillée
sur la manière de travailler est un indice de subordination. Simulateur en
entrée de funnel, alimenté par la demande réelle de la zone, avec un repli
prudent quand la zone est vide.

**Ce jalon amène Inngest.** Un cron horaire suffit à des échéances qui se
comptent en heures ; il ne suffit pas à un pipeline de relances sur vingt-huit
jours avec reprises et durabilité.

**Charge estimée : 6 à 8 semaines-personne.**

---

## Jalon G — La récurrence

Ce qui transforme des réservations en revenu prévisible.

**G1** — `createBooking` écrit enfin un `Subscription` quand le rythme n'est pas
ponctuel. C'est une inversion : l'abonnement devient la source de vérité du
planning, la réservation son occurrence.

**G2** — Générateur de récurrence quotidien, horizon J+21, idempotent.

**G3** — Pause de 1 à 8 semaines sans justification, plus visible que la
résiliation parce que c'est le principal outil anti-résiliation, avec
l'information honnête que l'intervenant peut être réaffecté pendant ce temps.
Modification de fréquence avec recalcul affiché avant validation. Résiliation
en trois écrans, motif recueilli, aucun frein artificiel.

**G4** — Réservation prioritaire au titulaire : douze heures avant toute
diffusion. Le score donne déjà 0,25 à la continuité ; une fenêtre réservée est
plus forte, et elle tient la promesse centrale du service.

**Charge estimée : 2 à 3 semaines-personne.**

---

## Jalon H — Les espaces complets

**H1 · Espace client** — accueil « prochaine intervention » avec bandeau
d'action unique et suivi du jour J · fiche logement · abonnement · factures et
moyens de paiement · parrainage (partage, suivi, crédits — le moteur existe et
ne bouge pas) · préférences de notification par canal et par type, le
marketing coupable sans jamais couper l'opérationnel.

**H2 · Espace intervenant** — messages · profil public avec prévisualisation
« vu par le client » · zones et compétences · objectif hebdomadaire déclaré.

**H3 · Chat complet** — temps réel, pièces jointes, réponses rapides,
`Prévenir d'un retard` en un tap, fermeture du fil 72 h après la dernière
mission, détection de contournement en **signal ops uniquement**, sans blocage
ni message moralisateur.

**H4 · Proxy téléphonique** — aujourd'hui, appeler signifie divulguer un numéro
personnel.

**Charge estimée : 3 à 4 semaines-personne.**

---

## Jalon I — Le pilotage

À faire quand il y a assez de volume pour que ces écrans disent quelque chose.

**I1 · File d'actions** — une seule liste, tout ce qui exige une décision
humaine, SLA en compte à rebours, groupement, raccourcis clavier, et surtout un
**état terminal explicite** pour chaque élément : rien ne disparaît sans trace.
Les vingt règles de génération du corpus (`04 § 3`).

**I2 · Scores** — risque de mission, churn client, fiabilité intervenant, score
de dossier. Bornés 0-100, **décomposition affichée**, action associée. Le
dépôt a déjà le bon modèle avec `Assignment.scoreBreakdown`. La fiabilité reste
strictement interne au matching : jamais présentée comme une note de
performance, jamais invoquée à l'appui d'une mesure.

**I3 · Radar** — signaux critiques, barre de vitalité du jour, timeline
horizontale par intervenant, risques à sept jours, frictions.

**I4 · Actions d'exploitation** — réaffecter avec l'impact sur la tournée,
geste commercial plafonné par rôle, mise en pause, validation de dossier,
relance de diffusion. **Chacune écrit dans `AuditLog`** avec auteur, motif et
valeurs avant et après.

**I5 · CRM 360** — timeline unifiée client et intervenant, segments,
playbooks validés par un humain avant envoi, campagnes plafonnées à deux
sollicitations commerciales par mois.

**I6 · Inbox multicanal** — files, macros à variables, SLA en heures ouvrées,
panneau de contexte, consolidation des SMS entrants et des e-mails. Sans cette
consolidation, l'outil est contourné dès la première semaine.

**I7 · Zones et capacité** — heatmaps de demande et d'offre alimentées par B4,
ouverture et fermeture de commune, plancher tarifaire local, détection des trous
de couverture, simulation.

**I8 · Frictions** — huit détecteurs par règles et non par apprentissage,
chacun produisant un fait daté avec son ampleur, son hypothèse de cause **et
une action**. Une friction traitée est archivée avec son résultat mesuré : c'est
ce qui en fait une boucle plutôt qu'un mur de graphiques.

**Charge estimée : 5 à 7 semaines-personne.**

---

## Jalon J — Litiges et conformité

**J1 · Réclamations** — catégories, photo obligatoire pour casse et propreté,
SLA de 24 h ouvrées affiché au client, version des deux parties sollicitée,
décision tracée avec motif. Le vol allégué ne passe pas par le flux standard :
escalade immédiate, aucune automatisation.

**J2 · Rétention automatique** — purge des photos et des positions à 13 mois,
des comptes à 3 ans après la dernière mission, registre des traitements,
journal d'accès aux documents. Travail nocturne.

**J3 · Rôles étendus** — `recruteur`, `support` et `lecture` s'ajoutent aux
cinq existants, avec plafonds de geste commercial par rôle. TOTP obligatoire
pour l'administration, sessions de 12 h. L'accès aux pièces d'identité reste
limité à deux rôles et journalisé.

**J4 · Sinistres** — dossier, montant, franchise, statut, en face du contrat
Hiscox déjà négocié.

**Charge estimée : 2 à 3 semaines-personne.**

---

## 2. Récapitulatif de charge

| Jalon | Contenu                         | Charge                        |
| ----- | ------------------------------- | ----------------------------- |
| A     | Fondations                      | 2 – 3                         |
| B     | Le prix et la demande           | 1                             |
| C     | Le logement                     | 2                             |
| D     | La mission se termine           | 4 – 6                         |
| E     | L'argent                        | 4 – 5                         |
|       | **Ligne de mise en production** | **13 – 17**                   |
| F     | Le recrutement                  | 6 – 8                         |
| G     | La récurrence                   | 2 – 3                         |
| H     | Les espaces complets            | 3 – 4                         |
| I     | Le pilotage                     | 5 – 7                         |
| J     | Litiges et conformité           | 2 – 3                         |
|       | **Total**                       | **31 – 42 semaines-personne** |

Les fourchettes supposent la stack en place et une personne qui connaît le
dépôt. Elles n'incluent ni la recette, ni les allers-retours de design, ni les
délais externes — vérification de domaine Resend, validation du compte Stripe
Connect, obtention de la déclaration SAP.

**Le corpus annonce son MVP en six semaines et sa V1 en quatorze.** L'écart avec
ce plan n'est pas une divergence d'estimation : le corpus n'y met pas la même
chose. Ce qu'il appelle MVP correspond à peu près aux jalons A à D **sans** le
mode hors ligne, le logement chiffré ni les notifications multicanal.

---

## 3. Règles à tenir sur toute la durée

Elles ne sont pas des lots, ce sont des conditions d'acceptation de chaque lot.

1. **Aucun écran neuf n'affiche de crédit d'impôt** tant que
   `NEXT_PUBLIC_SAP_DECLARED` est faux. `fiscal.ts` reste le seul juge, et un
   test le vérifie à chaque jalon.
2. **Aucune couleur en dur.** Les trois exceptions documentées — e-mail, gabarit
   de notification, carte de partage — restent les seules.
3. **Zod à chaque frontière**, et Prisma jamais interrogé sans passer par
   `forOrganization`.
4. **Le vocabulaire d'affectation reste interdit** sur toutes les surfaces
   intervenant. L'audit lexical, aujourd'hui limité à
   `/travailler-avec-nous`, s'étend à chaque écran neuf du jalon D et du
   jalon F.
5. **Les moteurs restent purs.** Resserrement, majorations, scores, fériés,
   diffusion : aucune lecture de base, aucune horloge implicite. C'est ce qui
   permet de tester une nuit de changement d'heure en quelques millisecondes,
   et c'est aussi ce qui garde la vitrine statique fonctionnelle.
6. **Une route ajoutée est une exclusion à envisager** dans
   `scripts/build-demo-statique.mjs`. La liste n'est pas déductible du code, et
   `/pro/[slug]` a déjà cassé la vitrine une journée pour cette raison.
7. **`CLAUDE.md` se met à jour à la fin de chaque jalon**, pas au début : il
   décrit ce que le code fait, jamais ce qu'on prévoit qu'il fasse. Les
   arbitrages du § 0 y entreront lot par lot, quand ils seront vrais.

---

## 4. Ce qu'il faut décider ensuite

Rien ne bloque le démarrage du jalon A. Deux questions se poseront avant B et D.

- **La pré-acceptation gèle-t-elle vraiment le planning de l'intervenant ?** Le
  plan propose un filtre doux — on cesse de lui proposer ce qui contredirait son
  engagement, sans rien verrouiller en base. Un vrai verrou serait plus sûr pour
  le client et plus contraignant pour l'intervenant, et il contredirait la règle
  « une proposition ne réserve rien ». À confirmer au moment d'écrire B1.
- **Le fournisseur de SMS.** Il conditionne D6 (suivi du jour J), E6 (relance
  d'impayé) et F1 (OTP de reprise de candidature). Trois usages, un seul
  contrat — à choisir avant D.

---

## 5. Ce qui attend une action hors du code

Ces points ne s'écrivent pas en SQL versionné ni en TypeScript : ils se règlent
dans une console. Ils sont listés ici parce qu'un chantier bloqué par un
formulaire d'administration se perd plus sûrement qu'un chantier bloqué par du
code.

### Scaleway — le bucket

- [ ] Créer le bucket, **privé**, région `fr-par`. Ni visibilité publique, ni
      site web statique.
- [ ] Clé d'API restreinte à ce seul bucket, lecture-écriture, et à aucun autre
      service du projet.
- [ ] Renseigner `STOCKAGE_PROVIDER=scaleway` et les quatre variables
      `SCALEWAY_*` chez l'hébergeur. Tant qu'elles manquent, le dépôt est refusé
      et les écrans proposent le téléphone.
- [ ] Cycle de vie sur `missions/` aligné sur la rétention de treize mois de
      `src/lib/rgpd/retention.ts` : une purge en base qui laisserait les fichiers
      ferait mentir la promesse d'effacement.
- [ ] Versionnement **désactivé** sur `kyc/` : une version antérieure d'une pièce
      d'identité survivrait à sa suppression, ce que le droit à l'effacement
      interdit.

### Supabase — la seconde porte

La migration `20260820040000_verrouiller_lacces_api` a posé les verrous SQL, et
`src/lib/acces-api.integration.test.ts` refuse désormais toute table sans RLS.
Reste ce qui se règle dans la console :

- [ ] **Retirer `public` des schémas exposés** (Settings → API → Exposed
      schemas). Le produit n'emploie aucun client Supabase : la Data API ne lui
      sert à rien, et la désactiver supprime la porte plutôt que de la garder.
- [ ] Vérifier qu'**aucune clé `service_role` n'est déployée** : elle contourne
      la RLS par conception, et le dépôt n'en a aucun usage.
- [ ] Faire tourner le **mot de passe de la base** si l'URL de connexion a pu
      circuler — elle porte l'identité qui, elle, contourne la RLS.
- [ ] Restreindre les IP autorisées si l'offre le permet.

Détail et raisons : [SECURITE-ACCES.md](SECURITE-ACCES.md).
