# Prototype HTML — accueil, tunnel de réservation et espaces

Maquette cliquable, à ouvrir en double-cliquant sur `index.html`. Aucun serveur,
aucun réseau, aucune écriture : les polices, les icônes et les styles sont dans
`assets/`, et tout se joue dans le navigateur.

| Fichier                     | Ce que c'est                                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                | Accueil : thèse, quatre chiffres, prestations, tarifs, déroulé, comparatif, seize communes, engagements, conseils, questions, formulaire de contact. |
| `reserver.html`             | Tunnel en six écrans — adresse, durée, rythme, créneau, coordonnées, récapitulatif — puis la confirmation.                                           |
| `espace-client.html`        | Connexion client, sans mot de passe : lien envoyé par email, ou Google.                                                                              |
| `espace-cleaner.html`       | Connexion intervenant, même mécanique, plus l'argumentaire de candidature.                                                                           |
| `assets/leo-clean.css`      | Les tokens du design system, **recopiés verbatim**, puis la traduction en CSS de ses composants React. Chaque bloc nomme le fichier dont il vient.   |
| `assets/theme-menthe.css`   | La variante **menthe** : la palette du produit (`src/styles/tokens/colors.css`), posée sur le prototype. Sert aussi de base à la variante pop.       |
| `assets/theme-pop.css`      | La variante **pop** : coolors 6a46b8 · 63e6be · fec601 · ea7317, distribuée par rôle par-dessus la base menthe.                                      |
| `assets/theme-tropical.css` | La variante **tropical punch** : FF8243 · FFC0CB · FCE883 · 069494, sarcelle en profondeur et mangue en action.                                      |
| `assets/theme.js`           | La bascule entre les variantes, retenue d'une page à l'autre.                                                                                        |
| `assets/proto.js`           | Territoire, grille tarifaire, calcul du prix, calendrier, navigation.                                                                                |
| `assets/icons.js`           | Sprite Lucide extrait de `lucide-react` (licence ISC), engendré — ne pas éditer à la main.                                                           |

## Les quatre variantes

Le prototype s'ouvre en **tropical punch** ; un bouton dans le bandeau du haut
fait le tour des quatre, et le choix est retenu d'une page à l'autre.

- **tropical punch** — FF8243 · FFC0CB · FCE883 · 069494. La logique s'inverse :
  la couleur sombre n'est plus verte mais **sarcelle** (bandes, liens, logotype,
  états sélectionnés), et c'est la **mangue** qui porte l'action, texte encre.
  L'**ananas** reste en pilules, la **papaye** en surfaces douces — héros et
  panneau de sortie.
- **pop** — la palette coolors 6a46b8 · 63e6be · fec601 · ea7317, distribuée
  par rôle : la menthe reste l'action, le **violet** prend la profondeur
  (bande sombre, pied de page, liens, logotype), l'**or** les pilules et les
  moments de joie, l'**orange** une surface chaude par écran. C'est la
  hiérarchie qui empêche quatre teintes saturées de virer au cirque.
- **menthe** — la palette du produit, celle de dev.leoclean.fr : menthe
  `#63e6be` sur l'action principale avec texte encre, pêche pour la chaleur,
  citron pour les moments de joie, fond blanc à peine teinté vert.
- **vert forêt** — la palette du design system fourni en zip (leaf `#0E6E4F`,
  clay, marigold, fond crème).

La variante menthe ne recopie rien à la main : `theme-menthe.css` fait pointer
les échelles du zip (leaf, clay, marigold, cream) vers les valeurs de
`src/styles/tokens/colors.css`, puis corrige ce qu'un remappage ne sait pas
faire — la menthe pleine porte du texte encre, jamais du blanc, et l'action
principale reçoit l'ombre menthe signature du produit.

## Ce qui vient du design system

Palette leaf / clay / marigold / ink / cream, Alan Sans + Figtree + JetBrains
Mono, rayons pilule sur toute action, ombres teintées encre, en-tête translucide
à 12 px de flou, focus à 3 px, et le vocabulaire d'icônes du document. Les
composants suivis à l'identique : `Button`, `Card`, `Badge`, `Tag`, `Avatar`,
`Input`, `Textarea`, `Checkbox`, `OptionCard`, `ProgressSteps`, `Alert`,
`ServiceCard`, `StatBlock`, `SlotPicker`, `PriceSummary`, `SessionCard`.

## Le tunnel

**L'adresse ouvre le parcours**, et la couverture se dit tout de suite : la
saisie reconnaît un nom de commune ou un code postal, complète ce qui est en
train d'être tapé, et répond « nous intervenons à Léognan » ou nomme la commune
que nous ne desservons pas. Un refus qui nomme se comprend ; une liste de seize
communes à parcourir demande un effort avant le premier argument.

**Chaque bouton annonce l'écran suivant** — « choisir mon rythme », « saisir mes
coordonnées », « envoyer ma demande » — plutôt que « continuer », qui ne dit pas
vers quoi.

L'écran de durée porte les sept durées courantes **et** un curseur au pas de
30 minutes, les deux synchronisés. L'écran de créneau est un calendrier : bande
de jours sur onze jours, journées complètes affichées barrées, puis grille
d'heures. Le créneau préféré est en menthe pleine, les replis en menthe claire.

## Ce qui s'écarte du kit du design system, et pourquoi

Le kit `ui_kits/web/` est rédigé pour un service national générique. Deux de ses
partis pris heurtent les règles du dépôt et ont été remplacés :

- **Aucun avis, aucune métrique d'activité.** Le kit propose des témoignages,
  une note moyenne, « 1,2 M de sessions » et « 180 villes ». Le bloc
  d'engagements tient cette place tant qu'il n'existe pas d'avis réels. Voir
  `src/lib/facts.ts`.
- **La confirmation ne confirme pas une personne.** Le kit fait choisir son pro
  au client ; le produit diffuse la mission à cinq intervenants et le premier qui
  accepte l'emporte. L'écran final annonce donc une demande partie.

## Un point qui bloque une mise en ligne

**Le « ‑50 % crédit d'impôt » du bandeau de crédibilité est affiché à la demande
du porteur du projet, mais il contredit `src/lib/fiscal.ts`** : tant que la
déclaration services à la personne n'est pas obtenue, le site n'a le droit
d'annoncer que le statut du dossier, jamais un taux ni un montant après
réduction. C'est le seul élément du prototype qui ne pourrait pas partir en
production tel quel. Le tunnel, lui, respecte la règle : aucun montant après
crédit d'impôt n'y apparaît.

## Chiffres et leur source

Communes et codes postaux : `src/lib/territory.ts`. Tarifs : **28 €/h en
régulier, 30 €/h en ponctuel**, tels que l'arbre de travail les porte
aujourd'hui dans `src/lib/pricing/public-grid.ts` — et non les 29/33 encore
écrits dans `CLAUDE.md`, qui sont à mettre à jour. Durée minimale 2 h, plafond
6 h, 25 m² à l'heure, 30 min par option, annulation gratuite jusqu'à 24 h avant.
Barème d'annulation et assurance : `src/lib/pricing/cancellation.ts` et les CGU.

## Ce qui reste à fournir

Aucune photographie n'existe : les emplacements sont des blocs teintés portant la
mention « photo », comme le prévoit le design system. Ne pas les remplacer par de
l'image de banque ou générée sans arbitrage.
