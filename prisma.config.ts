import path from "node:path";

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: path.join(import.meta.dirname, "prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
    // `prisma migrate` exige une connexion directe : les poolers de Neon et
    // Supabase ne supportent pas les instructions DDL. En local, où l'on
    // attaque Postgres sans pooler, la variable est absente.
    ...(process.env.DIRECT_URL ? { directUrl: env("DIRECT_URL") } : {}),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
