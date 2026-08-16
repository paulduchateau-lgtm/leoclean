import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

import { ensureSocle } from "./socle";

/**
 * Installation d'une base de production.
 *
 * Crée l'organisation marketplace, son catalogue et ses tarifs — rien d'autre.
 * Aucun intervenant, aucun client, aucune réservation : une base de production
 * qui contiendrait douze intervenants fictifs proposerait de vrais créneaux
 * tenus par des gens qui n'existent pas, et un client pourrait réserver l'un
 * d'eux.
 *
 * Elle ne détruit rien et se relance sans dommage, contrairement à
 * `prisma/seed.ts` qui commence par tronquer toutes les tables et n'a sa place
 * que sur une base jetable.
 *
 * Tant qu'aucun intervenant n'est enregistré, le tunnel se comporte
 * correctement : il ne propose aucun créneau et affiche le numéro de
 * téléphone. C'est l'état honnête d'un service qui n'a pas encore recruté.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL est absente : impossible d'installer la base.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main(): Promise<void> {
  const hote = new URL(connectionString!).host;
  console.log(`Installation du socle sur ${hote}…\n`);

  const result = await ensureSocle(prisma);

  console.log(`Organisation marketplace : ${result.organizationId}`);
  console.log(
    `Prestations : ${result.servicesCreated} créée(s), ${result.servicesExistants} déjà présente(s)`,
  );
  console.log(`Tarifs : ${result.tarifsCreated} créé(s)`);
  console.log("\nTerminé. Aucune donnée existante n'a été modifiée.");
}

main()
  .catch((error: unknown) => {
    console.error("Installation interrompue :", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
