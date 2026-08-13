import { Prisma } from "@prisma/client";
import { afterAll, beforeEach } from "vitest";

import { prisma } from "@/lib/db";

process.env.TZ = "UTC";

/** Tables physiques du schéma, dérivées du DMMF pour ne rien oublier. */
const TABLES = Prisma.dmmf.datamodel.models.map((model) => `"${model.name}"`);

/**
 * Chaque test part d'une base vide.
 *
 * `TRUNCATE ... CASCADE` en une seule instruction traite les dépendances
 * circulaires entre tables sans avoir à ordonner les suppressions.
 * `RESTART IDENTITY` remet les séquences à zéro pour que les tests portant sur
 * la numérotation des factures soient reproductibles.
 */
beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
