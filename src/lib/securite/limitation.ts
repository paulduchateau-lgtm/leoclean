import "server-only";

import { createHash } from "node:crypto";

import { BusinessError } from "@/lib/booking/errors";
import { prisma } from "@/lib/db";

/**
 * Limitation de débit des formulaires publics.
 *
 * Le site prend des réservations sans compte : ses formulaires sont ouverts à
 * tout le monde, et c'est voulu — exiger une inscription pour obtenir un prix
 * est le meilleur moyen de perdre un client. La contrepartie est qu'ils sont
 * la surface la plus exposée du produit, et que le champ piège et le délai de
 * trois secondes n'arrêtent qu'un robot naïf.
 *
 * Trois choix, tous conséquents :
 *
 * - **Le compteur est en base.** La même raison que pour l'envoi des liens de
 *   connexion : un déploiement sans serveur n'a pas de mémoire partagée, et un
 *   compteur par instance laisse passer autant de requêtes qu'il y a
 *   d'instances.
 * - **L'adresse IP n'est jamais stockée en clair.** C'est une donnée
 *   personnelle ; un compteur n'a pas besoin de savoir qui, seulement combien.
 *   On en garde un condensat salé par `AUTH_SECRET`, inutilisable ailleurs.
 * - **Fenêtre fixe, pas glissante.** Une fenêtre glissante exigerait une ligne
 *   par requête. Une fenêtre fixe laisse passer une pointe à cheval sur deux
 *   fenêtres ; c'est acceptable pour arrêter un abus, qui dure.
 */

export interface Quota {
  /** Nombre d'appels tolérés dans la fenêtre. */
  max: number;
  fenetreMs: number;
}

/** Quotas retenus, par action. */
export const QUOTAS = {
  /** Une demande de rappel par minute, dix par heure : personne n'en dépose plus. */
  rappel: { max: 10, fenetreMs: 3_600_000 },
  /** Réserver reste rare ; au-delà, c'est un script. */
  reservation: { max: 5, fenetreMs: 3_600_000 },
  /**
   * La recherche de créneaux interroge le moteur sur trois semaines : c'est
   * l'appel le plus coûteux du site, et le plus tentant à marteler.
   */
  creneaux: { max: 60, fenetreMs: 3_600_000 },
  /** Envoi de liens de connexion, par source et non plus seulement par adresse. */
  connexion: { max: 15, fenetreMs: 3_600_000 },
  /**
   * Tentatives de connexion par mot de passe.
   *
   * **Le quota le plus serré du module**, et pour une raison différente des
   * autres : ceux-là protègent d'un abus de service, celui-ci protège d'une
   * attaque par force brute. Dix essais par heure et par source ramènent un
   * bourrage d'identifiants à une vitesse inutile, sans gêner quelqu'un qui
   * cherche lequel de ses trois mots de passe habituels est le bon.
   *
   * Il porte sur la **source** et non sur l'adresse visée : compter par compte
   * laisserait un attaquant essayer le même mot de passe sur mille comptes,
   * ce qui est la forme la plus rentable de l'attaque.
   */
  "connexion-mot-de-passe": { max: 10, fenetreMs: 3_600_000 },
  /**
   * Candidature d'intervenant.
   *
   * Plus rare encore qu'une demande de rappel : on ne postule pas trois fois
   * dans la même heure. Le quota est distinct de `rappel` pour qu'un robot qui
   * martèle un formulaire ne ferme pas l'autre.
   */
  candidature: { max: 5, fenetreMs: 3_600_000 },
} as const satisfies Record<string, Quota>;

export type Action = keyof typeof QUOTAS;

export interface Verdict {
  autorise: boolean;
  /** Appels restants dans la fenêtre courante. */
  restants: number;
}

/**
 * Condensat d'une source.
 *
 * Salé par `AUTH_SECRET` : sans sel, l'espace des adresses IPv4 est assez
 * petit pour être parcouru en entier, et le condensat redeviendrait l'adresse.
 */
export function empreinteSource(source: string): string {
  const sel = process.env.AUTH_SECRET ?? "";
  return createHash("sha256")
    .update(`${sel}:${source}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Consomme un jeton et dit si l'appel est autorisé.
 *
 * Tout tient dans une seule instruction SQL, et ce n'est pas une optimisation :
 * lire le compteur puis l'incrémenter en deux temps laisse deux requêtes
 * simultanées lire la même valeur et écrire la même. Or l'abus qu'on cherche à
 * arrêter est concurrent par nature — c'est précisément là que la limitation
 * doit tenir.
 *
 * `ON CONFLICT` remet le compteur à un quand la fenêtre stockée est plus
 * ancienne que la fenêtre courante, et l'incrémente sinon. La base arbitre,
 * comme elle arbitre déjà le verrou anti-double-réservation.
 *
 * La requête est brute parce qu'aucune API de client ne sait exprimer un
 * incrément conditionnel en une fois. `RateLimit` n'étant pas cloisonné, elle
 * n'a pas de filtre d'organisation à porter.
 */
export async function consommer(
  action: Action,
  source: string,
  maintenant: Date = new Date(),
): Promise<Verdict> {
  const quota = QUOTAS[action];
  const cle = `${action}:${empreinteSource(source)}`;
  const debutFenetre = new Date(
    Math.floor(maintenant.getTime() / quota.fenetreMs) * quota.fenetreMs,
  );

  const lignes = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("id", "key", "count", "windowAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${cle}, 1, ${debutFenetre}, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowAt" < EXCLUDED."windowAt" THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "windowAt" = GREATEST("RateLimit"."windowAt", EXCLUDED."windowAt"),
      "updatedAt" = NOW()
    RETURNING "count"
  `;

  const compte = Number(lignes[0]?.count ?? 1);
  return {
    autorise: compte <= quota.max,
    restants: Math.max(0, quota.max - compte),
  };
}

/**
 * Purge les fenêtres périmées.
 *
 * À appeler depuis un travail planifié : sans elle, la table grossit d'une
 * ligne par source et par action, indéfiniment.
 */
export async function purger(maintenant: Date = new Date()): Promise<number> {
  const plusAncienneFenetre = Math.max(
    ...Object.values(QUOTAS).map((quota) => quota.fenetreMs),
  );
  const resultat = await prisma.rateLimit.deleteMany({
    where: {
      windowAt: {
        lt: new Date(maintenant.getTime() - 2 * plusAncienneFenetre),
      },
    },
  });
  return resultat.count;
}

/**
 * Source de la requête courante.
 *
 * Derrière un proxy — et il y en a toujours un en production — l'adresse du
 * client est dans `x-forwarded-for`, dont on ne retient que le premier saut :
 * les suivants sont les proxys eux-mêmes, et un appelant peut en ajouter.
 *
 * Sans en-tête, on rend une valeur commune. Elle rassemble alors tout le monde
 * dans le même seau, ce qui est le comportement prudent : mieux vaut limiter
 * trop que pas du tout, et le cas ne se produit qu'en développement.
 */
export async function sourceDeLaRequete(): Promise<string> {
  const { headers } = await import("next/headers");
  const entetes = await headers();
  const transmise = entetes.get("x-forwarded-for");
  return transmise?.split(",")[0]?.trim() || "source-inconnue";
}

/** Erreur métier levée quand le quota est dépassé. */
export class TropDeRequetesError extends BusinessError {
  constructor() {
    super(
      "Trop de tentatives depuis quelques minutes. Réessayez dans un moment, " +
        "ou appelez-nous : nous répondons.",
    );
  }
}

/**
 * Consomme un jeton pour la requête courante, ou lève.
 *
 * Le refus est une erreur métier, pas un incident : il s'affiche tel quel dans
 * le formulaire, avec le téléphone en recours — quelqu'un de légitime pris
 * dans la limitation doit pouvoir aboutir autrement.
 */
export async function exigerQuota(action: Action): Promise<void> {
  const verdict = await consommer(action, await sourceDeLaRequete());
  if (!verdict.autorise) {
    throw new TropDeRequetesError();
  }
}
