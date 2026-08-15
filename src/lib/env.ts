import { z } from "zod";

import { DEFAULT_EMAIL_SENDER, isEmailSender } from "@/lib/email-sender";

/**
 * Validation des variables d'environnement au démarrage.
 *
 * Toute variable est déclarée ici, y compris celles des phases à venir.
 * Les intégrations non encore branchées sont optionnelles : le module
 * concerné appelle `requireEnv` au moment de s'en servir, ce qui produit une
 * erreur explicite plutôt qu'un `undefined` qui se propage.
 *
 * `SKIP_ENV_VALIDATION=1` désactive la validation. Réservé au `next build` en
 * CI et aux commandes de lint, jamais à l'exécution.
 */

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // --- Base de données (phase 1) -----------------------------------------
  /** Postgres avec l'extension PostGIS activée. */
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Connexion directe, sans pooler, requise par `prisma migrate`. */
  DIRECT_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),

  // --- Authentification (phase 2) ----------------------------------------
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET doit faire au moins 32 caractères"),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),

  // --- Emails transactionnels (phase 2) ----------------------------------
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  /**
   * Adresse seule, ou nom affiché suivi de l'adresse. Le schéma n'acceptait
   * jusqu'ici que la première forme — et refusait donc la valeur par défaut
   * dont `email.ts` se servait, ce qui ne se voyait qu'au démarrage.
   */
  EMAIL_FROM: z
    .string()
    .default(DEFAULT_EMAIL_SENDER)
    .refine(
      isEmailSender,
      "EMAIL_FROM doit être une adresse, éventuellement précédée d'un nom : « Léo Clean <menage@leoclean.fr> »",
    ),

  // --- Paiement (phase 7) ------------------------------------------------
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  STRIPE_CONNECT_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),

  // --- Agenda externe (phase 9) ------------------------------------------
  GOOGLE_CALENDAR_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CALENDAR_CLIENT_SECRET: z.string().min(1).optional(),
  /** URL publique recevant les notifications push Google Calendar. */
  GOOGLE_CALENDAR_WEBHOOK_URL: z.url().optional(),
  /** Secret partagé vérifiant l'origine des notifications push. */
  GOOGLE_CALENDAR_WEBHOOK_TOKEN: z.string().min(16).optional(),

  // --- Temps de trajet (phase 10) ----------------------------------------
  TRAVEL_TIME_PROVIDER: z
    .enum(["haversine", "openrouteservice", "osrm"])
    .default("haversine"),
  OPENROUTESERVICE_API_KEY: z.string().min(1).optional(),
  /** Instance OSRM auto-hébergée, ex. https://osrm.leoclean.fr */
  OSRM_BASE_URL: z.url().optional(),

  // --- Jobs asynchrones (phase 8) ----------------------------------------
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),
});

const clientSchema = z.object({
  /** Origine canonique, sans slash final. Utilisée par les canonicals, le sitemap et le JSON-LD. */
  NEXT_PUBLIC_SITE_URL: z.url().default("https://leoclean.fr"),

  /**
   * Origine de l'application — tunnel, connexion, espaces connectés.
   *
   * Distincte de la vitrine en production : `leoclean.fr` porte ce qui se
   * référence, `app.leoclean.fr` ce qui se fait. Absente, les deux vivent sur
   * le même domaine et `src/proxy.ts` ne redirige rien — c'est le cas en
   * développement, en prévisualisation et sur la vitrine statique.
   */
  NEXT_PUBLIC_APP_URL: z.url().optional(),

  /**
   * Déclaration Services à la personne (SAP) obtenue auprès de la DDETS.
   *
   * Tant qu'elle vaut `false`, aucune mention du crédit d'impôt de 50 % n'est
   * affichée : communiquer sur l'avantage fiscal sans être déclaré SAP expose
   * à une sanction. Le calcul reste effectué et stocké en base dans tous les
   * cas, seul l'affichage est conditionné.
   */
  NEXT_PUBLIC_SAP_DECLARED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),

  /**
   * Vitrine statique de démonstration.
   *
   * Le site est alors exporté en fichiers statiques, sans serveur ni base :
   * les moteurs de tarification et de disponibilité, qui sont purs, tournent
   * dans le navigateur, et rien n'est enregistré. Cette variante existe pour
   * être montrée, pas pour être utilisée.
   *
   * Elle entraîne deux conséquences non négociables, appliquées ailleurs dans
   * le code : toutes les pages sont en `noindex`, et un bandeau annonce la
   * démonstration. Un double du site indexé ferait concurrence au domaine
   * réel sur les requêtes mêmes qu'il cherche à gagner.
   */
  NEXT_PUBLIC_DEMO_STATIQUE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;

const skipValidation = process.env.SKIP_ENV_VALIDATION === "1";

function parse<T extends z.ZodType>(schema: T, source: unknown, scope: string) {
  const result = schema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map(
        (issue) =>
          `  - ${issue.path.join(".") || "(racine)"} : ${issue.message}`,
      )
      .join("\n");
    throw new Error(
      `Variables d'environnement ${scope} invalides ou manquantes :\n${details}\n` +
        `Voir .env.example pour la liste complète.`,
    );
  }
  return result.data as z.infer<T>;
}

/**
 * Les variables `NEXT_PUBLIC_*` doivent être référencées littéralement pour
 * que Next.js les inline dans le bundle client ; un accès dynamique
 * `process.env[nom]` renverrait `undefined` côté navigateur.
 */
const rawClientEnv = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SAP_DECLARED: process.env.NEXT_PUBLIC_SAP_DECLARED,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_DEMO_STATIQUE: process.env.NEXT_PUBLIC_DEMO_STATIQUE,
};

export const clientEnv: ClientEnv = skipValidation
  ? (clientSchema.partial().parse(rawClientEnv) as ClientEnv)
  : parse(clientSchema, rawClientEnv, "publiques");

const isServer = typeof window === "undefined";

/**
 * Variables serveur. L'accès depuis un composant client lève : cela évite
 * qu'un secret finisse dans le bundle par inadvertance.
 */
export const serverEnv: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, key: string) {
    if (!isServer) {
      throw new Error(
        `serverEnv.${key} a été lu côté client. Ces variables ne doivent jamais quitter le serveur.`,
      );
    }
    return loadServerEnv()[key as keyof ServerEnv];
  },
});

let cachedServerEnv: ServerEnv | undefined;

function loadServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = skipValidation
      ? (serverSchema.partial().parse(process.env) as ServerEnv)
      : parse(serverSchema, process.env, "serveur");
  }
  return cachedServerEnv;
}

/** Force la validation au démarrage du serveur (appelé par instrumentation.ts). */
export function assertServerEnv(): void {
  if (!skipValidation) {
    loadServerEnv();
  }
}

/**
 * Lit une variable optionnelle en exigeant qu'elle soit présente.
 *
 * À appeler dans le module qui consomme l'intégration, pour que l'absence de
 * configuration produise un message actionnable au lieu d'un `undefined`.
 */
export function requireEnv<K extends keyof ServerEnv>(
  key: K,
): NonNullable<ServerEnv[K]> {
  const value = loadServerEnv()[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `${String(key)} n'est pas configurée. Cette fonctionnalité ne peut pas s'exécuter sans elle.`,
    );
  }
  return value as NonNullable<ServerEnv[K]>;
}
