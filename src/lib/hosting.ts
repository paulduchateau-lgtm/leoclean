/**
 * Répartition des chemins entre les deux domaines de production.
 *
 * `leoclean.fr` porte la vitrine — ce qui se référence, se partage et se cite.
 * `app.leoclean.fr` porte ce qui se fait une fois décidé : le tunnel, la
 * connexion et les espaces connectés.
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

/**
 * Chemins appartenant à l'application.
 *
 * `/api/auth` en fait partie : Auth.js y dépose et y relit son cookie de
 * session, qui est lié à l'hôte. Le renvoyer sur la vitrine reviendrait à
 * créer la session sur un domaine qui ne s'en sert jamais.
 */
const APP_PREFIXES = [
  "/reserver",
  "/connexion",
  "/mon-compte",
  "/mon-espace",
  "/intervenant",
  "/gestion",
  "/administration",
  "/api/auth",
] as const;

export function isAppPath(pathname: string): boolean {
  return APP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
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
export function canonicalHost(
  hosts: { site: string | null; app: string | null },
  requestHost: string,
  pathname: string,
): string | null {
  const { site, app } = hosts;
  if (!site || !app || site === app) {
    return null;
  }

  if (requestHost === site && isAppPath(pathname)) {
    return app;
  }
  if (requestHost === app && !isAppPath(pathname)) {
    return site;
  }
  return null;
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
 * La règle est donc : on n'indexe que l'hôte qu'on a déclaré. Elle ne
 * s'applique qu'une fois l'origine canonique configurée — sans elle, on ne sait
 * pas ce qui est canonique, et refuser l'indexation par défaut mettrait tout le
 * site hors de l'index sur un oubli de variable.
 */
export function isIndexableHost(
  hosts: { site: string | null; app: string | null },
  requestHost: string,
): boolean {
  const { site, app } = hosts;
  if (!site) return true;
  return requestHost === site || requestHost === app;
}
