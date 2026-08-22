/**
 * Répartition des chemins entre les trois domaines de production.
 *
 * `leoclean.fr` porte la vitrine client — ce qui se référence, se partage et
 * se cite. `app.leoclean.fr` porte ce que le client fait une fois décidé : le
 * tunnel et son espace. `pro.leoclean.fr` porte toute la face offre, vitrine
 * comprise : la page qui explique le métier, le tunnel de candidature et
 * l'espace intervenant.
 *
 * **La connexion n'appartient à aucun des trois**, et c'est ce qui rend le
 * cloisonnement réel. `/connexion` et `/api/auth` sont servis par l'hôte qui
 * les reçoit, jamais redirigés : Auth.js tourne en `trustHost` et construit
 * ses URL depuis la requête, si bien qu'une connexion ouverte sur `pro.` y
 * dépose un cookie qui n'est **pas** envoyé à `app.` — deux sessions, deux
 * périmètres. L'alternative aurait été d'élargir le cookie à `.leoclean.fr`,
 * c'est-à-dire de faire exactement l'inverse de ce que « cloisonner » veut
 * dire.
 *
 * La séparation est tenue par une redirection plutôt que par des liens
 * absolus. C'est délibéré : un lien relatif oublié quelque part atterrit de
 * toute façon au bon endroit, alors qu'une liste de liens absolus à maintenir
 * finit toujours par en laisser un derrière. Le coût est une redirection sur
 * le chemin de conversion — un 308 servi en périphérie, sans requête serveur.
 *
 * Ce module est pur : il ne connaît ni Next ni les en-têtes. C'est ce qui
 * permet de vérifier la table de routage sans monter une requête.
 */

function matches(prefixes: readonly string[], pathname: string): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Chemins servis par l'hôte qui les reçoit, quel qu'il soit.
 *
 * Auth.js y dépose et y relit son cookie de session, qui est lié à l'hôte.
 * Les rediriger vers un hôte unique créerait la session sur un domaine, et la
 * relirait depuis un autre qui ne la reçoit jamais. Les laisser neutres donne
 * à chaque face sa propre session — ce qui est le cloisonnement demandé, et
 * non un contournement.
 */
const NEUTRAL_PREFIXES = [
  "/connexion",
  "/api/auth",
  /*
   * Le détour par le mot de passe suit le lien magique, donc l'hôte qui l'a
   * servi. Le rediriger ailleurs enverrait la personne sur un domaine où son
   * cookie de session n'existe pas — elle se retrouverait déconnectée à la
   * seconde où elle vient de prouver qui elle est.
   */
  "/definir-mot-de-passe",
] as const;

/** Ces chemins sont servis partout : ils ne se redirigent jamais. */
export function isNeutralPath(pathname: string): boolean {
  return matches(NEUTRAL_PREFIXES, pathname);
}

/** Chemins appartenant à l'application client. */
const APP_PREFIXES = [
  "/reserver",
  "/mon-compte",
  "/mon-espace",
  "/gestion",
  "/administration",
] as const;

/**
 * Chemins appartenant à la face professionnelle.
 *
 * Elle prend la vitrine offre **et** l'espace connecté. `/intervenant` quitte
 * donc l'application client, où il ne tenait que par défaut d'un troisième
 * domaine.
 */
const PRO_PREFIXES = [
  "/travailler-avec-nous",
  "/rejoindre",
  "/intervenant",
] as const;

/**
 * Ce chemin est-il un espace applicatif ?
 *
 * Sert à décider où la coque mobile n'a rien à faire — barre d'onglets, rappel
 * de prix. La question n'est pas celle de l'hôte : `/intervenant` est servi
 * par `pro.` et reste un espace connecté, où un seul modèle de navigation doit
 * régner. `/connexion` en fait partie pour la même raison.
 */
export function isAppPath(pathname: string): boolean {
  return (
    matches(APP_PREFIXES, pathname) ||
    matches(NEUTRAL_PREFIXES, pathname) ||
    matches(["/intervenant"], pathname)
  );
}

/** Ce chemin appartient-il à la face professionnelle ? */
export function isProPath(pathname: string): boolean {
  return matches(PRO_PREFIXES, pathname);
}

/** Hôte d'une origine configurée, ou `null` si elle est absente ou illisible. */
export function hostOf(origin: string | undefined): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).host;
  } catch {
    // Une origine mal formée ne doit pas empêcher le site de répondre : on
    // renonce simplement à router par hôte.
    return null;
  }
}

/**
 * Hôte où cette requête devrait être servie, ou `null` si elle y est déjà.
 *
 * Renvoie `null` dès que le contexte n'est pas celui de la production : un
 * seul domaine configuré, une origine manquante, ou un hôte inconnu — une URL
 * de prévisualisation, `localhost`, la vitrine statique. Dans tous ces cas le
 * site se comporte comme avant, sur un domaine unique.
 */
export interface Hotes {
  site: string | null;
  app: string | null;
  /** `null` tant que `pro.leoclean.fr` n'est pas créé : la face pro reste alors répartie comme avant. */
  pro?: string | null;
}

/**
 * Hôte auquel ce chemin appartient, ou `null` si la répartition n'a pas lieu.
 *
 * **Le repli quand `pro` n'est pas configuré est la partie qui compte.** Le
 * sous-domaine n'existe qu'une fois créé chez le registrar et attaché au
 * projet ; d'ici là, router vers lui produirait un 308 vers un domaine
 * introuvable — la panne exacte déjà vécue en production sur
 * `NEXT_PUBLIC_APP_URL`. Sans `pro`, chaque chemin de la face pro retourne
 * donc là où il vivait la veille : l'espace intervenant sur l'application, la
 * vitrine offre sur la vitrine.
 */
function hoteDe(pathname: string, hosts: Hotes): string | null {
  const { site, app, pro = null } = hosts;

  if (isNeutralPath(pathname)) return null;

  if (isProPath(pathname)) {
    if (pro) return pro;
    return isAppPath(pathname) ? app : site;
  }
  if (isAppPath(pathname)) return app;
  return site;
}

export function canonicalHost(
  hosts: Hotes,
  requestHost: string,
  pathname: string,
): string | null {
  const { site, app } = hosts;
  if (!site || !app || site === app) {
    return null;
  }

  const connus = [site, app, hosts.pro ?? null].filter(
    (host): host is string => host !== null,
  );
  // Un hôte inconnu — prévisualisation, `localhost`, `*.vercel.app` — n'est
  // jamais redirigé : on ne sait pas ce qu'il sert, et le renvoyer ailleurs
  // rendrait une prévisualisation inutilisable.
  if (!connus.includes(requestHost)) return null;

  const destination = hoteDe(pathname, hosts);
  if (!destination || destination === requestHost) return null;
  return destination;
}

/** Environnement déclaré du déploiement, par `NEXT_PUBLIC_ENVIRONMENT`. */
export type Environnement = "production" | "dev";

export interface ContexteIndexation {
  environnement: Environnement;
  site: string | null;
  app: string | null;
  /** `null` tant que le sous-domaine professionnel n'existe pas. */
  pro?: string | null;
}

/**
 * Cet hôte a-t-il le droit d'être indexé ?
 *
 * Un déploiement Vercel répond sur son `*.vercel.app` en plus du domaine
 * acheté. Les deux servent le même contenu mot pour mot : laissés indexables,
 * ils se font concurrence sur les requêtes mêmes que le site cherche à gagner,
 * et c'est le domaine sans notoriété qui absorbe une partie des liens. Il en va
 * de même des URL de prévisualisation, publiques et devinables.
 *
 * Deux conditions, dans cet ordre.
 *
 * **L'environnement d'abord.** Un environnement de test n'est jamais
 * indexable, quel que soit son hôte — y compris quand cet hôte est sa propre
 * origine canonique. C'est le cas qui a motivé la déclaration : le jour où la
 * dev reçoit `dev.leoclean.fr` et déclare cette origine, la comparaison des
 * noms de domaine l'autorise, et l'on obtient dans l'index un double intégral
 * du site, rédigé pour se classer sur les mêmes requêtes. Aucun nom d'hôte ne
 * peut fermer cette porte ; une déclaration le peut.
 *
 * **L'hôte ensuite.** On n'indexe que celui qu'on a déclaré. Cette seconde
 * règle ne s'applique qu'une fois l'origine canonique configurée — sans elle,
 * on ne sait pas ce qui est canonique, et refuser l'indexation par défaut
 * mettrait tout le site hors de l'index sur un oubli de variable.
 */
export function isIndexableHost(
  contexte: ContexteIndexation,
  requestHost: string,
): boolean {
  if (contexte.environnement !== "production") return false;

  const { site, app, pro = null } = contexte;
  if (!site) return true;
  return requestHost === site || requestHost === app || requestHost === pro;
}
