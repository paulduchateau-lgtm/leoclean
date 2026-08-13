import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

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

export const config = {
  matcher: [
    "/mon-compte/:path*",
    "/intervenant/:path*",
    "/gestion/:path*",
    "/administration/:path*",
  ],
};
