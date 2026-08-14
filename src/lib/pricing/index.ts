/**
 * Moteur de tarification.
 *
 * Fonctions pures : le devis ne dépend ni de la base, ni de l'horloge, ni de
 * la session. C'est ce qui permet de le tester exhaustivement — il produit le
 * montant que le client paie, la rémunération de l'intervenant, et la base du
 * crédit d'impôt.
 */
export * from "./cancellation";
export * from "./duration";
export * from "./money";
export * from "./quote";
