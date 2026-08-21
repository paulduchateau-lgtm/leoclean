/**
 * Comptes employés par la suite de bout en bout.
 *
 * **Ce fichier n'est pas un fichier de test**, et c'est sa raison d'être :
 * Playwright refuse qu'un test en importe un autre — la valeur partagée vivait
 * dans `nettoyage.setup.ts`, ce qui faisait échouer toute la suite avant son
 * premier scénario.
 *
 * Le domaine `@leoclean.test` n'appartient à personne : c'est lui qui autorise
 * le nettoyage à supprimer ces comptes sans jamais risquer d'emporter un vrai.
 */

export const DOMAINE_DE_TEST = "@leoclean.test";

/** Le compte qui sert à vérifier la connexion par mot de passe. */
export const COMPTE_MOT_DE_PASSE = {
  email: `connexion${DOMAINE_DE_TEST}`,
  motDePasse: "le chat dort sur le radiateur",
};
