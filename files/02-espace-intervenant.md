# 02 — Espace intervenant (`/pro`)

Thème `consumer`, variante « pro » : même convivialité que côté client, densité légèrement supérieure, chiffres en JetBrains Mono. Contrainte de conception dominante : **utilisable debout, à une main, avec des gants, sur un téléphone d'entrée de gamme, dans un hall d'immeuble sans réseau**.

## 1. Arborescence

```
/pro                     Aujourd'hui (tournée du jour)
/pro/missions            Propositions · À venir · Historique
/pro/missions/:id        Fiche mission (écran de travail)
/pro/planning            Disponibilités, zones, congés
/pro/revenus             Relevé, factures, paiements
/pro/messages            Conversations (clients · Léo Clean)
/pro/profil              Profil public, documents, conformité, formation, parrainage
```

Barre d'onglets basse : **Aujourd'hui · Missions · Revenus · Profil**. Badge sur Missions pour les propositions en attente (avec compte à rebours), badge rouge sur Profil si un document expire sous 30 jours.

## 2. Aujourd'hui `/pro`

L'écran le plus utilisé du produit. Objectif : répondre à trois questions en un coup d'œil — _où je vais maintenant_, _combien je gagne aujourd'hui_, _qu'est-ce qui a changé_.

**Structure verticale :**

1. **Bandeau d'action** (un seul, prioritaire) : mission en cours à clôturer · check-in en retard · document expirant · proposition urgente < 15 min.
2. **Carte « Maintenant »** — la mission courante ou la prochaine :
   - Heure, prénom du client, adresse complète, `12 min de trajet`, durée prévue.
   - CTA géant collant : `Je suis arrivée` (check-in) ou `Terminer la mission` (check-out) selon l'état.
   - Boutons secondaires : _Itinéraire_ (deep link Waze/Google/Plans selon préférence enregistrée), _Appeler_ (proxy), _Consignes_.
3. **Suite de la tournée** — liste compacte : heure, client, ville, durée, trajet inter-mission. Trou de plus de 45 min matérialisé par un liseré et un lien _Voir les missions disponibles dans ce créneau_ — c'est le mécanisme principal de remplissage.
4. **Bilan du jour** : `3 missions · 7 h 30 · 217 € HT` en monospace.
5. **Ordre de tournée** : la séquence proposée par l'optimiseur est affichée avec la mention explicite « Ordre suggéré · vous restez libre de votre organisation » et un bouton _Réorganiser_. Aucune alerte, aucun score dégradé en cas de réorganisation (voir garde-fou `00 § 2.2`).

État vide : « Rien aujourd'hui. 4 missions cherchent quelqu'un dans ta zone cette semaine → _Voir_ ». Toujours une sortie active, jamais un écran mort.

## 3. Propositions et acceptation

### 3.1 Réception

Push + SMS (paramétrable) : `Nouvelle mission · mar. 26/08 8h-11h · Léognan · 12 min · 66 € HT · expire dans 30 min`. Le montant net et le temps de trajet doivent figurer dans la notification elle-même : c'est ce qui détermine l'acceptation.

### 3.2 Écran de proposition

- Date, plage, durée estimée, **rémunération HT explicite**, trajet depuis la mission précédente ou depuis le point d'ancrage.
- Récurrence : `Toutes les 2 semaines, le mardi matin` avec la mention « engagement souhaité : 3 mois » — informatif, non contraignant.
- Aperçu du logement : type, surface, pièces, animaux, produits fournis ou non, escalier/ascenseur. **Adresse au niveau rue seulement** avant acceptation (numéro exact révélé après) ; prénom du client seul.
- Compatibilité de tournée : `S'intègre bien entre ta mission de 8h et celle de 14h` ou `Créerait 50 min d'attente`.
- Actions : `Accepter` · `Refuser` (motif optionnel, 4 choix : trop loin / créneau pris / type de mission / autre) · `Plus tard` (garde la proposition jusqu'à expiration).
- Compte à rebours visible. À expiration, la proposition passe en historique avec la mention « proposée à quelqu'un d'autre » — jamais de formulation culpabilisante.

### 3.3 Transparence algorithmique

Page `/pro/profil/comment-ca-marche` : explication en français simple de l'ordre de proposition (proximité, continuité chez le même client, disponibilités déclarées, régularité de réponse) et de ce qui n'entre **pas** en jeu. Obligation morale, et utile en cas de contentieux.

## 4. Fiche mission `/pro/missions/:id` — écran de travail

Onglets internes : **Infos · Checklist · Rapport**.

### Infos

- Accès : interphone, code (révélé J-24h → J+2h, affiché en gros monospace, bouton _Copier_), boîte à clés, étage, stationnement.
- Consignes du client, zones interdites, animaux, allergies/produits à éviter, matériel disponible.
- Historique : `4ᵉ passage chez Camille · dernière fois : 2 h 40 · note laissée : ★★★★★`.
- Notes privées de l'intervenant sur ce logement (invisibles du client) — très demandé, très fidélisant.

### Checklist

- Par pièce, cases à cocher, persistée localement puis synchronisée. Tâches standard + tâches ajoutées par le client pour ce passage, visuellement distinguées.
- La checklist n'est pas un instrument de contrôle : elle sert de mémo et de preuve. Non bloquante au check-out (une confirmation « 3 tâches non cochées, continuer ? » suffit).

### Rapport

- Photos **avant/après** par pièce (`PhotoUploader`, compression client, upload en file résistant à la coupure réseau). Minimum recommandé : 2 avant, 2 après. Consigne affichée : « Cadre les pièces, pas les personnes ni les documents. »
- Durée réelle : calculée du check-in au check-out, ajustable avec motif si l'intervenant a oublié de pointer.
- **Anomalies** : catégories (dégât préexistant, équipement en panne, produit épuisé, accès impossible, logement inhabituellement sale, présence non prévue). Photo + commentaire. Une anomalie « logement inhabituellement sale » déclenche une proposition d'ajustement de durée soumise à validation admin, jamais facturée unilatéralement.
- Signature client optionnelle (`SignaturePad`) si présent.
- `Terminer` → passage en `COMPLETED`, notification client, déclenchement de la facturation.

### Check-in / check-out

- Géoloc capturée au tap, tolérance 150 m. Hors périmètre : `Je ne suis pas encore sur place ?` avec possibilité de forcer (motif journalisé) — pas de blocage : l'intervenant peut être dans un sous-sol, un immeuble mal géocodé, ou avoir refusé la localisation.
- Fallback sans GPS : code à 4 chiffres fourni par le client dans son espace, ou check-in manuel simple selon la configuration.
- Rappel push à H+10 min si aucun check-in ; alerte admin à H+20 (voir `04 § 3`).

## 5. Planning `/pro/planning`

- **Disponibilités récurrentes** : grille semaine × 4 plages, tap pour basculer. Modifiables librement jusqu'à J-72h ; au-delà, les missions déjà acceptées restent dues (obligation contractuelle de prestation, pas de subordination).
- **Objectif hebdomadaire** déclaré (heures souhaitées) — utilisé par le matching comme signal de charge, jamais comme quota.
- **Congés / absences** : plages de dates, motif optionnel. Un congé chevauchant des missions récurrentes déclenche un assistant : « 3 missions concernées → proposer un remplacement ? », avec réaffectation gérée par la plateforme et information du client.
- **Zones** : commune d'ancrage + rayon accepté (15/20/25 min), visualisation sur carte avec isochrone. Communes exclues à la main possible.
- **Compétences et options** : repassage, vitres en hauteur, animaux, allergies personnelles, permis/véhicule, produits fournis ou non. Impacte le matching.

## 6. Revenus `/pro/revenus`

- **En-tête** : `Ce mois : 1 840 € HT` · `Payé : 1 240 €` · `À venir : 600 €` en monospace, avec un graphique en barres simple par semaine.
- **Relevé détaillé** : une ligne par mission (date, client, durée, montant HT, commission, net), filtrable par mois, exportable CSV (indispensable pour la déclaration URSSAF trimestrielle).
- **Facturation** : en modèle mandataire, l'intervenant facture le client. Le produit propose un **mandat de facturation** (l'intervenant autorise Léo Clean à émettre ses factures en son nom et pour son compte) — cela évite 20 factures manuelles par mois et sécurise les mentions obligatoires. Le mandat doit être signé explicitement dans le funnel d'inscription, révocable.
- **Reversements** : Stripe Connect Express, virement hebdomadaire le vendredi pour les missions terminées avant mercredi. Le délai doit être affiché et tenu : c'est le premier motif de départ des intervenants. Statuts visibles : `en attente` / `en cours de virement` / `versé le 22/08`.
- **Aide déclarative** : rappel du montant à déclarer à l'URSSAF pour le trimestre, avec la mention « estimation, à vérifier ». Rappel push à J-7 de l'échéance déclarative. Pas de conseil fiscal, uniquement un rappel de dates et de cumuls.
- **Suivi du plafond micro-entreprise** : jauge (chiffre d'affaires annuel cumulé / seuil), alerte à 80 %. Fonction très appréciée et peu coûteuse.

## 7. Messages `/pro/messages`

- Fils par client actif (mission à venir ou < 72 h) + fil Léo Clean.
- Réponses rapides : « Je suis en route, j'arrive vers 9h15 », « Je suis devant, l'interphone ne répond pas », « Il me manque un produit », « Je dois décaler de 30 min ».
- Le bouton `Prévenir d'un retard` compose un message et notifie le client par push+SMS avec le nouvel ETA — un seul tap, parce qu'un retard non annoncé est le principal générateur de réclamation.
- Escalade : `Signaler un problème à Léo Clean` (accès impossible, situation à risque, litige client, dégât) → crée un ticket admin priorisé, avec un chemin dédié pour les situations de sécurité (comportement inapproprié du client) traité manuellement et sans délai.
- Détection de contournement symétrique à celle du client, signal ops uniquement.

## 8. Profil, conformité, formation

### Profil public

Photo, prénom + initiale, présentation en 300 caractères, ancienneté, nombre de missions, note, tags d'avis, compétences. Prévisualisation « vu par le client ».

### Documents et conformité

`DocumentSlot` par pièce, avec statut (`manquant` / `en vérification` / `valide jusqu'au JJ/MM/AAAA` / `refusé + motif`) :

| Document                                       | Obligatoire             | Expiration suivie                 |
| ---------------------------------------------- | ----------------------- | --------------------------------- |
| Pièce d'identité                               | oui                     | oui                               |
| Justificatif SIRET / avis de situation SIRENE  | oui                     | non (revérification API annuelle) |
| Attestation de vigilance URSSAF                | oui                     | **oui, 6 mois**                   |
| Récépissé de déclaration SAP (n° NOVA)         | oui (modèle mandataire) | non                               |
| Attestation RC Pro                             | oui                     | **oui, 12 mois**                  |
| IBAN + RIB                                     | oui                     | non                               |
| Attestation d'assurance véhicule (si véhicule) | si applicable           | oui                               |

Relances automatiques J-45 / J-15 / J-3 / J-0. À expiration d'un document obligatoire : **mise en pause du compte** — plus de nouvelles propositions, missions déjà acceptées maintenues si l'assurance le permet (sinon réaffectation), message explicatif non punitif, chemin de régularisation en un écran.

### Formation « Léo Academy »

Modules courts (3-5 min, vidéo + fiche PDF) : protocole d'entrée dans un logement, ordre de nettoyage efficace, produits et surfaces fragiles, sécurité et gestes, relation client et discrétion, que faire en cas de dégât, gestion des clés. Suivi de complétion. Deux modules obligatoires avant activation (protocole + dégât/sécurité), le reste facultatif avec badges affichés au client. Attention : imposer une formation détaillée sur les _méthodes_ de travail est un indice de subordination ; cadrer les modules comme des standards de sécurité et de qualité contractuels, pas comme des directives d'exécution.

### Parrainage intervenant

Code personnel, prime versée après N missions réalisées par le filleul (ex. 80 € après 10 missions). C'est le canal de recrutement le moins cher ; il mérite une place en dur dans la navigation.

## 9. Mode hors-ligne

Priorité absolue : un intervenant sans réseau dans un immeuble doit pouvoir travailler.

| Donnée                                        | Stratégie                                                                                                                                           |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tournée du jour + fiches missions (J-1 à J+1) | Pré-chargées à l'ouverture, stockées en IndexedDB, chiffrées pour les codes d'accès                                                                 |
| Check-in / check-out                          | Enregistrés localement avec horodatage device + position, synchronisés à la reconnexion (le timestamp local fait foi, avec marquage `offline_sync`) |
| Photos                                        | File d'upload persistante, reprise automatique, indicateur `3 photos en attente d'envoi`                                                            |
| Checklist                                     | Local-first, fusion par dernier écrit                                                                                                               |
| Chat                                          | Envoi différé avec état `en attente` explicite                                                                                                      |

Bandeau global `Hors connexion — tes actions sont enregistrées` en haut, non bloquant.

## 10. Notifications intervenant

| Événement                | Canal         | Fenêtre                                                                                       |
| ------------------------ | ------------- | --------------------------------------------------------------------------------------------- |
| Nouvelle proposition     | Push + SMS    | Immédiat, respecte les heures déclarées (par défaut 7 h-21 h)                                 |
| Rappel de mission        | Push          | J-1 18 h et H-1                                                                               |
| Check-in manquant        | Push          | H+10 min                                                                                      |
| Annulation client        | Push + SMS    | Immédiat                                                                                      |
| Modification de consigne | Push          | Immédiat                                                                                      |
| Message client           | Push          | Immédiat                                                                                      |
| Virement effectué        | Push + e-mail | À l'exécution                                                                                 |
| Document expirant        | Push + e-mail | J-45/15/3/0                                                                                   |
| Avis reçu                | Push          | Immédiat si ≥ 4, groupé quotidien si < 4 (éviter la notification humiliante en plein service) |

## 11. Critères d'acceptation (extraits)

1. Depuis l'écran d'accueil, le check-in de la mission courante est atteignable en **1 tap**.
2. Une proposition de mission affiche systématiquement rémunération HT, temps de trajet et compatibilité de tournée, sans scroll.
3. Un cycle complet check-in → checklist → 4 photos → check-out est réalisable **entièrement hors ligne** et se synchronise sans perte après reconnexion.
4. Le code d'accès est illisible dans l'application en dehors de la fenêtre J-24h/J+2h, y compris en cache local.
5. Aucun libellé de l'interface n'emploie un vocabulaire disciplinaire (audit lexical automatisé sur les fichiers de traduction : liste noire `sanction, avertissement, obligation de, vous devez impérativement, faute`).
6. La modification des disponibilités récurrentes prend effet sans intervention humaine et se reflète dans les créneaux client sous 60 secondes.
