# Léo Clean — Corpus de spécifications produit

**Version** 1.0 — 18 août 2026
**Périmètre** Espace client · Espace intervenant · Funnel d'inscription intervenant · Console d'administration
**Auteur** Paul Duchâteau (Lite Ops / Paper Plane SASU)

---

## Comment lire ce corpus

| Fichier | Contenu | Lecteur cible |
|---|---|---|
| `00-socle-produit-et-technique.md` | Modèle économique, personas, architecture, design system, cycle de vie mission, conformité SAP/RGPD, pricing & matching | Fondateur, lead dev, conseil juridique |
| `01-espace-client.md` | Parcours de réservation, gestion d'abonnement, jour J, facturation, avance immédiate, parrainage, litiges | Dev front, designer |
| `02-espace-intervenant.md` | Tournée du jour, acceptation, check-in/out, rapport, revenus, conformité documentaire, offline | Dev front, ops |
| `03-funnel-inscription-intervenant.md` | Funnel guidé type LegalStart : création auto-entreprise, déclaration SAP, vérifications, activation | Dev front, ops recrutement |
| `04-console-admin.md` | Tableau de bord signaux/risques/frictions, files d'actions, CRM client & cleaner, inbox chat, revue de dossiers, finance, analytics | Fondateur, dev full-stack |
| `05-annexes-modele-de-donnees-evenements-api.md` | Schéma de données, taxonomie d'événements, endpoints, matrice de notifications, RLS | Lead dev |

## Décisions bloquantes à trancher avant développement

Trois arbitrages conditionnent une partie des specs. Ils sont marqués `⚠ DÉCISION` dans les documents.

1. **Modèle juridique** — prestataire (Léo Clean vend la prestation, sous-traite) *vs* mandataire / mise en relation (le client contracte l'intervenant, Léo Clean facture une commission). Impacte : qui porte la déclaration SAP, qui émet la facture, qui ouvre droit au crédit d'impôt, le risque de requalification en contrat de travail. Recommandation par défaut dans ce corpus : **mandataire renforcé**, avec un flag de configuration `BUSINESS_MODEL` pour ne pas figer le code.
2. **Attribution des missions** — assignation par l'algorithme (fluide, mais indice de subordination) *vs* offre acceptable/refusable par l'intervenant (protecteur juridiquement, plus de trous de couverture). Recommandation : **offre + fallback d'assignation volontaire opt-in**.
3. **Radius de 20 minutes** — contrainte produit dure (garantit la thèse de marque) ou paramètre de zone modulable par commune. Recommandation : **dur en front client, paramétrable en admin**.

> Ce corpus contient des analyses réglementaires à visée opérationnelle, pas un avis juridique. Les points SAP, sous-traitance, avance immédiate et requalification doivent être validés par un avocat en droit du travail et un conseil fiscal avant mise en production.
