/**
 * Horizon de réservation, en jours.
 *
 * Cette valeur était écrite trois fois : dans les server actions, dans le
 * backend de la vitrine statique, et implicitement dans l'écran de choix du
 * créneau, qui doit connaître l'étendue du calendrier pour montrer les
 * journées sans disponibilité au lieu de les faire disparaître. Une constante
 * recopiée finit toujours par diverger, et la divergence se verrait ici sous
 * la pire forme : un calendrier qui s'arrête avant la fin de ce que le serveur
 * sait proposer.
 *
 * Le module ne dépend de rien, et n'est donc ni `server-only` ni marqué
 * `"use server"` — un fichier de server actions ne peut de toute façon
 * exporter que des fonctions asynchrones.
 */
export const BOOKING_HORIZON_DAYS = 21;

/**
 * Marge de trajet appliquée quand la destination n'est qu'un centre de commune.
 *
 * Le tunnel demande la commune avant l'adresse : entre les deux, les créneaux
 * sont cherchés sur un point qui n'est pas encore le bon. Dix minutes couvrent
 * l'écart entre le bourg et les adresses d'une commune de notre territoire —
 * l'estimation géométrique valant `3,45 + 1,249 × km`, cela représente un peu
 * plus de cinq kilomètres de rayon. Les communes forestières s'étendent
 * au-delà : le créneau y est de toute façon réévalué sur l'adresse réelle à la
 * confirmation, et `createBooking` essaie le candidat suivant si le premier ne
 * tient plus.
 *
 * Elle vit ici, avec l'horizon, pour la même raison : la vitrine statique doit
 * proposer exactement les mêmes créneaux que la production, or son moteur
 * tourne dans le navigateur et ne peut rien importer de `server-only`.
 */
export const COMMUNE_TRAVEL_MARGIN_MINUTES = 10;
