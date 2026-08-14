/**
 * Génération des codes de parrainage.
 *
 * Un code se lit à voix haute, se recopie sans erreur et se retient : il
 * circule autant par SMS que de vive voix. L'alphabet exclut donc les
 * caractères qui se confondent — 0 et O, 1 et I et L, 2 et Z, 5 et S, 8 et B —
 * ce qui élimine la principale cause de code « invalide » signalée par les
 * utilisateurs.
 */

/** Alphabet sans ambiguïté visuelle ni phonétique. */
const ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";

const CODE_LENGTH = 6;

/**
 * Codes à ne jamais produire.
 *
 * Un code de parrainage s'affiche sur un site public et se prononce au
 * téléphone : il ne doit pas former de mot malheureux.
 */
const FORBIDDEN = new Set(["PUTAIN", "MERDE", "CONNE", "SALOPE", "NAZI"]);

export interface CodeOptions {
  /** Source d'aléa, injectable pour rendre les tests déterministes. */
  random?: () => number;
  /** Préfixe lisible, par exemple les initiales du parrain. */
  prefix?: string;
}

/**
 * Produit un code aléatoire.
 *
 * L'unicité n'est pas garantie ici : elle est assurée par une contrainte
 * d'unicité en base, l'appelant réessayant en cas de collision. Avec 25
 * caractères sur 6 positions, l'espace compte 244 millions de combinaisons —
 * les collisions restent rarissimes bien au-delà de la taille du projet.
 */
export function generateReferralCode(options: CodeOptions = {}): string {
  const random = options.random ?? Math.random;
  const prefix = (options.prefix ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);

  const length = Math.max(CODE_LENGTH - prefix.length, 4);

  let attempt = "";
  do {
    attempt = "";
    for (let i = 0; i < length; i += 1) {
      const index = Math.floor(random() * ALPHABET.length);
      attempt += ALPHABET[index] ?? ALPHABET[0];
    }
  } while (FORBIDDEN.has(prefix + attempt));

  return prefix + attempt;
}

/**
 * Normalise un code saisi par un humain.
 *
 * On se contente de passer en majuscules et d'ôter les séparateurs. On ne
 * tente **pas** de rattraper une confusion de caractères — remplacer un « O »
 * par un « Q » au motif qu'ils se ressemblent transformerait un code erroné en
 * un autre code parfaitement valide, et attribuerait le parrainage à un tiers.
 *
 * C'est précisément pour n'avoir jamais à faire cette substitution que
 * l'alphabet exclut les caractères ambigus dès la génération.
 */
export function normalizeReferralCode(input: string): string {
  return input.toUpperCase().replace(/[\s\-_.]/g, "");
}

/** Le code a-t-il la forme attendue ? */
export function isWellFormedCode(code: string): boolean {
  return new RegExp(`^[${ALPHABET}]{4,9}$`).test(code);
}
