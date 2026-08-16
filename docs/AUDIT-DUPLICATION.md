# Audit de duplication des pages programmatiques

**Relevé du 16 août 2026**, sur les 28 pages générées à partir d'un gabarit.
Mesure faite sur le contenu du `<main>` seul — en-tête, pied de page et
navigation exclus, puisque ce sont les seules parties que les moteurs comparent
pour décider si un gabarit produit du contenu ou des satellites.

## Méthode

Deux indicateurs, parce qu'ils ne disent pas la même chose.

| Indicateur              | Ce qu'il mesure                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Mots** (Jaccard)      | Vocabulaire partagé. Deux pages sur le même service se ressemblent forcément un peu.                                       |
| **Phrases** (5-grammes) | Suites de cinq mots identiques. C'est celui qui compte : au-delà d'un seuil, les pages disent littéralement la même chose. |

Le recouvrement de phrases est pris dans le sens le plus défavorable des deux :
une page courte entièrement contenue dans une longue est un doublon, même si la
réciproque est fausse.

Script : `audit-similarite.mjs`, exécuté contre une construction de production.

## Résultat

**Le risque n'est pas là où on l'attendait.**

| Paire de gabarits                         | Phrases communes, médiane | Maximum |
| ----------------------------------------- | ------------------------: | ------: |
| `femme-de-menage` ↔ `femme-de-menage`     |                  **84 %** |    85 % |
| `repassage` ↔ `repassage`                 |                  **83 %** |    84 % |
| `menage-a-domicile` ↔ `menage-a-domicile` |                      55 % |    58 % |
| `femme-de-menage` ↔ `menage-a-domicile`   |                      23 % |    26 % |
| `menage-a-domicile` ↔ `repassage`         |                      22 % |    25 % |
| `femme-de-menage` ↔ `repassage`           |                      22 % |    25 % |

Deux lectures, l'une rassurante et l'autre non.

**`femme-de-menage/leognan` et `menage-a-domicile/leognan` ne sont pas des
doublons.** Ces deux pages partagent 23 % de leurs suites de cinq mots — elles
répondent réellement à deux questions différentes, ce que
`src/lib/intentions.ts` documente depuis le début : « femme de ménage à X » ne
cherche pas une prestation à acheter mais à comprendre qui emploie qui. La
crainte d'origine — trois gabarits × seize communes, indifférenciables — ne se
vérifie pas, et il n'y a **rien à fusionner** entre gabarits.

**Les pages d'une même intention sont, elles, des quasi-doublons entre
elles.** `femme-de-menage/gradignan` et `femme-de-menage/la-brede` partagent
85 % de leurs phrases. La cause est structurelle : dans `intentions.ts`, le
chapeau (`lede`), les sections éditoriales et la FAQ commune (`sharedFaq`) sont
écrits une fois pour l'intention entière ; seuls `local.text` et `local.faq`
changent d'une commune à l'autre. Sur environ 950 mots de page, la part propre
à la commune pèse une centaine.

Pour comparaison, les seize pages `menage-a-domicile` tiennent à 55 % : leur
contenu éditorial est écrit commune par commune dans `communes-content.ts`, et
`communes-content.test.ts` interdit déjà la moindre phrase en double.

## Ce qui a été fait

**Réduction à trois communes par intention, puis enrichissement** — l'option 2
suivie de l'option 1, arbitrée par le porteur du projet le 16 août 2026.

Les deux intentions visent désormais les mêmes trois communes : **Léognan**, le
siège, et **Gradignan** et **Villenave-d'Ornon**, les deux plus peuplées du
territoire, respectivement à 4,9 et 7,6 kilomètres de Léognan. Le choix combine
le volume de recherche et la proximité — les deux raisons qui font qu'une page
locale se classe et qu'un créneau tient.

Les six pages restantes sont passées d'une centaine de mots propres à trois
paragraphes et trois questions chacune, soit **1 130 à 1 250 mots par page**
contre 950 auparavant, dont 44 à 47 % ne peuvent être écrits pour une autre
commune. Le contenu ajouté est ancré dans des faits déjà publiés : typologie
d'habitat, quartiers, distances mesurées, population.

**Relevé après modification**, même méthode, même script :

| Paire de gabarits                         | Avant |    Après |
| ----------------------------------------- | ----: | -------: |
| `femme-de-menage` ↔ `femme-de-menage`     |  84 % | **62 %** |
| `repassage` ↔ `repassage`                 |  83 % | **61 %** |
| `menage-a-domicile` ↔ `menage-a-domicile` |  55 % |     49 % |
| `femme-de-menage` ↔ `menage-a-domicile`   |  23 % |     23 % |

**Aucune paire ne dépasse plus 70 %**, contre trente auparavant. Le maximum
observé est de 62 %, entre `femme-de-menage/villenave-d-ornon` et
`femme-de-menage/gradignan`.

Ce qui reste partagé est le chapeau, les trois sections éditoriales et la FAQ
commune : c'est le propos de l'intention, qui ne change pas d'une commune à
l'autre et qu'il serait malhonnête de réécrire en variantes.

### Les six URL retirées

Elles étaient indexables : les laisser répondre 404 perdrait sèchement ce
qu'elles avaient acquis. Chacune redirige en 301 vers la page commune
correspondante, qui traite le même lieu et existe toujours. Permanente et non
temporaire : la décision est prise, et un 307 laisserait les moteurs conserver
l'ancienne URL indéfiniment. La table vit dans `next.config.ts` ; un test de
bout en bout vérifie les redirections.

| Retirée                     | Vers                             |
| --------------------------- | -------------------------------- |
| `/femme-de-menage/cestas`   | `/menage-a-domicile/cestas`      |
| `/femme-de-menage/cadaujac` | `/menage-a-domicile/cadaujac`    |
| `/femme-de-menage/la-brede` | `/menage-a-domicile/la-brede`    |
| `/repassage/cadaujac`       | `/menage-a-domicile/cadaujac`    |
| `/repassage/saint-selve`    | `/menage-a-domicile/saint-selve` |
| `/repassage/martillac`      | `/menage-a-domicile/martillac`   |

### Le garde-fou

`intentions.test.ts` exige désormais trois paragraphes et trois questions par
commune, et une part propre au-dessus du tiers — la valeur à partir de laquelle
une page cesse d'être la variante de sa voisine. Le seuil précédent, 16 %,
n'était qu'un plancher constaté. Le test interdit aussi d'ajouter une quatrième
commune à moindres frais que les trois existantes, ce qui est exactement la
pente qui avait produit l'écart.

## Ce qu'il faudra surveiller

Le recouvrement de 62 % entre pages sœurs est acceptable et ne se réduira plus
sans toucher au propos commun de l'intention. Deux évolutions le referaient
monter, et ce sont les deux à surveiller :

- **Rouvrir le périmètre.** Ajouter une quatrième ou une cinquième commune
  rediviserait la part propre. Si le besoin se présente, écrire d'abord les
  trois paragraphes, publier ensuite.
- **Allonger les sections communes.** Chaque phrase ajoutée au chapeau ou aux
  sections est ajoutée à trois pages à la fois. Le test le rattrapera, mais il
  vaut mieux le savoir avant d'écrire.

Il reste enfin le mesuré des pages `menage-a-domicile` : 49 % entre elles, sans
qu'aucune paire n'approche le seuil. Elles sont écrites commune par commune
depuis le début, et `communes-content.test.ts` y interdit déjà la moindre phrase
en double.
