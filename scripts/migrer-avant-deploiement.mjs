import { execFileSync } from "node:child_process";

/**
 * Migration jouée avant la construction du déploiement.
 *
 * Vercel construit sans jamais migrer : le code part en ligne en attendant des
 * colonnes que la base n'a pas encore. Tant que les migrations restaient un
 * geste manuel, l'écart n'a tenu qu'à la mémoire de celui qui déployait.
 *
 * **La migration ne passe jamais par le pooler transactionnel.** C'est la
 * raison d'être de ce fichier, et elle s'est payée : `prisma migrate` lancé
 * sur le port 6543 de Supabase ne renvoie rien, n'échoue pas, et ne rend pas
 * la main — le moteur de migration attend un verrou que pgbouncer, qui
 * recycle les connexions à chaque transaction, ne lui accordera jamais. Sur un
 * poste on l'interrompt ; dans une construction Vercel, cela consomme le délai
 * maximal avant d'abandonner sans rien dire d'utile.
 *
 * On migre donc par `DIRECT_URL` — le pooler en mode session, port 5432, qui
 * garde la connexion ouverte le temps du verrou. Et si l'URL retenue porte
 * malgré tout les marques du mode transactionnel, on refuse tout de suite : un
 * échec immédiat et nommé vaut mieux qu'un blocage muet de trois quarts
 * d'heure.
 */

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error(
    "Aucune URL de base de données. Renseigner DATABASE_URL, et DIRECT_URL " +
      "si la base est derrière un pooler.",
  );
  process.exit(1);
}

const transactionnel = url.includes("pgbouncer=true") || url.includes(":6543");

if (transactionnel) {
  console.error(
    "Cette URL désigne un pooler en mode transaction : la migration s'y\n" +
      "bloquerait indéfiniment sur son verrou, sans message.\n\n" +
      "Renseigner DIRECT_URL avec le pooler en mode session — même hôte,\n" +
      "port 5432, sans `pgbouncer=true`. DATABASE_URL peut rester en 6543 :\n" +
      "elle est la bonne connexion pour l'application, pas pour la migration.",
  );
  process.exit(1);
}

console.log(`Migration de la base sur ${url.replace(/\/\/[^@]*@/, "//***@")}`);

execFileSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
