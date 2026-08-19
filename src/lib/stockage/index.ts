import {
  type Coffre,
  type TypeFichier,
  cheminDeFichier,
  nettoyer,
  verifierFichier,
} from "./politique";

export * from "./politique";

/**
 * Dépôt de fichiers, derrière une interface remplaçable.
 *
 * Même construction que `scheduling/travel.ts` : le produit parle à une
 * interface, l'implémentation se choisit à la configuration. C'est ce qui rend
 * le stockage testable sans réseau, et remplaçable sans toucher un appelant.
 *
 * **Rien n'est jamais servi en direct.** Un fichier se lit par une URL signée
 * de soixante secondes, engendrée à la demande et jamais mise en cache. Les
 * photos de mission valent preuve, les pièces justificatives portent une
 * identité : ni les unes ni les autres n'ont d'URL devinable.
 */

export interface FichierDepose {
  chemin: string;
  type: TypeFichier;
  taille: number;
}

export interface Stockage {
  /**
   * Dépose un fichier après l'avoir vérifié et nettoyé.
   *
   * La vérification et le nettoyage ne sont pas laissés à l'appelant : ils font
   * partie du dépôt, sinon il suffirait d'un chemin d'appel distrait pour
   * qu'une image arrive avec sa position.
   */
  deposer(input: {
    coffre: Coffre;
    proprietaireId: string;
    identifiant: string;
    octets: Uint8Array;
  }): Promise<FichierDepose>;

  /** URL de lecture, valable soixante secondes. */
  lireUrl(chemin: string): Promise<string>;

  supprimer(chemin: string): Promise<void>;
}

export class FichierRefuseError extends Error {
  constructor(readonly refus: string, message: string) {
    super(message);
    this.name = "FichierRefuseError";
  }
}

/**
 * Implémentation en mémoire.
 *
 * Sert aux tests et au développement sans fournisseur. Elle applique
 * exactement la même politique que la vraie — c'est tout l'intérêt : un test
 * qui passe ici décrit le comportement de production, sauf pour le transport.
 */
export function stockageEnMemoire(): Stockage & {
  contenu(chemin: string): Uint8Array | undefined;
  chemins(): string[];
} {
  const fichiers = new Map<string, { octets: Uint8Array; type: TypeFichier }>();

  return {
    async deposer({ coffre, proprietaireId, identifiant, octets }) {
      const verdict = verifierFichier(octets, coffre);
      if ("refus" in verdict) {
        throw new FichierRefuseError(verdict.refus, verdict.refus);
      }

      const propre = nettoyer(octets, verdict.type);
      const chemin = cheminDeFichier(
        coffre,
        proprietaireId,
        identifiant,
        verdict.type,
      );

      fichiers.set(chemin, { octets: propre, type: verdict.type });
      return { chemin, type: verdict.type, taille: propre.length };
    },

    async lireUrl(chemin) {
      if (!fichiers.has(chemin)) throw new Error("Fichier introuvable");
      /* Aucune signature à imiter : l'implémentation mémoire ne sert rien. */
      return `memoire://${chemin}`;
    },

    async supprimer(chemin) {
      fichiers.delete(chemin);
    },

    contenu(chemin) {
      return fichiers.get(chemin)?.octets;
    },

    chemins() {
      return [...fichiers.keys()].sort();
    },
  };
}

/**
 * Le fournisseur distant n'est pas encore branché, et cela se dit.
 *
 * Le dépôt porte déjà une leçon sur ce point : `TRAVEL_TIME_PROVIDER` annonce
 * `openrouteservice` et `osrm` alors qu'aucun des deux n'existe, si bien que la
 * variable promet plus que le code ne tient. On prend la direction inverse —
 * demander un stockage distant qui n'existe pas **échoue immédiatement**, avec
 * le nom de ce qui manque.
 *
 * Ce qui reste à écrire tient en une quarantaine de lignes, et attend la seule
 * chose qui manque vraiment : un jeton de dépôt et le choix du fournisseur.
 */
export function stockageDistantIndisponible(): never {
  throw new Error(
    "Aucun stockage distant n'est configuré. Renseignez le fournisseur et son " +
      "jeton, ou employez `stockageEnMemoire()` en développement.",
  );
}
