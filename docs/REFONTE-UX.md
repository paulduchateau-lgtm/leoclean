# Refonte UX — journal des phases

Suite de [AUDIT-PARCOURS.md](AUDIT-PARCOURS.md), sous le contrat de
[FEATURES-FREEZE.md](FEATURES-FREEZE.md). Convention de comptage des taps :
celle de l'audit, inchangée.

## État des phases

| Phase | Objet                                                | État                                                                       |
| ----- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| 0     | Audit                                                | ✅                                                                         |
| 1     | Restructuration du tunnel (L1–L7)                    | ✅                                                                         |
| 2     | Microcopy et défauts intelligents (L4, L5, L15, L16) | ✅ **partiel** — L16 bloquée                                               |
| 3     | Latence perçue et états (L8–L10, L21, L22)           | ✅                                                                         |
| 4     | Navigation et reprise (L11–L14)                      | ✅                                                                         |
| 5     | Espace client                                        | ⛔ **bloquée** — les fonctionnalités n'existent pas                        |
| 6     | Vitrine                                              | ✅                                                                         |
| 7     | Passe UI                                             | ⏸ **reportée** — décision du 15 août : on reste sur la DA du design system |

---

## Ce qui bloque, et pourquoi

### ⛔ Phase 5 — Espace client

`/mon-compte` affiche une adresse email, des appartenances et une déconnexion.
Il n'existe **aucune** liste de réservations, modification, annulation,
notation, adresse enregistrée, moyen de paiement ni parrainage — ni écran, ni
server action pour la plupart. Les refondre supposerait de les écrire, ce que
le gel interdit.

Décision retenue : on garde le besoin en mémoire et on l'applique une fois le
produit terminé. La phase 5 reprendra après les phases 7 à 12 du plan produit.

Conséquence mesurable : le parcours « modifier ou annuler une réservation »
reste inatteignable, et sa cible de 4 taps sans objet.

### ⛔ Cible de 8 taps du parcours « utilisateur connu » (L16)

Le tunnel ne lit pas la session. Le préremplissage — profil, dernière adresse —
exige une lecture serveur authentifiée qui n'existe pas. Décision retenue :
l'intégrer au plan de développement produit plutôt qu'à la refonte. Inscrit
comme **phase 8 bis** ci-dessous.

Tout le reste de la phase 2 est fait : défauts intelligents ne nécessitant
aucune session (types de logement, rythme le plus demandé présélectionné,
commune transmise de la page locale au tunnel), et libellés d'action sur tout
le site.

### ⏸ Phase 7 — Passe UI

Reportée à votre demande : la DA reste celle du design system Léo Clean, et
son évolution impliquera une refonte du système lui-même, pas un placage de
palette sur les écrans.

Les seules règles d'intensité visuelle appliquées sont celles qui servent
l'évidence, avec les tokens existants : **la sélection est remplie**, pas
bordée ; chaque écran du tunnel porte un bloc en couleur saturée ; aucune
couleur n'est écrite en dur.

---

## Compteurs de taps

| Parcours                                                     | Avant      | Après       | Cible          |
| ------------------------------------------------------------ | ---------- | ----------- | -------------- |
| Ponctuel, nouvel utilisateur — accueil, adresse trouvée      | 13 taps    | **11 taps** | ≤ 14 ✅        |
| Ponctuel, nouvel utilisateur — page commune, saisie manuelle | 16 taps    | **12 taps** | ≤ 14 ✅        |
| Récurrent, utilisateur connu                                 | 16 taps    | **11 taps** | ≤ 8 ⛔ bloquée |
| Modifier ou annuler                                          | impossible | impossible  | ≤ 4 ⛔ bloquée |

### Détail — parcours 1, entrée par l'accueil

| #   | Écran         | Tap                                                                            |
| --- | ------------- | ------------------------------------------------------------------------------ |
| 1   | Accueil       | 1 · sa commune, dans le bloc « Où habitez-vous ? »                             |
| 2   | Adresse       | 2 · champ adresse · 3 · le résultat                                            |
| 3   | Logement      | 4 · « T3 ou petite maison »                                                    |
| 4   | Rythme        | 5 · « Une seule fois », prix des quatre formules affiché                       |
| 5   | Créneau       | 6 · une heure (le premier jour disponible est déjà ouvert)                     |
| 6   | Récapitulatif | 7 à 10 · prénom, nom, email, téléphone · 11 · « Réserver lundi 17 août à 9 h » |
| 7   | Confirmation  | —                                                                              |

### Le décompte d'écrans, dit franchement

**Une question par écran (L1) et « six écrans maximum » (L7) ne tiennent pas
ensemble ici.** Le tunnel pose cinq questions — où, quelle taille, quel rythme,
quand, qui êtes-vous — et il en faut cinq écrans. En comptant la confirmation,
le tunnel fait 6 écrans ; en comptant aussi l'accueil d'où l'on part, 7.

Avant la refonte, le même parcours faisait 6 écrans en tout, mais l'un d'eux
posait deux décisions et deux autres cachaient le prix. J'ai pris L1, en
considérant que la cible de six écrans visait la longueur ressentie — que onze
taps au lieu de treize et un prix permanent servent mieux qu'un écran de moins.
Dites-moi si vous voulez l'inverse : fusionner « logement » et « rythme »
ramène à 6 écrans au total, contre une décision double.

---

## Fiches d'évidence

### Accueil — bloc « Où habitez-vous ? »

1. **Question** : dans quelle commune faut-il intervenir ?
2. **Action primaire** : seize pastilles de commune ; appuyer ouvre le tunnel.
3. **Prérempli** : rien — mais les communes sont classées par population, donc
   les plus probables viennent en premier.
4. **Erreur** : impossible, la liste ne contient que des communes desservies.
5. **Réassurance** : « Prix affiché avant de réserver, et rien à payer
   aujourd'hui. »

### Étape 1 — « Où intervenons-nous ? »

1. **Question** : quelle est votre adresse ?
2. **Action primaire** : appuyer sur une adresse proposée. Repli permanent :
   « Saisir mon adresse manuellement », dont l'action est « Décrire mon
   logement ».
3. **Prérempli** : la commune d'arrivée est présélectionnée en saisie manuelle
   et donne l'exemple du champ ; un parcours interrompu est proposé à la
   reprise.
4. **Erreur** : recherche vide ou service indisponible → la saisie manuelle est
   proposée ; adresse hors zone → le bouton est inactif et la liste des
   communes desservies est offerte.
5. **Réassurance** : la barre basse annonce « À partir de 29 €/h, minimum
   2 heures » — un vrai prix, tiré de la grille publique.

### Étape 2 — « Quelle est la taille de votre logement ? »

1. **Question** : quelle taille fait votre logement ?
2. **Action primaire** : appuyer sur un des quatre types de logement.
3. **Prérempli** : les quatre repères de la page tarifs ; la surface exacte est
   repliée, préremplie à 80 m² si on la déplie.
4. **Erreur** : surface hors bornes → le bouton de la surface libre reste
   inactif tant que la valeur n'est pas entre 15 et 400 m² ; un refus serveur
   s'affiche avec un bouton « Réessayer ».
5. **Réassurance** : « Elle reste ajustable ensuite — nous comptons 25 m²
   traités par heure. »

### Étape 3 — « À quel rythme souhaitez-vous nous voir ? »

1. **Question** : à quelle fréquence voulez-vous un ménage ?
2. **Action primaire** : appuyer sur une des quatre formules, chacune portant
   son prix.
3. **Prérempli** : « Tous les quinze jours », la formule la plus demandée, est
   sélectionnée ; les quatre devis sont déjà chargés, changer d'avis est
   instantané.
4. **Erreur** : échec du devis → message et « Réessayer », avec le numéro de
   téléphone en second recours.
5. **Réassurance** : « Nous calons les passages suivants avec vous après le
   premier ménage […]. Vous ne vous engagez sur rien aujourd'hui. » — ce qui
   décrit le fonctionnement réel, la plateforme ne créant pas encore
   d'abonnement.

### Étape 4 — « Quand voulez-vous que nous venions ? »

1. **Question** : quel jour et quelle heure ?
2. **Action primaire** : appuyer sur une heure. Le premier jour disponible est
   ouvert d'emblée.
3. **Prérempli** : les créneaux sont préchargés pendant l'étape précédente, donc
   déjà là ; les journées complètes restent affichées, barrées.
4. **Erreur** : aucun créneau sur trois semaines → bouton d'appel ; échec de la
   recherche → message et « Réessayer ».
5. **Réassurance** : « Annulation gratuite jusqu'à 24 heures avant
   l'intervention », dérivée du barème des CGU.

### Étape 5 — « Voilà ce qu'on a prévu »

1. **Question** : est-ce bien cela, et comment vous joindre ?
2. **Action primaire** : « Réserver lundi 17 août à 9 h ».
3. **Prérempli** : les quatre lignes du récapitulatif, chacune modifiable d'un
   geste avec retour au récapitulatif ; les coordonnées déjà saisies survivent
   à tout aller-retour.
4. **Erreur** : champ manquant → signalé par le navigateur, à l'endroit exact ;
   refus serveur → les messages de champ sont affichés tels quels ; créneau pris
   entre-temps → retour au choix de l'heure avec explication, coordonnées
   conservées.
5. **Réassurance** : trois lignes — rien à payer aujourd'hui, annulation
   gratuite jusqu'à 24 h, intervenant vérifié (SIRET, assurance, identité).

### Confirmation

1. **Question** : aucune — c'est un résultat.
2. **Action primaire** : appeler, si une question se pose.
3. **Prérempli** : jour, heure, adresse et montant repris de ce que le serveur
   a enregistré, pas du formulaire.
4. **Erreur** : sans objet.
5. **Réassurance** : « Nous vous confirmons par email le nom de votre
   intervenant », et le numéro de téléphone.

---

## Non-régression

`npm run check` (217 tests unitaires), `npm run e2e` (66 tests, mobile et
desktop), `npm run build`, `npm run build:demo` : tous verts.

Relecture contre l'inventaire :

- [x] les 5 canaux de conversion sont atteignables, et le tunnel l'est depuis
      neuf fois plus de pages qu'avant ;
- [x] les 16 pages communes et 12 pages d'intention gardent leurs blocs ;
- [x] `LeadForm` garde ses 5 champs, son champ piège et son délai de 3 s ;
- [x] les 12 entrées utilisateur du tunnel sont toutes présentes — la surface
      libre et les deux champs de précisions sont repliés, pas supprimés ;
- [x] la bascule en saisie manuelle reste accessible à tout moment ;
- [x] un créneau pris renvoie au choix de créneau avec un message ;
- [x] `/mon-compte` affiche email, appartenances, déconnexion ;
- [x] la vitrine statique se construit et son tunnel calcule réellement.

Aucun contrat de server action, aucun schéma Prisma et aucune règle de calcul
de prix n'a été modifié. Seul ajout de code hors écrans :
`src/lib/booking/horizon.ts`, qui rassemble une constante jusque-là recopiée
à deux endroits.

---

## Critères d'acceptation

| Critère                                                             | État                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------- |
| `FEATURES-FREEZE.md` vérifié, zéro fonctionnalité perdue            | ✅                                                   |
| Aucun contrat d'API, schéma ou calcul de prix modifié               | ✅                                                   |
| Compteurs de taps sous les cibles                                   | ✅ sur les parcours ouverts, ⛔ sur les deux bloqués |
| Fiche d'évidence complète pour chaque écran                         | ✅                                                   |
| Aucun bouton « Continuer », « Suivant », « Valider »                | ✅                                                   |
| Aucun écran ne demande deux décisions                               | ✅                                                   |
| Aucun compte requis avant le récapitulatif                          | ✅ — le compte se crée à la confirmation             |
| Prix visible sur 100 % des étapes du tunnel                         | ✅                                                   |
| Rechargement en cours de tunnel → état restauré et reprise proposée | ✅                                                   |
| Aucun état vide ou d'erreur sans action de sortie                   | ✅                                                   |
| Parcours réalisable au pouce sur 390 px                             | ✅ — cibles ≥ 44 px, action primaire en bas          |
| `npm run build` et `tsc --noEmit` passent                           | ✅                                                   |

---

## Suite du plan produit

Reprise du plan initial, avec l'ajout issu de la décision du 15 août.

| Phase | Objet                                                                                               | État                                                                  |
| ----- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 7     | Paiement Stripe                                                                                     | ⛔ **bloquée** — aucune clé Stripe, cf. « En attente d'informations » |
| 8     | Espace intervenant                                                                                  | prête                                                                 |
| 8 bis | **Tunnel pour utilisateur connu** — lecture de session, profil et carnet d'adresses, préremplissage | prête, issue de la refonte                                            |
| 9     | Synchronisation d'agenda externe                                                                    |                                                                       |
| 10    | Optimisation des temps de trajet                                                                    |                                                                       |
| 11    | Page `/pro/[slug]`                                                                                  |                                                                       |
| 12    | Back-office plateforme                                                                              |                                                                       |
| 13    | Durcissement et conformité                                                                          |                                                                       |
| —     | **Refonte UX, phase 5** — espace client                                                             | après la 12                                                           |
| —     | **Refonte UX, phase 7** — passe UI + refonte du design system                                       | sur décision                                                          |
