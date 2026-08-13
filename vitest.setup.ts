import "@testing-library/jest-dom/vitest";

/**
 * Les tests s'exécutent en UTC, comme la base de données.
 *
 * Un test qui passe uniquement en Europe/Paris masque exactement le type de
 * bug que l'on cherche à éviter : un créneau décalé d'une heure au changement
 * d'heure, ou une réservation attribuée au mauvais jour.
 */
process.env.TZ = "UTC";

/**
 * Les tests unitaires portent sur du domaine pur et n'ont pas à disposer
 * d'une configuration complète.
 */
process.env.SKIP_ENV_VALIDATION = "1";
