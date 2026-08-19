# 01 — Espace client

Thème `consumer`. Cible : réservation en moins de 3 minutes, gestion d'abonnement sans appel, zéro surprise le jour J.

## 1. Arborescence

```
/                        vitrine + simulateur de prix (entrée principale du funnel)
/reserver                funnel de réservation (6 écrans, sans compte jusqu'à l'écran 5)
/mon-espace              Accueil — prochaine intervention
/mon-espace/missions     Interventions (à venir / passées)
/mon-espace/missions/:id Détail mission
/mon-espace/logement     Mon logement (surface, pièces, accès, consignes, animaux, produits)
/mon-espace/abonnement   Fréquence, créneau, pause, résiliation
/mon-espace/messages     Conversations (intervenant · Léo Clean)
/mon-espace/factures     Factures, moyens de paiement, attestation fiscale
/mon-espace/parrainage   Parrainage
/mon-espace/compte       Coordonnées, notifications, confidentialité, aide
```

Barre d'onglets basse : **Accueil · Interventions · Messages · Compte**. Le badge de non-lu apparaît sur Messages, et sur Accueil si une action est requise (paiement échoué, avis à laisser, créneau à confirmer).

## 2. Funnel de réservation `/reserver`

Principe : **le prix apparaît avant toute création de compte**. Le compte se crée à l'écran 5, sur un OTP SMS, en une seule étape.

### Écran 1 — Où ?

- `AddressAutocomplete` (Mapbox, biais géographique sur la Gironde sud).
- Vérification isochrone immédiate. Trois issues :
  - **Couvert** → passage écran 2, affichage discret « Zone couverte — Léognan et alentours ».
  - **Hors zone mais proche** → « On n'est pas encore chez vous. Laissez votre e-mail, on vous prévient à l'ouverture. » Capture en liste d'attente + enregistrement du point dans la heatmap de demande (module admin Zones).
  - **Hors zone lointaine** → même traitement, sans promesse de délai.
- Champ complément d'adresse repoussé plus loin (écran 4) : il ne conditionne pas le prix.

### Écran 2 — Quel logement ?

- Type : appartement / maison. Surface habitable en m² (slider + saisie, valeur par défaut 80). Nombre de chambres, salles de bain, WC.
- Micro-copie sous le slider : `≈ 2 h 30 estimées` mise à jour en direct, en JetBrains Mono. C'est le premier signal de transparence.

### Écran 3 — À quelle fréquence ?

- 4 cartes : **Chaque semaine** (badge « le plus choisi »), **Toutes les 2 semaines**, **Une fois par mois**, **Une seule fois**.
- Chaque carte affiche le prix par passage TTC et, en dessous en plus petit, `soit X €/passage après crédit d'impôt`.
- Le ponctuel n'est jamais caché ni pénalisé visuellement — c'est la porte d'entrée de la moitié des abonnements.

### Écran 4 — Quand ?

- `DateSlotPicker` : 3 semaines glissantes, créneaux réels issus des disponibilités déclarées des intervenants couvrant l'adresse. Les créneaux sans capacité ne sont pas affichés (jamais un créneau qui échoue au paiement).
- Créneaux de 3 h : `08:00-11:00`, `11:00-14:00`, `14:00-17:00`, `17:00-20:00`. Le client choisit une plage, pas une heure précise ; l'heure exacte est confirmée à J-24h. Cette imprécision assumée est ce qui permet la tournée compacte.
- Options en pills multi-sélection : vitres, four, réfrigérateur, repassage, « avec mes produits / avec les produits de l'intervenant ».
- Complément d'adresse, étage, code d'accès (masqué, chiffré), présence d'animaux (chat/chien/autre), enfants en bas âge.

### Écran 5 — Qui ? + compte

- Affichage de 1 à 3 intervenants candidats : prénom, initiale de nom, photo, ancienneté, note (si ≥ 5 avis), 3 tags issus des avis (« ponctuelle », « très soigneuse », « adorable avec le chat »), temps de trajet `12 min`.
- Option « Peu importe, choisissez pour moi » présentée à égalité — elle améliore le matching et il faut qu'elle soit choisie souvent.
- Création de compte : prénom, nom, téléphone → OTP 6 chiffres. E-mail demandé après, pas avant.

### Écran 6 — Récapitulatif et paiement

- Bloc prix détaillé, dépliable : durée, taux, options, majorations, remise première mission, total TTC, `crédit d'impôt estimé −X €`, `reste à charge estimé`.
- Empreinte bancaire via Stripe SetupIntent — **débit à J+1 après la mission réalisée**, pas à la réservation. Argument de réassurance à afficher : « Vous ne payez qu'après le passage. »
- Cases : CGV (obligatoire, non pré-cochée), conditions d'annulation résumées en 2 lignes au-dessus du bouton, opt-in marketing séparé et non pré-coché.
- CTA : `Confirmer ma réservation`.

### Écran de confirmation

- Récapitulatif visuel, ajout au calendrier (`.ics`), bouton « Compléter les consignes d'accès » (deuxième canal de complétion du profil logement), invitation au parrainage placée ici et pas ailleurs (le pic de satisfaction est à la réservation, pas après le ménage).

### Instrumentation du funnel

Événements `booking_funnel_step_viewed / completed / abandoned` avec `step`, `duration_ms`, `field_errors[]`. Ce sont ces données qui alimentent l'indice de friction admin (`04 § 7`).

## 3. Accueil `/mon-espace`

Un écran, une hiérarchie stricte :

1. **Bandeau d'action** (n'apparaît que si nécessaire, un seul à la fois, par priorité) : paiement échoué → _Mettre à jour ma carte_ · avis à laisser → _Noter le passage de Sonia_ · créneau à confirmer → _Confirmer l'heure de mardi_ · document manquant néant côté client.
2. **Carte « Prochaine intervention »** : date en gros, plage horaire, `Sonia M.` avec photo, statut (`Confirmée` / `Recherche d'intervenant en cours`), actions secondaires : _Modifier_, _Ajouter une consigne_, _Message_. À J-0, cette carte devient le suivi temps réel (§ 5).
3. **Récurrence** : « Toutes les 2 semaines, le mardi matin » + lien _Gérer mon abonnement_.
4. **Crédit d'impôt de l'année** : jauge Signal Green, `342 € cumulés en 2026`, lien vers l'explication et vers l'attestation.
5. **Parrainage** : une ligne, jamais un bloc criard.

État vide (client sans mission à venir avec historique) : « Pas de passage prévu. Reprendre le mardi 26 août ? » avec un CTA de re-réservation en un tap sur le dernier paramétrage — c'est le levier de réactivation le plus efficace du produit.

## 4. Détail mission `/mon-espace/missions/:id`

- En-tête : statut `StatusPill`, date, plage, adresse.
- Intervenant : carte personne, bouton message, bouton appel masqué (proxy Twilio, pas le numéro personnel).
- **Checklist prévue** par pièce, dépliable, éditable jusqu'à J-24h : le client cocher/décocher des tâches (ex. « ne pas toucher au bureau »), ajouter une consigne ponctuelle (« les draps sont sur le lit »).
- Prix et statut de paiement.
- Actions : _Reporter_ (choix de créneau, gratuit > 24 h), _Annuler_ (conditions rappelées avant confirmation avec le montant exact retenu, jamais après), _Signaler un problème_ (< 48 h après la mission).
- Après réalisation : **rapport de mission** — photos avant/après par pièce, durée réelle, anomalies signalées par l'intervenant (« joint de douche moisi », « produit vitres épuisé »), checklist accomplie. C'est l'écran qui justifie le prix ; il doit être beau et lisible.

## 5. Jour J — suivi

- **J-24h** : push + SMS « Sonia passe demain entre 8 h et 11 h. Besoin de changer ? »
- **Le matin** : plage resserrée dès que la tournée est figée → « Sonia arrive vers 9 h 15 ».
- **En route** : notification `Sonia est en route` (déclenchée au check-out de la mission précédente ou au bouton « Je partie » côté intervenant). Pas de carte de suivi temps réel du véhicule — surveillance disproportionnée d'un travailleur indépendant, et attente client mal calibrée. Un ETA suffit.
- **Arrivée** : `Sonia est arrivée à 9h12`.
- **Fin** : `Intervention terminée · voir le rapport` avec les 4 premières photos en aperçu et l'invitation à noter.

## 6. Notation et réclamation

- Notation en 2 taps : 5 étoiles + tags proposés (ponctualité, soin, discrétion, initiative). Commentaire libre optionnel. Une note ≤ 3 ouvre un champ « qu'est-ce qui n'a pas fonctionné ? » avec catégories → crée automatiquement un ticket qualité en admin (priorité haute).
- **Réclamation** : formulaire dédié, catégories (propreté insuffisante, casse/dommage, retard, comportement, vol allégué), upload photo obligatoire pour casse et propreté, description. SLA affiché au client : réponse sous 24 h ouvrées. Le cas « vol allégué » ne passe pas par le flow standard : escalade immédiate, aucune automatisation, notification admin critique.
- Gestes commerciaux possibles depuis l'admin : re-passage offert, remise sur le prochain passage, remboursement partiel/total. Toujours tracés avec motif.

## 7. Mon logement `/mon-espace/logement`

Fiche persistante réutilisée par tous les intervenants — elle réduit le temps d'onboarding de chaque nouveau passage et c'est un actif de rétention (changer de prestataire = tout re-expliquer).

Sections : surface et pièces · plan d'accès (interphone, code, boîte à clés, gardien, voisin) · **gestion des clés** (statut : détenue par l'intervenant / boîte à clés / présence du client, avec journal de remise signé des deux côtés) · consignes par pièce · zones interdites · animaux (nom, tempérament, consigne) · produits et matériel disponibles (aspirateur, serpillère, produits fournis) · allergies et produits à éviter · stationnement.

Les champs sensibles (codes) sont écrits une fois, jamais réaffichés en clair au client (« code enregistré · modifier »), et exposés à l'intervenant seulement dans la fenêtre J-24h → J+2h.

## 8. Abonnement `/mon-espace/abonnement`

- Fréquence, jour, plage, intervenant titulaire.
- **Mettre en pause** : sélecteur de dates (vacances), 1 à 8 semaines, sans justification, avec information honnête « Sonia pourra être réaffectée pendant votre pause ; on fait au mieux pour la retrouver ». La pause est le principal outil anti-résiliation : elle doit être plus visible que la résiliation.
- **Modifier la fréquence** : recalcul de prix affiché avant validation.
- **Résilier** : parcours en 3 écrans — motif (prix / qualité / déménagement / plus besoin / autre), proposition ciblée selon le motif (remise 2 passages / changement d'intervenant / pause / rien), confirmation. Aucun frein artificiel : pas d'appel obligatoire, pas de délai caché. Le motif alimente l'analyse de churn.
- Historique des modifications, visible et daté.

## 9. Factures et fiscalité `/mon-espace/factures`

- Liste des factures PDF, téléchargeables, mentions conformes (émetteur selon le modèle juridique retenu, n° de déclaration SAP, TVA ou mention de franchise).
- Moyens de paiement : cartes enregistrées, prélèvement SEPA optionnel (préférable pour les abonnements : moins d'échecs, moins d'expirations).
- **Échec de paiement** : relance J+1 (push + e-mail), J+3 (SMS), J+7 (appel admin), 3ᵉ échec → suspension de la prochaine mission avec préavis explicite. Jamais d'annulation silencieuse.
- **Crédit d'impôt** : page pédagogique courte (« 50 % de ce que vous payez vous est rendu »), cumul de l'année, **attestation fiscale annuelle** générée automatiquement en janvier et notifiée. En V2, adhésion à l'avance immédiate avec parcours de consentement URSSAF.

## 10. Messages `/mon-espace/messages`

- Deux fils maximum : **l'intervenant de la mission en cours/à venir** et **Léo Clean**. Pas d'inbox à N conversations : c'est une source de confusion.
- Realtime Supabase, accusés de lecture, pièces jointes photo.
- Le fil intervenant se ferme automatiquement 72 h après la dernière mission avec cet intervenant (le fil reste consultable en lecture) — protège la vie privée des deux côtés et évite le contournement de la plateforme sur les fils dormants.
- Réponses rapides suggérées côté client : « Je serai absent, utilisez le code », « Pouvez-vous insister sur la salle de bain ? », « Décalage possible d'une heure ? »
- Détection de contournement : les messages contenant IBAN, « en direct », « sans passer par », un numéro de téléphone ou un montant sont marqués pour revue admin — **sans blocage automatique** ni message moralisateur, uniquement un signal ops (voir `04 § 5`).
- Horaires : indication « Sonia répond en général avant 20 h ». Léo Clean : horaires d'ouverture affichés + délai de réponse moyen réel.

## 11. Parrainage `/mon-espace/parrainage`

- Code personnel + lien de partage (Web Share API), 20 € pour le filleul, 20 € en crédit pour le parrain, créditables après la 1ʳᵉ mission réalisée du filleul.
- Suivi : invitations envoyées, en attente, converties, crédits acquis et consommés.
- Garde-fous : plafond de 200 €/an par parrain, blocage même adresse/même moyen de paiement, revue admin au-delà de 5 filleuls, crédit non convertible en espèces. À cadrer : un programme de parrainage rémunéré peut relever du régime des cadeaux/réductions — préférer le **crédit sur prestation** plutôt que le virement.

## 12. Compte `/mon-espace/compte`

Coordonnées · préférences de notification par canal et par type d'événement (le client peut couper le marketing sans couper les alertes opérationnelles — jamais l'inverse) · confidentialité (export de mes données, suppression de mon compte) · aide (FAQ, téléphone, horaires) · CGV/mentions.

## 13. États et cas limites

| Situation                                   | Comportement attendu                                                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Aucun intervenant trouvé à J-2              | Notification honnête + 3 créneaux alternatifs proposés en un tap + geste commercial de 10 % préparé côté admin                                |
| Intervenant annule la veille                | Notification immédiate, recherche automatique, « on vous confirme sous 2 h » puis résolution ou report avec excuse et remise                  |
| Client absent, accès impossible             | L'intervenant déclenche `NO_SHOW_CLIENT` avec photo de la porte, appel proxy tenté, attente 20 min facturée à 50 % après 1ʳᵉ tolérance        |
| Hors-ligne                                  | Consultation du prochain rendez-vous et des consignes en cache ; les actions sont mises en file et signalées « sera envoyé dès que possible » |
| Client mineur / non-titulaire du compte     | Contrôle d'âge à l'inscription (déclaratif), CGV réservées aux majeurs                                                                        |
| Suppression de compte avec abonnement actif | Résiliation d'abord, avec dernière facture réglée, puis anonymisation à J+30                                                                  |

## 14. Critères d'acceptation (extraits testables)

1. Un utilisateur non authentifié obtient un prix TTC et un reste à charge estimé en ≤ 4 interactions depuis la page d'accueil.
2. Aucun créneau proposé au client ne peut aboutir à un statut `UNCOVERED` supérieur à 5 % sur un mois glissant.
3. Le code d'accès n'apparaît en clair nulle part hors de la fiche mission de l'intervenant affecté, dans la fenêtre J-24h/J+2h — vérifié par test automatisé sur les réponses API et les logs.
4. L'annulation affiche le montant exact retenu **avant** la confirmation, et ce montant correspond au débit effectif.
5. Toute mission `COMPLETED` dispose d'un rapport consultable par le client en moins de 2 taps depuis l'accueil.
6. Le parcours de résiliation est atteignable en 3 taps maximum depuis l'accueil et ne comporte aucune étape non-numérique.
