import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";

/**
 * La seconde porte.
 *
 * Le cloisonnement multi-tenant de ce dépôt vit dans une extension Prisma, et
 * il ne protège que ce qui passe par l'application. Supabase en ouvre une
 * autre : PostgREST, atteignable avec la clé anonyme — laquelle est publique
 * par construction, puisqu'elle est destinée à être livrée dans un navigateur.
 * Supabase accorde par défaut `ALL` aux rôles `anon` et `authenticated` sur
 * toute table nouvellement créée du schéma `public`, et les tables engendrées
 * par `prisma migrate` en héritent silencieusement.
 *
 * **Une table sans RLS est donc une table lisible par tout le monde**, sans
 * qu'aucune ligne de code du dépôt ne s'en aperçoive. Ce test est le seul
 * endroit où l'oubli se voit : `prisma migrate` n'active pas la RLS sur les
 * tables qu'il crée, et rien d'autre ne le signalerait.
 *
 * Il ne s'exécute que sur PostgreSQL, donc dans la suite d'intégration.
 */

/**
 * Tables exemptées, avec leur raison.
 *
 * Chacune doit être justifiée ici, comme `GLOBAL_MODELS` l'exige pour le
 * cloisonnement : une exemption qu'on ne sait pas expliquer est une faille
 * qu'on a oublié de refermer.
 */
const EXEMPTEES: Readonly<Record<string, string>> = {
  _prisma_migrations:
    "Table de Prisma, non exposée par PostgREST ; la verrouiller gênerait les migrations sans rien protéger.",
  spatial_ref_sys:
    "Table système de PostGIS : référentiel de projections publiques, nécessaire au fonctionnement de l'extension.",
};

describe("accès API", () => {
  it("toute table du schéma public porte la RLS", async () => {
    const tables = await prisma.$queryRawUnsafe<
      { relname: string; relrowsecurity: boolean }[]
    >(
      `SELECT c.relname, c.relrowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY 1`,
    );

    expect(tables.length).toBeGreaterThan(30);

    const decouvertes = tables
      .filter((table) => !table.relrowsecurity && !(table.relname in EXEMPTEES))
      .map((table) => table.relname);

    /*
     * Le message porte le remède : quelqu'un qui ajoute une table doit savoir
     * en une lecture ce qu'il manque, sans avoir à retrouver la migration
     * d'origine.
     */
    expect(
      decouvertes,
      `Tables sans RLS : ${decouvertes.join(", ")}. Ajoutez à votre migration ` +
        `ALTER TABLE "<Table>" ENABLE ROW LEVEL SECURITY; — sans cela, la clé ` +
        `anonyme de Supabase les lit intégralement.`,
    ).toEqual([]);
  });

  it("aucune politique n'ouvre une table à un rôle Supabase", async () => {
    /*
     * RLS activée sans politique = refus par défaut. Une politique ajoutée par
     * mégarde — depuis l'interface Supabase, par exemple — rouvrirait la porte
     * en silence. On n'en attend aucune : le produit n'utilise pas la RLS pour
     * son propre cloisonnement.
     */
    const politiques = await prisma.$queryRawUnsafe<
      { tablename: string; policyname: string }[]
    >(
      `SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'`,
    );

    expect(politiques).toEqual([]);
  });
});
