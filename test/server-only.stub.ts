/**
 * Remplaçant de `server-only` sous Vitest.
 *
 * Le paquet réel n'expose qu'une erreur de compilation destinée au bundler,
 * afin qu'un module serveur importé depuis un composant client échoue au
 * build. Les tests, eux, s'exécutent hors bundler et doivent pouvoir importer
 * ces modules.
 */
export {};
