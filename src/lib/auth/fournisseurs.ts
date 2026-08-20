/**
 * Les fournisseurs sociaux réellement configurés.
 *
 * Module **pur** : il ne lit que des variables d'environnement, et il est lu à
 * la fois par la server action — qui doit valider ce que le navigateur envoie —
 * et par l'écran de connexion, qui ne doit afficher aucun bouton menant à une
 * erreur. Une seule liste, donc, plutôt que deux qui divergeraient.
 *
 * La condition porte sur les deux variables ensemble : un identifiant sans
 * secret produit un fournisseur qu'Auth.js refuse au démarrage.
 */

export interface Fournisseur {
  id: string;
  nom: string;
}

const DECLARES: readonly (Fournisseur & { configure: boolean })[] = [
  {
    id: "google",
    nom: "Google",
    configure: Boolean(
      process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
    ),
  },
  {
    id: "apple",
    nom: "Apple",
    configure: Boolean(
      process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET,
    ),
  },
  {
    id: "facebook",
    nom: "Facebook",
    configure: Boolean(
      process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET,
    ),
  },
];

export const FOURNISSEURS_ACTIFS: readonly Fournisseur[] = DECLARES.filter(
  (fournisseur) => fournisseur.configure,
).map(({ id, nom }) => ({ id, nom }));
