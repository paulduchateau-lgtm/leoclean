# Audit des parcours — phase 0

État au 14 août 2026. Aucun code modifié. À lire avec
[FEATURES-FREEZE.md](FEATURES-FREEZE.md), qui dit ce qui existe ; ce document
dit ce que cela coûte à l'utilisateur.

## Convention de comptage

Un **tap** est une action isolée du doigt sur une cible :

- appuyer sur un bouton, un lien, une carte, un créneau = 1 tap ;
- entrer dans un champ de texte et le remplir = 1 tap, quel que soit le nombre
  de caractères ;
- corriger une valeur déjà présente dans un champ = 2 taps (sélection puis
  saisie) ;
- une liste déroulante native = 2 taps (ouvrir, choisir).

Le défilement n'est pas compté, mais il est signalé : c'est un coût réel.

Un **écran** est un état pour lequel l'utilisateur doit décider de quelque
chose. La confirmation compte comme un écran.

Mesures faites sur un viewport de 390 px, parcours au pouce, appareil sans
session.

---

## Parcours 1 — Réserver un ménage ponctuel, nouvel utilisateur

### 1a. Entrée par l'accueil, recherche d'adresse fonctionnelle

| #   | Écran                | Tap                                        |
| --- | -------------------- | ------------------------------------------ |
| 1   | Accueil              | 1 · bouton `Réserver` de l'en-tête         |
| 2   | Tunnel · Adresse     | 2 · champ adresse + saisie                 |
|     |                      | 3 · résultat proposé                       |
| 3   | Tunnel · Logement    | 4-5 · champ surface (valeur 80 à corriger) |
|     |                      | 6 · fréquence `Une seule fois`             |
|     |                      | 7 · `Voir les créneaux`                    |
| 4   | Tunnel · Créneau     | 8 · un créneau                             |
| 5   | Tunnel · Coordonnées | 9 · prénom                                 |
|     |                      | 10 · nom                                   |
|     |                      | 11 · email                                 |
|     |                      | 12 · téléphone                             |
|     |                      | 13 · `Réserver`                            |
| 6   | Confirmation         | —                                          |

**13 taps, 6 écrans.** Cible : ≤ 14 taps, ≤ 6 écrans → **atteinte**, de justesse
et dans le meilleur des cas.

### 1b. Entrée par une page commune, recherche d'adresse indisponible

C'est le cas réaliste : l'acquisition passe par le référencement local, donc par
`/menage-a-domicile/<commune>`, et la Base Adresse Nationale limite son débit.

| #   | Écran                                        | Tap                                        |
| --- | -------------------------------------------- | ------------------------------------------ |
| 1   | Page commune (après ~4 écrans de défilement) | 1 · `Voir les créneaux à Léognan`          |
| 2   | Tunnel · Adresse                             | 2 · `Saisir mon adresse manuellement`      |
|     |                                              | 3 · champ rue                              |
|     |                                              | 4-5 · liste des communes (ouvrir, choisir) |
|     |                                              | 6 · `Continuer`                            |
| 3   | Tunnel · Logement                            | 7-8 · surface                              |
|     |                                              | 9 · fréquence                              |
|     |                                              | 10 · `Voir les créneaux`                   |
| 4   | Tunnel · Créneau                             | 11 · un créneau                            |
| 5   | Tunnel · Coordonnées                         | 12-15 · prénom, nom, email, téléphone      |
|     |                                              | 16 · `Réserver`                            |
| 6   | Confirmation                                 | —                                          |

**16 taps, 6 écrans.** Cible dépassée de 2 taps — dont un `Continuer` interdit
par les critères d'acceptation, et une commune redemandée alors qu'elle était
connue à l'écran précédent.

### Ce que le compteur ne dit pas

Le tunnel n'est pas long, il est **aveugle** : à l'étape 1 aucun prix, à
l'étape 3 aucun prix, aucun repère de progression en bas d'écran, et une
recherche de créneaux qui peut durer plusieurs secondes sans autre signal qu'un
libellé de bouton. Le nombre de taps est déjà correct ; c'est l'incertitude
entre deux taps qu'il faut supprimer.

---

## Parcours 2 — Réserver un ménage récurrent, utilisateur connu

**16 taps, 6 écrans — identiques au parcours d'un inconnu.** Cible : ≤ 8 taps.

Le tunnel ne lit jamais la session. Un client déjà venu retape son adresse, sa
surface, son prénom, son nom, son email et son téléphone. `AddressStep`
n'interroge pas son carnet d'adresses — qui existe pourtant en base — et
`ContactStep` ignore qu'il a un compte.

Deuxième constat, plus lourd : **choisir « Chaque semaine » ne crée aucune
récurrence.** Le modèle `Subscription` existe, `createBooking` ne l'écrit pas.
La fréquence ne sert aujourd'hui qu'à sélectionner le tarif horaire. L'écran
promet pourtant « Le même intervenant, le même créneau ».

---

## Parcours 3 — Modifier ou annuler une réservation

**Impossible.** Cible : ≤ 4 taps.

`/mon-compte` affiche une adresse email, une liste d'appartenances et un bouton
de déconnexion. Il n'existe ni liste de réservations, ni écran de détail, ni
action de modification ou d'annulation — alors que le barème d'annulation est
calculé, testé, et publié sur `/tarifs`. Après avoir réservé, le client n'a
d'autre recours que le téléphone.

---

## Les 10 frictions les plus coûteuses

Classées par nombre d'utilisateurs touchés.

### 1. Le tunnel est presque introuvable — 100 % des visiteurs

Deux liens mènent à `/reserver` dans tout le site : le bouton de l'en-tête et
le CTA en bas des 16 pages communes. Ni l'accueil (dont le héros propose
téléphone, WhatsApp et email), ni `/tarifs`, ni les 12 pages d'intention, ni le
blog, ni `/etre-rappele` n'y renvoient. Le canal décrit comme principal est
traité comme secondaire.

### 2. Le prix disparaît sur la moitié du tunnel — 100 % des entrants

Visible à l'étape Logement et dans le récapitulatif de l'étape Coordonnées.
**Absent à l'étape Adresse et à l'étape Créneau** — c'est-à-dire précisément au
moment où l'on choisit un jour et une heure, quand la question « combien ça me
coûte » est la plus vive.

### 3. Aucune persistance de l'état — 80 % de mobiles

Tout vit dans l'état d'un composant. Un rechargement, un appel entrant, un
retour navigateur, une bascule d'application : le parcours repart de zéro,
adresse comprise. Aucune reprise n'est proposée.

### 4. Le retour arrière détruit la saisie — tous ceux qui hésitent

Depuis l'étape Coordonnées, revenir choisir un autre créneau vide les six
champs déjà remplis : `ContactStep` est démonté, son état local disparaît. C'est
le retour arrière le plus probable du parcours, et le plus coûteux.

### 5. L'étape « Logement » pose deux questions et impose un défaut à corriger

Surface **et** fréquence sur le même écran. La surface est préremplie à 80 m²,
valeur qu'il faut sélectionner puis écraser au clavier numérique. Personne ne
connaît sa surface au mètre près : proposer des types de logement, comme le fait
`/tarifs` avec ses quatre exemples, coûterait un tap au lieu de deux et
supprimerait l'hésitation.

### 6. La recherche de créneaux n'a aucun accompagnement — tous

Elle interroge le moteur de disponibilité sur trois semaines et 60 créneaux ; le
test de bout en bout lui accorde 30 secondes. Pendant ce temps, l'écran ne
change pas : seul le libellé du bouton devient « Recherche des créneaux… ».
Aucun squelette, aucune projection de ce qui va apparaître.

### 7. Les créneaux sont une liste à plat, et les jours vides sont invisibles

Jusqu'à 60 boutons d'heures empilés par journée sur trois semaines, sans choix
de date, sans distinction matin/après-midi. Les journées sans disponibilité
n'apparaissent pas du tout : le client ne sait pas s'il n'y a rien ce jour-là ou
si le service est vide. Rendre les indisponibilités visibles ne demande aucun
changement de contrat serveur — la grille des heures candidates se dérive à
l'affichage, et l'on barre celles que le moteur n'a pas renvoyées.

### 8. Aucune action primaire ancrée en bas d'écran

Les boutons suivent le flux du contenu. Sur 390 px, « Voir les créneaux » est
sous une liste de quatre cartes de fréquence, et « Réserver » sous six champs :
les deux exigent de faire défiler. Pire, sur l'étape Créneau, le seul bouton de
l'écran est « Retour » — l'action secondaire y est la plus visible.

### 9. Le contexte de la page commune est perdu à l'entrée du tunnel

`BookingFunnel` accepte un `defaultQuery` qu'aucun appelant ne renseigne. Un
client qui vient de lire une page entière sur Gradignan arrive devant un champ
d'adresse vide et retape « Gradignan ».

### 10. Après la réservation, l'espace client est un cul-de-sac

La confirmation annonce un email et un numéro de téléphone. `/mon-compte`, seul
espace connecté, n'affiche pas la réservation qui vient d'être prise. Toute
question ultérieure — décaler, annuler, savoir qui vient — passe par le
téléphone.

### Mentions complémentaires, moins coûteuses mais bloquantes pour la recette

- Le bouton « Continuer » de la saisie manuelle est explicitement interdit par
  les critères d'acceptation.
- Aucune option (repassage, vitres, four…) ni aucune prestation autre que le
  ménage régulier n'est atteignable depuis le tunnel, alors que le catalogue les
  porte. Ce n'est pas une régression : cela n'a jamais eu d'interface.
- Le formulaire de rappel rejette silencieusement les envois de moins de trois
  secondes. C'est voulu et protecteur, mais cela signifie qu'un utilisateur très
  rapide reçoit une confirmation pour une demande jamais enregistrée. À ne pas
  « corriger » sans mesurer le coût en spam.

---

## Ce qui est déjà bon et qu'il faut préserver

À ne pas défaire par recherche d'uniformité :

- l'ordre des étapes — l'adresse d'abord, parce qu'elle décide si l'on peut
  répondre ;
- le devis demandé au serveur dès la sélection de l'adresse, sans tap
  supplémentaire ;
- la bascule en saisie manuelle, présente en permanence et non en cas d'échec
  seulement ;
- le retour automatique au choix de créneau quand un créneau vient d'être pris,
  avec un message qui explique ;
- l'état vide des créneaux, qui propose un numéro de téléphone plutôt qu'une
  impasse ;
- les messages d'erreur métier, écrits pour être lus ;
- la page commune, dense mais réellement locale.

---

## Trois conflits avec le gel fonctionnel — arbitrage nécessaire

### A. La phase 5 porte sur des fonctionnalités qui n'existent pas

Le plan prévoit « Espace client : réservations, modification, annulation,
notation, adresses, moyens de paiement, parrainage — **mêmes fonctionnalités**,
appliquées aux mêmes lois ». Aucune de ces sept n'a d'interface aujourd'hui ;
plusieurs n'ont même pas de server action. Les construire n'est pas une refonte
d'expérience, c'est le développement des phases 7 à 8 du produit.

Trois issues : limiter la phase 5 à la refonte de `/mon-compte` tel qu'il est ;
lever le gel pour ce périmètre précis et le traiter comme du développement ; ou
la reporter après le paiement Stripe. **Sans décision, la phase 5 est bloquée**
et la cible « modifier ou annuler en 4 taps » restera hors d'atteinte.

### B. Le préremplissage pour un utilisateur connu ajoute du code serveur

Les lois L15 et L16 imposent de ne jamais redemander une information connue. Le
tunnel étant entièrement anonyme, cela suppose une nouvelle lecture serveur —
profil et carnet d'adresses de la session — donc une server action qui n'existe
pas. C'est un ajout, même s'il ne crée aucun écran. Sans elle, la cible de 8
taps du parcours 2 est inatteignable.

### C. La récurrence promise n'est pas créée

« Chaque semaine — le même intervenant, le même créneau » décrit un abonnement
que la réservation n'écrit pas. On ne peut pas corriger cela par la microcopie
sans affaiblir l'argument commercial central, ni le laisser tel quel sans
promettre ce qui n'a pas lieu. Proposition, à valider : reformuler en tarif
(« formule régulière, tarif à 29 €/h ») et annoncer explicitement que les
passages suivants sont calés ensemble après le premier — ce qui est le
fonctionnement réel aujourd'hui, par téléphone.

### Point annexe — direction visuelle

La palette et les polices demandées (Bricolage Grotesque, General Sans) entrent
en tension avec la loi du dépôt : le design system Léo Clean fait foi, ses
tokens sont importés et jamais recopiés, aucune couleur n'est écrite en dur, et
les polices actuelles sont Epilogue et Figtree. Deux contraintes de fait :
General Sans n'est pas distribuée par Google Fonts, donc pas chargeable par
`next/font/google` sans fichier local ; et un bloc `@theme` de couleurs
littérales contredirait directement la règle « ne jamais écrire de couleur en
dur ».

La passe visuelle étant la phase 7, rien de tout cela n'est urgent. La solution
propre existe : déclarer la nouvelle palette comme une couche de tokens dans
`src/styles/tokens/` et recâbler les variables sémantiques dessus, sans écrire
une seule couleur dans un composant. C'est ce que je ferai, sauf indication
contraire.

---

## Ce que fera la phase 1, sous réserve de vos réponses

Sans attendre A, B et C, qui ne concernent que les parcours 2 et 3 :

1. découper « Logement » en deux écrans — le logement, puis la fréquence — avec
   des types de logement préremplis plutôt qu'une saisie au mètre carré ;
2. barre de prix persistante, présente aux quatre étapes, actualisée à chaque
   changement ;
3. action primaire unique, ancrée en bas d'écran, libellée par l'écran suivant ;
4. état du tunnel remonté hors des composants d'étape, pour que le retour
   arrière cesse d'être destructif ;
5. choix du jour puis de l'heure, avec les indisponibilités visibles ;
6. entrée du tunnel depuis le héros de l'accueil et transmission de la commune
   depuis les pages locales.

Ni le périmètre fonctionnel, ni les contrats serveur, ni le calcul des prix ne
sont touchés.
