# Scaleway Object Storage

Deux buckets, `leoclean-prod` et `leoclean-dev`, en `fr-par`. Compatible S3,
hébergé en France : les pièces d'identité ne quittent pas l'Union européenne, ce
qui évite d'avoir à documenter un transfert.

Le code qui parle au coffre vit dans [`src/lib/stockage/s3.ts`](../../src/lib/stockage/s3.ts).

## Vérifier que le coffre répond

```bash
npm run stockage:verifier
```

Le script fait le même aller-retour que le produit — écrire, relire par URL
signée, **vérifier que sans signature le bucket refuse**, supprimer — avec un
fichier jetable. Une configuration de stockage se croit bonne jusqu'au premier
dépôt, qui a lieu devant quelqu'un : un candidat qui téléverse sa pièce
d'identité, un intervenant qui photographie une pièce en fin de mission.

Il exige les quatre droits dont le produit a besoin, et pas un de plus. Une clé
qui saurait écrire sans savoir supprimer passerait un test de dépôt naïf et
échouerait à la première pièce remplacée.

## Variables d'environnement

Les noms font foi côté code : [`src/lib/env.ts`](../../src/lib/env.ts).

| Variable               | Valeur                           |
| ---------------------- | -------------------------------- |
| `STOCKAGE_PROVIDER`    | `scaleway`                       |
| `SCALEWAY_S3_ENDPOINT` | `https://s3.fr-par.scw.cloud`    |
| `SCALEWAY_S3_REGION`   | `fr-par`                         |
| `SCALEWAY_S3_BUCKET`   | `leoclean-prod` · `leoclean-dev` |
| `SCALEWAY_ACCESS_KEY`  | identifiant de la clé d'API      |
| `SCALEWAY_SECRET_KEY`  | secret de la clé d'API           |

Absente, `STOCKAGE_PROVIDER` ferme le dépôt : les écrans le disent et donnent le
téléphone, plutôt que d'accepter un fichier qu'ils perdraient.

## CORS

`cors.json` s'applique avec l'outil S3 de votre choix :

```bash
aws s3api put-bucket-cors --bucket leoclean-dev --cors-configuration file://cors.json --endpoint-url https://s3.fr-par.scw.cloud
```

**Il n'est pas nécessaire au fonctionnement actuel**, et le dire évite de croire
qu'il protège quelque chose. Le produit ne fait jamais parler le navigateur au
coffre : un dépôt passe par une server action — les octets traversent notre
serveur — et une lecture passe par une URL signée que le navigateur suit comme
une navigation ordinaire, ce que CORS ne régit pas.

Il devient nécessaire le jour où un dépôt se fera **directement du navigateur
vers le coffre**, par URL signée en `PUT`. C'est le sens de `PUT` dans la liste
des méthodes, et c'est pourquoi la configuration est versionnée maintenant
plutôt que reconstituée ce jour-là.

Les origines couvrent la vitrine, la dev, le futur sous-domaine applicatif, les
prévisualisations Vercel et le poste de développement.

## Ce qui reste à régler sur la console

- [ ] Bucket **privé**, sans visibilité publique ni site web statique. Le script
      de vérification échoue si le bucket répond sans signature.
- [ ] Clé d'API **restreinte à ces seuls buckets**, et à aucun autre service du
      projet.
- [ ] Cycle de vie sur le préfixe `missions/`, aligné sur la rétention de treize
      mois de [`src/lib/rgpd/retention.ts`](../../src/lib/rgpd/retention.ts). Une
      purge en base qui laisserait les fichiers ferait mentir la promesse
      d'effacement.
- [ ] Versionnement **désactivé** sur le préfixe `kyc/` : une version antérieure
      d'une pièce d'identité survivrait à sa suppression, ce que le droit à
      l'effacement interdit.
