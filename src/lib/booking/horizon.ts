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
