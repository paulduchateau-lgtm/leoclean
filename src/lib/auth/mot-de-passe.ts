import {
  type ScryptOptions,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

/**
 * Mots de passe.
 *
 * Le dépôt avait tranché pour une connexion sans mot de passe, et cette
 * décision garde sa raison : **un mot de passe qu'on n'a pas ne peut pas
 * fuir.** Le mot de passe s'ajoute donc, il ne remplace rien — il est
 * facultatif, et un compte qui n'en a pas continue de se connecter par lien.
 *
 * **Il ne se définit que depuis une session déjà ouverte**, c'est-à-dire après
 * avoir prouvé qu'on reçoit les emails de l'adresse. Conséquence qui vaut
 * d'être dite : il n'y a **aucun parcours « mot de passe oublié » à écrire**.
 * Le lien magique en tient lieu, et il est déjà à usage unique, expirant, et
 * limité en débit. Un second mécanisme de récupération à côté du premier ne
 * serait pas un raccourci, ce serait une deuxième surface à sécuriser — c'est
 * le même raisonnement qui a écarté un jeton signé maison pour l'espace client.
 *
 * Module sans base ni réseau : `node:crypto` seulement, donc testable
 * intégralement.
 */

/*
 * `promisify` retient la surcharge à trois arguments de `scrypt` et perd celle
 * qui accepte les options. On redéclare donc la signature : sans elle, les
 * paramètres de coût ne pourraient pas être passés, ce qui ramènerait la
 * dérivation à ses valeurs par défaut — seize fois moins coûteuses, en silence.
 */
const scryptAsync = promisify(scrypt) as (
  motDePasse: string,
  sel: Buffer,
  longueur: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * Paramètres de dérivation.
 *
 * scrypt plutôt qu'Argon2id, qui vient en tête des recommandations de l'OWASP :
 * Argon2 exige une dépendance native, et une dépendance native est ce qui
 * casse une construction sans serveur le jour où l'exécuteur change d'
 * architecture. scrypt est dans `node:crypto`, donc il n'y a rien à installer,
 * rien à compiler, et rien à surveiller. L'OWASP le donne en deuxième choix
 * acceptable, ce qui est le bon arbitrage ici.
 *
 * `N = 2^15` demande 32 Mio et une soixantaine de millisecondes. Monter à
 * `2^17`, la valeur que l'OWASP cite pour un serveur dédié, réclamerait 128 Mio
 * par vérification — sur une fonction sans serveur, quelques connexions
 * simultanées suffiraient à épuiser la mémoire de l'instance, et une connexion
 * refusée pour cause de mémoire est une porte fermée à tout le monde.
 *
 * Les paramètres sont **écrits dans l'empreinte** plutôt que lus ici à la
 * vérification : le jour où on les durcit, les mots de passe existants
 * continuent de se vérifier avec les leurs, et se réencodent à la connexion
 * suivante. Sans cela, un durcissement invaliderait tous les comptes d'un coup.
 */
export const PARAMETRES = { N: 2 ** 15, r: 8, p: 1 } as const;

const LONGUEUR_SEL = 16;
const LONGUEUR_CLEF = 32;

/** `maxmem` par défaut vaut 32 Mio, exactement le coût de `N = 2^15`. */
const MAX_MEMOIRE = 64 * 1024 * 1024;

/**
 * Longueur minimale.
 *
 * Dix caractères, quand le NIST 800-63B en exige huit. **Aucune règle de
 * composition** — ni majuscule, ni chiffre, ni caractère spécial : le même
 * texte les décourage explicitement, parce qu'elles produisent `Motdepasse1!`
 * et non de l'entropie. La longueur est la seule contrainte qui en apporte
 * vraiment.
 */
export const LONGUEUR_MINIMALE = 10;

/**
 * Longueur maximale.
 *
 * Cent vingt-huit caractères. Ce n'est pas une limite de sécurité mais une
 * borne de coût : sans elle, un mot de passe d'un mégaoctet ferait travailler
 * la dérivation pour rien, ce qui est un déni de service à une requête.
 */
export const LONGUEUR_MAXIMALE = 128;

/**
 * Mots de passe refusés d'office.
 *
 * Le NIST demande de comparer à une liste des plus courants. La liste complète
 * en compte des millions et vit dans un service ; celle-ci couvre ce qu'on voit
 * réellement passer sur un site français, et elle est comparée **sans tenir
 * compte de la casse ni des substitutions naïves** — `M0tdepasse` n'est pas
 * plus difficile à deviner que `motdepasse`.
 */
const REFUSES = new Set([
  "motdepasse",
  "password",
  "azertyuiop",
  "qwertyuiop",
  "123456789",
  "1234567890",
  "0123456789",
  "leoclean",
  "leoclean33",
  "bonjour123",
  "chocolat",
  "soleil123",
  "administrateur",
  "iloveyou",
  "princesse",
  "doudou123",
]);

/** Substitutions que personne ne compte comme une difficulté. */
function aplatir(valeur: string): string {
  return valeur
    .toLowerCase()
    .replaceAll("0", "o")
    .replaceAll("1", "i")
    .replaceAll("3", "e")
    .replaceAll("4", "a")
    .replaceAll("5", "s")
    .replaceAll("7", "t")
    .replaceAll("@", "a")
    .replaceAll("$", "s")
    .replaceAll("!", "i");
}

export type RefusMotDePasse =
  "TROP_COURT" | "TROP_LONG" | "TROP_COURANT" | "CONTIENT_IDENTITE";

export const MESSAGES_REFUS: Record<RefusMotDePasse, string> = {
  TROP_COURT: `Il faut au moins ${LONGUEUR_MINIMALE} caractères. Une phrase courte fait un très bon mot de passe.`,
  TROP_LONG: `Pas plus de ${LONGUEUR_MAXIMALE} caractères.`,
  TROP_COURANT:
    "Ce mot de passe figure parmi les plus employés au monde. Prenez plutôt une phrase qui n'a de sens que pour vous.",
  CONTIENT_IDENTITE:
    "Évitez d'y mettre votre adresse email ou votre nom : c'est la première chose qu'on essaie.",
};

/**
 * Ce mot de passe est-il acceptable ?
 *
 * Rend le premier refus, ou `null`. L'ordre compte : on dit ce qui est le plus
 * simple à corriger d'abord, parce qu'un formulaire qui reproche trois choses à
 * la fois se lit comme un mur.
 */
export function verifierMotDePasse(
  motDePasse: string,
  identite: { email?: string | null; nom?: string | null } = {},
): RefusMotDePasse | null {
  if (motDePasse.length < LONGUEUR_MINIMALE) return "TROP_COURT";
  if (motDePasse.length > LONGUEUR_MAXIMALE) return "TROP_LONG";

  const aplati = aplatir(motDePasse);
  if (REFUSES.has(aplati)) return "TROP_COURANT";

  /*
   * Une suite d'un seul caractère répété passe toutes les règles de longueur.
   * On la refuse au même titre qu'un mot de passe courant : `aaaaaaaaaa` est
   * deviné en dix essais.
   */
  if (new Set(aplati).size <= 2) return "TROP_COURANT";

  const morceaux: string[] = [];
  if (identite.email) {
    const local = identite.email.split("@")[0];
    /*
     * L'adressage plus est retiré : `paul+ambre@…` a pour identité `paul`, et
     * accepter `ambre` comme mot de passe reviendrait à ne rien vérifier.
     */
    if (local) morceaux.push(...local.split("+"));
  }
  if (identite.nom) morceaux.push(...identite.nom.split(/\s+/));

  for (const morceau of morceaux) {
    const propre = aplatir(morceau.trim());
    /* En deçà de quatre lettres, la coïncidence l'emporte sur l'indice. */
    if (propre.length >= 4 && aplati.includes(propre)) {
      return "CONTIENT_IDENTITE";
    }
  }

  return null;
}

function encoder(octets: Buffer): string {
  return octets.toString("base64url");
}

/**
 * Dérive une empreinte.
 *
 * Le format porte ses propres paramètres : `scrypt$N$r$p$sel$clef`. C'est ce
 * qui rend un durcissement futur possible sans invalider l'existant.
 */
export async function hacher(motDePasse: string): Promise<string> {
  const sel = randomBytes(LONGUEUR_SEL);
  const clef = await scryptAsync(
    motDePasse.normalize("NFKC"),
    sel,
    LONGUEUR_CLEF,
    {
      ...PARAMETRES,
      maxmem: MAX_MEMOIRE,
    },
  );

  return [
    "scrypt",
    PARAMETRES.N,
    PARAMETRES.r,
    PARAMETRES.p,
    encoder(sel),
    encoder(clef),
  ].join("$");
}

/**
 * Vérifie un mot de passe contre son empreinte.
 *
 * La comparaison est **en temps constant** : un `===` sur des chaînes s'arrête
 * au premier octet différent, et cette différence de durée suffit à retrouver
 * l'empreinte octet par octet.
 *
 * Ne lève jamais. Une empreinte illisible — format inconnu, base corrompue —
 * rend `false`, comme un mot de passe faux : lever ferait remonter une erreur
 * serveur là où la réponse correcte est « ces identifiants ne conviennent
 * pas ».
 */
export async function verifier(
  motDePasse: string,
  empreinte: string,
): Promise<boolean> {
  try {
    const [algorithme, n, r, p, sel, clef] = empreinte.split("$");
    if (algorithme !== "scrypt" || !n || !r || !p || !sel || !clef)
      return false;

    const attendue = Buffer.from(clef, "base64url");
    const calculee = await scryptAsync(
      motDePasse.normalize("NFKC"),
      Buffer.from(sel, "base64url"),
      attendue.length,
      { N: Number(n), r: Number(r), p: Number(p), maxmem: MAX_MEMOIRE },
    );

    return timingSafeEqual(attendue, calculee);
  } catch {
    /*
     * Avalé volontairement, et c'est l'une des rares fois : une empreinte
     * illisible n'est pas un incident à remonter au visiteur, c'est un refus.
     * Le cas se produit si les paramètres stockés sont hors des bornes de
     * `scrypt`, ce qui ne peut venir que d'une base modifiée à la main.
     */
    return false;
  }
}

/**
 * Cette empreinte emploie-t-elle les paramètres du jour ?
 *
 * Sert à réencoder à la connexion : le mot de passe en clair n'est disponible
 * qu'à ce moment-là, et c'est donc la seule occasion de durcir sans rien
 * demander à personne.
 */
export function aReencoder(empreinte: string): boolean {
  const [algorithme, n, r, p] = empreinte.split("$");
  return (
    algorithme !== "scrypt" ||
    Number(n) !== PARAMETRES.N ||
    Number(r) !== PARAMETRES.r ||
    Number(p) !== PARAMETRES.p
  );
}

/**
 * Empreinte factice, employée quand le compte n'existe pas.
 *
 * Sans elle, une adresse inconnue répondrait instantanément là où une adresse
 * connue prend soixante millisecondes : **la différence de durée énumère les
 * comptes**, ce que le message identique s'efforce précisément d'empêcher. On
 * dérive donc pour de bon, sur une empreinte qui ne correspond à personne.
 *
 * Elle est engendrée une fois par processus : la recalculer à chaque appel
 * doublerait le coût sans rien ajouter.
 */
let factice: Promise<string> | null = null;

export function empreinteFactice(): Promise<string> {
  factice ??= hacher(randomBytes(32).toString("base64url"));
  return factice;
}
