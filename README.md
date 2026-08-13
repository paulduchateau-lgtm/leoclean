# LéoClean

Plateforme de ménage à domicile hyperlocale, à Léognan et dans les 13 communes
de la Communauté de communes de Montesquieu (Gironde, au sud de Bordeaux).

Deux modèles cohabitent sur la même plateforme : une **marketplace**
d'intervenants indépendants à qui les missions sont attribuées automatiquement,
et un **SaaS** pour les sociétés de ménage locales qui gèrent leurs propres
équipes et reçoivent des réservations via LéoClean comme via leur page publique.

## Démarrage

Prérequis : Node.js 22+, PostgreSQL 15+ avec l'extension PostGIS.

```bash
cd leoclean
npm install
cp .env.example .env   # puis compléter
npm run dev
```

Les variables d'environnement sont validées au démarrage par Zod
(`src/lib/env.ts`). Une configuration incomplète fait échouer le boot avec la
liste des champs fautifs, plutôt que de produire une erreur obscure au premier
appel d'API. Le fichier `.env.example` annote chaque bloc avec la phase qui le
rend nécessaire ; les phases non atteintes peuvent rester vides.

## Commandes

| Commande         | Effet                                  |
| ---------------- | -------------------------------------- |
| `npm run dev`    | Serveur de développement               |
| `npm run build`  | Build de production (typecheck inclus) |
| `npm run check`  | Typecheck, lint et tests unitaires     |
| `npm run test`   | Tests unitaires (Vitest)               |
| `npm run e2e`    | Tests de bout en bout (Playwright)     |
| `npm run format` | Prettier                               |

## Architecture

**Next.js 16** (App Router, Server Components), **TypeScript** strict,
**Tailwind CSS 4** et **shadcn/ui**. Persistance sur **PostgreSQL + PostGIS**
via **Prisma**. Authentification **Auth.js**, paiements **Stripe** (Payment
Intents, Connect Express, Billing), emails **Resend**, jobs asynchrones
**Inngest**. Tests **Vitest** et **Playwright**.

Le rendu des pages publiques est statique ou ISR : aucun contenu important
n'est placé derrière du JavaScript client. L'acquisition passe principalement
par le référencement local et par la citation dans les modèles de langage, ce
qui fait de la performance et de la structure du HTML des contraintes produit
et non des optimisations tardives.

Trois modules portent les invariants du domaine :

- `src/lib/territory.ts` — les 13 communes, seule source du périmètre couvert.
  Données factuelles issues de `geo.api.gouv.fr` (code INSEE, code postal,
  population légale, centroïde). Le code INSEE est l'identifiant de résolution :
  plusieurs communes partagent un code postal et les noms sont saisis de façon
  inconstante par les clients.
- `src/lib/site.ts` — la NAP (nom, adresse, téléphone) et l'identité publique.
  Lue par le JSON-LD, le pied de page, les mentions légales, `llms.txt` et les
  emails.
- `src/lib/env.ts` — le schéma de configuration.

À venir : `src/lib/scheduling/`, qui contiendra la fonction de disponibilité
— disponibilités déclarées moins occupations d'agenda externe, missions et
temps de trajet — comme source de vérité unique, pure et testée unitairement.

## Décisions de conception

La base stocke en UTC ; `Europe/Paris` n'existe qu'à l'affichage. Les montants
sont des entiers en centimes et se décomposent systématiquement en montant
brut, crédit d'impôt et reste à charge. Les mutations passent par des Server
Actions ; les Route Handlers sont réservés aux webhooks et aux endpoints
publics documentés. Zod valide chaque frontière, y compris les réponses des API
externes.

L'affichage du crédit d'impôt de 50 % est conditionné par
`NEXT_PUBLIC_SAP_DECLARED` : le calcul est toujours effectué et stocké, mais
rien n'est communiqué tant que la déclaration Services à la personne n'est pas
obtenue.

Le détail des conventions et l'état d'avancement par phase se trouvent dans
[`CLAUDE.md`](./CLAUDE.md).
