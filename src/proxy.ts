import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { canonicalHost, hostOf, isIndexableHost } from "@/lib/hosting";

/**
 * Redirection optimiste des espaces connectés.
 *
 * Ce fichier ne fait **pas** d'autorisation. Il constate l'absence de cookie de
 * session et évite un aller-retour inutile jusqu'à une page qui redirigerait de
 * toute façon. La véritable vérification — session valide, appartenance à
 * l'organisation, capacité suffisante — a lieu dans les composants serveur et
 * les server actions, au contact des données.
 *
 * Ce partage est délibéré. Un contrôle situé ici travaille sur la seule
 * présence d'un cookie, sans savoir s'il est valide, ni à qui il appartient, ni
 * ce que cette personne a le droit de voir. S'y fier comme frontière de
 * sécurité est un classique des fuites de données.
 */

/** Espaces exigeant une session, du plus général au plus spécifique. */
const PROTECTED_PREFIXES = [
  "/mon-compte",
  "/mon-espace",
  "/intervenant",
  "/gestion",
  "/administration",
];

/**
 * Auth.js préfixe le cookie de session en HTTPS. On accepte les deux noms
 * plutôt que de déduire le contexte du protocole, qui est masqué derrière les
 * proxys de déploiement.
 */
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

/**
 * Origines de production, figées à la construction.
 *
 * Les variables `NEXT_PUBLIC_*` sont remplacées littéralement au build : elles
 * sont donc lisibles ici, où `process.env` n'est pas celui d'un serveur Node.
 */
const HOSTS = {
  site: hostOf(process.env.NEXT_PUBLIC_SITE_URL),
  app: hostOf(process.env.NEXT_PUBLIC_APP_URL),
  pro: hostOf(process.env.NEXT_PUBLIC_PRO_URL),
};

/**
 * Contexte d'indexation, hôtes et environnement déclaré réunis.
 *
 * Tout ce qui n'est pas explicitement `dev` est tenu pour la production : la
 * valeur par défaut du schéma Zod est la même, et un oubli de variable ne doit
 * pas mettre le site entier hors de l'index.
 */
const CONTEXTE_INDEXATION = {
  environnement:
    process.env.NEXT_PUBLIC_ENVIRONMENT === "dev"
      ? ("dev" as const)
      : ("production" as const),
  ...HOSTS,
};

export function proxy(request: NextRequest): NextResponse {
  const requestHost = request.headers.get("host") ?? "";
  return withIndexingPolicy(route(request), requestHost);
}

/**
 * Refuse l'indexation à tout hôte qui n'est pas un domaine de production.
 *
 * L'en-tête plutôt que la balise : il couvre `robots.txt`, `sitemap.xml`, les
 * cartes de partage et les redirections, qui n'ont pas de `<head>` où poser une
 * méta. `noindex` seul, sans `nofollow` : les liens partant d'une
 * prévisualisation pointent vers elle-même, et les faire suivre coûte moins que
 * de les faire ignorer.
 */
function withIndexingPolicy(
  response: NextResponse,
  requestHost: string,
): NextResponse {
  if (!isIndexableHost(CONTEXTE_INDEXATION, requestHost)) {
    response.headers.set("X-Robots-Tag", "noindex");
  }
  return response;
}

function route(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  /*
   * Chaque chemin est servi par un seul des trois domaines : la vitrine
   * porte ce qui se référence côté client, l'application ce que le client
   * fait, la face pro tout ce qui s'adresse aux intervenants. Seules la
   * connexion et les routes d'Auth.js sont servies partout — c'est ce qui
   * donne à chaque face sa propre session. La redirection est
   * permanente et conserve la méthode — une action de formulaire arrivée du
   * mauvais côté ne perdrait pas son corps de requête.
   */
  const destination = canonicalHost(
    HOSTS,
    request.headers.get("host") ?? "",
    pathname,
  );
  if (destination) {
    const target = new URL(request.url);
    target.host = destination;
    target.port = "";
    return NextResponse.redirect(target, 308);
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIES.some(
    (name) => request.cookies.get(name)?.value,
  );

  if (hasSession) {
    return NextResponse.next();
  }

  const signInUrl = new URL("/connexion", request.url);
  // On conserve la destination pour y ramener la personne après connexion.
  signInUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(signInUrl);
}

/**
 * Le filtre couvre désormais tout le site, et non les seuls espaces protégés :
 * la répartition entre les deux domaines doit pouvoir s'appliquer à n'importe
 * quel chemin, `robots.txt` et `sitemap.xml` compris — ils n'ont de sens que
 * sur la vitrine. Seuls les fichiers servis par le CDN sont écartés, pour
 * qu'aucune ressource statique ne paie le coût d'une évaluation.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
