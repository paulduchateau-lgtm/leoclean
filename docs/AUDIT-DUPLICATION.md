# Audit de duplication des pages programmatiques

**Relevé du 16 août 2026**, sur les 28 pages générées à partir d'un gabarit.
Mesure faite sur le contenu du `<main>` seul — en-tête, pied de page et
navigation exclus, puisque ce sont les seules parties que les moteurs comparent
pour décider si un gabarit produit du contenu ou des satellites.

## Méthode

Deux indicateurs, parce qu'ils ne disent pas la même chose.

| Indicateur                | Ce qu'il mesure                                        |
| ------------------------- | ------------------------------------------------------ |
| **Mots** (Jaccard)        | Vocabulaire partagé. Deux pages sur le même service se ressemblent forcément un peu. |
| **Phrases** (5-grammes)   | Suites de cinq mots identiques. C'est celui qui compte : au-delà d'un seuil, les pages disent littéralement la même chose. |

Le recouvrement de phrases est pris dans le sens le plus défavorable des deux :
une page courte entièrement contenue dans une longue est un doublon, même si la
réciproque est fausse.

Script : `audit-similarite.mjs`, exécuté contre une construction de production.

## Résultat

**Le risque n'est pas là où on l'attendait.**

| Paire de gabarits                   | Phrases communes, médiane | Maximum |
| ----------------------------------- | ------------------------: | ------: |
| `femme-de-menage` ↔ `femme-de-menage` |                  **84 %** |    85 % |
| `repassage` ↔ `repassage`             |                  **83 %** |    84 % |
| `menage-a-domicile` ↔ `menage-a-domicile` |                    55 % |    58 % |
| `femme-de-menage` ↔ `menage-a-domicile` |                      23 % |    26 % |
| `menage-a-domicile` ↔ `repassage`       |                      22 % |    25 % |
| `femme-de-menage` ↔ `repassage`         |                      22 % |    25 % |

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

Rien de destructif. **Aucune page n'a été supprimée ni fusionnée** — le brief
l'interdit sans arbitrage, et l'audit montre de toute façon que la fusion
envisagée n'était pas la bonne opération.

Un garde-fou exécutable a été posé à la place : `intentions.test.ts` borne
désormais la part propre à chaque commune, de la même façon que
`communes-content.test.ts` le fait pour les pages communes. La situation ne peut
plus se dégrader en silence.

## Ce qui reste à trancher

Les douze pages d'intention sont à 84 % identiques entre elles. Trois issues,
qui ne se valent pas :

1. **Enrichir.** Porter la part propre à chaque commune à 300 mots réellement
   spécifiques — quartiers, typologie d'habitat, prix pratiqués localement en
   emploi direct — ferait tomber le recouvrement sous 60 %. C'est douze
   paragraphes à écrire, et ils ne s'inventent pas : ils demandent de la
   connaissance de terrain.
2. **Réduire.** Publier `femme-de-menage` et `repassage` sur deux ou trois
   communes seulement, celles où l'intention a vraiment quelque chose de
   particulier à dire. Quatre pages fortes valent mieux que douze tièdes.
3. **Laisser.** 84 % entre pages sœurs d'un même gabarit est courant sur les
   sites locaux, et Google traite plus souvent ces pages en « contenu de faible
   valeur » qu'en pénalité. Le risque est un non-classement, pas une sanction.

**Recommandation : option 2, puis option 1 sur ce qui reste.** Le périmètre
actuel — six communes par intention, choisies pour leur population — n'a pas de
justification éditoriale ; il a une justification arithmétique. Réduire à trois
communes par intention, celles pour lesquelles il existe un vrai angle local,
rend l'enrichissement faisable à la main.

Cette décision appartient au porteur du projet : elle retire des URL indexables,
ce qui exige des redirections 301 et se paie en visibilité le temps que les
moteurs se réajustent.
