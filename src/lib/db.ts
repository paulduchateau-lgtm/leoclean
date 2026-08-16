import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Accès aux données et cloisonnement multi-tenant.
 *
 * Le principe : personne n'écrit `where: { organizationId }` à la main. On
 * obtient un client déjà cloisonné via `forOrganization(id)` et toute requête
 * qu'il émet est filtrée, y compris celles qu'on aurait oublié de filtrer.
 *
 * La liste des modèles concernés est dérivée du DMMF — tout modèle possédant un
 * champ `organizationId` est cloisonné. Ajouter un modèle métier au schéma
 * suffit donc à le protéger ; en oublier le champ fait échouer le test
 * `db.test.ts`, qui énumère les modèles et exige une justification
 * explicite pour chaque exception.
 */

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL n'est pas configurée : impossible d'ouvrir une connexion.",
    );
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/**
 * En développement, Next.js recharge les modules à chaud ; sans ce cache global
 * chaque rechargement ouvrirait un nouveau pool de connexions jusqu'à saturer
 * Postgres.
 */
const globalForPrisma = globalThis as unknown as {
  leocleanPrisma?: PrismaClient;
};

function getClient(): PrismaClient {
  if (!globalForPrisma.leocleanPrisma) {
    globalForPrisma.leocleanPrisma = createClient();
  }
  return globalForPrisma.leocleanPrisma;
}

/**
 * Client non cloisonné.
 *
 * Réservé à trois usages : l'authentification (qui manipule User, Account et
 * Session, hors périmètre tenant), l'administration plateforme sur un chemin
 * explicite et journalisé, et les scripts de maintenance. Toute lecture de
 * donnée métier depuis une requête utilisateur passe par `forOrganization`.
 *
 * La connexion est ouverte au premier accès et non à l'import : les pages
 * statiques et les tests unitaires importent ce module sans avoir besoin d'une
 * base joignable.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    return Reflect.get(getClient(), property, receiver);
  },
});

/** Modèles cloisonnés : ceux qui portent un `organizationId`. */
export const TENANT_MODELS: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((f) => f.name === "organizationId"))
    .map((model) => model.name),
);

/**
 * Modèles volontairement hors périmètre, avec la raison de l'exception.
 *
 * Cette table est lue par le test de cloisonnement : un modèle qui n'a pas
 * d'`organizationId` et ne figure pas ici fait échouer la suite. C'est ce qui
 * empêche d'introduire une fuite par simple oubli.
 */
export const GLOBAL_MODELS: Readonly<Record<string, string>> = {
  Organization: "La table des organisations elle-même.",
  User: "Identité globale : une personne peut appartenir à plusieurs organisations.",
  Account:
    "Table Auth.js, rattachée à l'utilisateur et non à une organisation.",
  Session: "Table Auth.js.",
  VerificationToken: "Table Auth.js.",
  TravelTimeCache:
    "Un temps de trajet entre deux points est un fait géographique, pas une donnée d'organisation. Le mutualiser est ce qui rend le cache efficace.",
  WebhookEvent:
    "Journal d'idempotence des webhooks : l'organisation n'est connue qu'après analyse du contenu.",
  RateLimit:
    "Compteur de limitation de débit : il protège des formulaires publics, qui sont par définition antérieurs à toute organisation.",
};

/** Opérations dont l'argument `where` doit être restreint à l'organisation. */
const WHERE_SCOPED_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
]);

type OperationArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
};

/**
 * Client Prisma restreint à une organisation.
 *
 * Toute lecture est filtrée sur `organizationId` et toute création le
 * renseigne. Le filtre est ajouté après les conditions de l'appelant : une
 * requête qui tenterait de viser une autre organisation ne renvoie rien plutôt
 * que de lever, ce qui évite de révéler l'existence de la ressource visée.
 *
 * Limites connues, documentées plutôt que masquées :
 *
 * - Les écritures imbriquées (`create: { items: { create: [...] } }`) ne sont
 *   pas réécrites. Ce n'est pas une faille : `organizationId` est NOT NULL en
 *   base, donc l'oubli échoue bruyamment au lieu de créer une ligne orpheline.
 * - `$queryRaw` contourne l'extension par construction. Toute requête brute sur
 *   une table cloisonnée doit porter son propre filtre.
 */
export function forOrganization(organizationId: string) {
  if (!organizationId) {
    throw new Error(
      "forOrganization a été appelé sans identifiant d'organisation.",
    );
  }

  return prisma.$extends({
    name: "tenant-scoping",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) {
            return query(args);
          }

          const scoped = args as OperationArgs;

          if (WHERE_SCOPED_OPERATIONS.has(operation)) {
            // Prisma accepte des filtres non uniques en complément d'un champ
            // unique depuis la version 5, ce qui permet de restreindre
            // `update` et `delete` sans perdre leur atomicité.
            scoped.where = { ...(scoped.where ?? {}), organizationId };
          }

          if (operation === "create") {
            scoped.data = { ...(scoped.data as object), organizationId };
          }

          if (
            operation === "createMany" ||
            operation === "createManyAndReturn"
          ) {
            const rows = scoped.data;
            scoped.data = Array.isArray(rows)
              ? rows.map((row) => ({ ...row, organizationId }))
              : { ...(rows as object), organizationId };
          }

          if (operation === "upsert") {
            scoped.where = { ...(scoped.where ?? {}), organizationId };
            scoped.create = { ...(scoped.create ?? {}), organizationId };
          }

          return query(scoped);
        },
      },
    },
  });
}

/** Type du client cloisonné, à utiliser dans les signatures de fonctions. */
export type TenantClient = ReturnType<typeof forOrganization>;
