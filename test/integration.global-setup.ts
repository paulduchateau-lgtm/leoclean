import { execFileSync } from "node:child_process";

/**
 * Prépare la base de test avant la suite d'intégration.
 *
 * Les migrations sont appliquées telles quelles, sans `db push` : c'est la
 * seule façon de vérifier que le SQL écrit à la main — extensions, colonne
 * générée, contrainte d'exclusion — s'applique réellement.
 */
export default function setup(): void {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "Les tests d'intégration exigent DATABASE_URL. " +
        "Créer une base jetable, par exemple : createdb leoclean_test.",
    );
  }

  /**
   * Garde-fou : la suite tronque des tables. On refuse de s'exécuter ailleurs
   * que sur une base dont le nom annonce qu'elle est jetable.
   */
  const databaseName = new URL(url).pathname.replace(/^\//, "");
  if (!/_test$/.test(databaseName)) {
    throw new Error(
      `Refus de lancer les tests d'intégration sur la base "${databaseName}" : ` +
        `son nom doit se terminer par "_test". Ces tests vident des tables.`,
    );
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
  });
}
