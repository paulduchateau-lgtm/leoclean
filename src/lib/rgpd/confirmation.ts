/**
 * Mot à recopier avant un effacement.
 *
 * Il vit dans son propre module, et non auprès de l'action qui l'emploie : un
 * fichier `"use server"` ne peut exporter que des fonctions asynchrones, et
 * une constante y est refusée à la construction — pas au typage, ce qui la
 * rend invisible jusqu'au build.
 *
 * L'écran et le serveur lisent la même valeur : afficher un mot et en attendre
 * un autre est la meilleure façon de rendre une suppression impossible sans
 * que personne comprenne pourquoi.
 */
export const MOT_DE_CONFIRMATION = "SUPPRIMER";
