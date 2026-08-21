/**
 * Ce qu'un fichier doit être pour entrer dans le stockage.
 *
 * Module **pur** : il inspecte des octets et rend un verdict, sans réseau ni
 * fournisseur. C'est là que vit la sécurité du dépôt de fichiers, donc c'est là
 * qu'elle se teste — le fournisseur, lui, n'est qu'un transporteur.
 *
 * Deux familles de fichiers, deux politiques, et elles ne se mélangent pas :
 * les photos de mission servent de preuve de réalisation, les pièces
 * justificatives portent une identité. Un même fichier n'a rien à faire dans
 * les deux.
 */

export type Coffre = "missions" | "kyc" | "portraits";

/**
 * Les coffres dont les fichiers sont lisibles sans signature.
 *
 * **Un seul, et c'est un arbitrage explicite** (porteur du projet, 21 août
 * 2026). Un portrait d'avatar s'affiche dans une liste de fils, dans un
 * en-tête, sur une carte d'intervention : le servir par URL signée de soixante
 * secondes obligerait à en engendrer une par image et par rendu, et une image
 * dont l'URL périme se casse dans un onglet resté ouvert.
 *
 * Ce qui reste vrai : le chemin est **engendré**, jamais devinable, et un
 * portrait est une photo qu'on choisit de montrer. Les photos de mission et les
 * pièces d'identité, elles, ne sortent jamais sans signature.
 */
export const COFFRES_PUBLICS: readonly Coffre[] = ["portraits"];

/** Ce coffre est-il lisible sans URL signée ? */
export function estPublic(coffre: Coffre): boolean {
  return COFFRES_PUBLICS.includes(coffre);
}

export type TypeFichier =
  "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

export interface Signature {
  type: TypeFichier;
  /** Octets attendus en tête de fichier. `null` signifie « n'importe quoi ». */
  entete: readonly (number | null)[];
}

/**
 * Nombres magiques.
 *
 * Le type déclaré par le navigateur n'engage que celui qui le lit : un fichier
 * annoncé `image/png` peut être n'importe quoi. On regarde donc les octets.
 */
export const SIGNATURES: readonly Signature[] = [
  { type: "image/jpeg", entete: [0xff, 0xd8, 0xff] },
  {
    type: "image/png",
    entete: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    type: "image/webp",
    // « RIFF » puis quatre octets de taille, puis « WEBP ».
    entete: [
      0x52,
      0x49,
      0x46,
      0x46,
      null,
      null,
      null,
      null,
      0x57,
      0x45,
      0x42,
      0x50,
    ],
  },
  { type: "application/pdf", entete: [0x25, 0x50, 0x44, 0x46, 0x2d] },
];

/** Ce que chaque coffre accepte. */
export const TYPES_ACCEPTES: Readonly<Record<Coffre, readonly TypeFichier[]>> =
  {
    /*
     * Une photo de mission est une image, jamais un document : accepter un PDF
     * ici ouvrirait la porte à un fichier qu'aucun écran ne sait afficher et que
     * personne ne relira.
     */
    missions: ["image/jpeg", "image/png", "image/webp"],
    /* Une pièce justificative arrive aussi bien photographiée que téléchargée. */
    kyc: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    /*
     * Un portrait est une image, et jamais un PDF : accepter un document ici
     * produirait un avatar qu'aucun écran ne sait afficher.
     */
    portraits: ["image/jpeg", "image/png", "image/webp"],
  };

/**
 * Taille maximale, par coffre.
 *
 * Généreuse pour une photo prise au téléphone, mais bornée : la compression a
 * lieu côté client, et un fichier qui arrive à 40 Mo signale une erreur de
 * l'écran plutôt qu'un besoin réel.
 */
export const TAILLE_MAXIMALE: Readonly<Record<Coffre, number>> = {
  missions: 12 * 1024 * 1024,
  kyc: 20 * 1024 * 1024,
  /*
   * Un avatar s'affiche à cinquante pixels de côté. Deux mégaoctets sont déjà
   * généreux pour une photo prise au téléphone, et borner ici évite de servir
   * douze mégaoctets dans une liste de fils.
   */
  portraits: 2 * 1024 * 1024,
};

export type RefusFichier =
  "type-inconnu" | "type-refuse" | "trop-gros" | "vide";

export const MESSAGES_REFUS: Record<RefusFichier, string> = {
  "type-inconnu":
    "Ce fichier n'est pas une image ni un PDF. Prenez une photo ou choisissez un autre fichier.",
  "type-refuse": "Ce format n'est pas accepté ici.",
  "trop-gros": "Ce fichier est trop lourd. Reprenez la photo ou réduisez-la.",
  vide: "Ce fichier est vide.",
};

/** Reconnaît un type à partir de ses premiers octets, ou rien. */
export function typeReel(octets: Uint8Array): TypeFichier | null {
  for (const signature of SIGNATURES) {
    if (octets.length < signature.entete.length) continue;

    const correspond = signature.entete.every(
      (attendu, index) => attendu === null || octets[index] === attendu,
    );
    if (correspond) return signature.type;
  }
  return null;
}

/**
 * Un fichier peut-il entrer dans ce coffre ?
 *
 * Le type annoncé n'est jamais consulté : seuls les octets décident. C'est la
 * seule vérification qu'un envoi malveillant ne peut pas contourner en changeant
 * une en-tête.
 */
export function verifierFichier(
  octets: Uint8Array,
  coffre: Coffre,
): { type: TypeFichier } | { refus: RefusFichier } {
  if (octets.length === 0) return { refus: "vide" };
  if (octets.length > TAILLE_MAXIMALE[coffre]) return { refus: "trop-gros" };

  const type = typeReel(octets);
  if (!type) return { refus: "type-inconnu" };
  if (!TYPES_ACCEPTES[coffre].includes(type)) return { refus: "type-refuse" };

  return { type };
}

/**
 * Retire les métadonnées d'une image JPEG.
 *
 * **Tout est retiré, y compris la date de prise de vue.** Le corpus proposait
 * de conserver la date ; on ne le fait pas, et c'est un choix : une date écrite
 * par l'appareil se modifie en trois secondes, donc elle ne prouve rien, tandis
 * que les coordonnées GPS qui l'accompagnent désignent un domicile pour treize
 * mois. La date qui compte — celle du check-out — est horodatée côté serveur,
 * où personne ne peut la réécrire.
 *
 * La méthode est un retrait de segments, pas un ré-encodage : les segments
 * d'application d'un JPEG se suppriment sans toucher à l'image, ce qui évite
 * une dépendance de traitement d'image pour un besoin qui n'en demande pas.
 */
export function nettoyerJpeg(octets: Uint8Array): Uint8Array {
  // Pas un JPEG : rien à faire, la vérification en amont a déjà tranché.
  if (octets.length < 4 || octets[0] !== 0xff || octets[1] !== 0xd8) {
    return octets;
  }

  const morceaux: Uint8Array[] = [octets.subarray(0, 2)];
  let position = 2;

  while (position + 3 < octets.length) {
    if (octets[position] !== 0xff) break;

    const marqueur = octets[position + 1]!;

    /*
     * `SOS` ouvre les données compressées : tout ce qui suit est l'image, et
     * elle se recopie telle quelle jusqu'à la fin du fichier.
     */
    if (marqueur === 0xda) {
      morceaux.push(octets.subarray(position));
      position = octets.length;
      break;
    }

    const longueur = (octets[position + 2]! << 8) | octets[position + 3]!;
    if (longueur < 2 || position + 2 + longueur > octets.length) break;

    /*
     * Les segments d'application `APP1` à `APP15` portent EXIF, XMP, IPTC et
     * les vignettes — donc la position, l'appareil, parfois le nom du
     * propriétaire. `APP0` (JFIF) ne porte que la densité de pixels et reste,
     * certains décodeurs anciens l'attendant.
     */
    const estSegmentDApplication = marqueur >= 0xe1 && marqueur <= 0xef;
    const estCommentaire = marqueur === 0xfe;

    if (!estSegmentDApplication && !estCommentaire) {
      morceaux.push(octets.subarray(position, position + 2 + longueur));
    }

    position += 2 + longueur;
  }

  if (position < octets.length) morceaux.push(octets.subarray(position));

  const total = morceaux.reduce((somme, morceau) => somme + morceau.length, 0);
  const resultat = new Uint8Array(total);
  let curseur = 0;
  for (const morceau of morceaux) {
    resultat.set(morceau, curseur);
    curseur += morceau.length;
  }
  return resultat;
}

/**
 * Retire les blocs annexes d'un PNG.
 *
 * Un PNG porte ses métadonnées dans des blocs facultatifs — `eXIf`, `tEXt`,
 * `iTXt`, `zTXt` — reconnaissables à la minuscule de leur premier caractère.
 * Les blocs essentiels sont conservés, l'image ne bouge pas.
 */
export function nettoyerPng(octets: Uint8Array): Uint8Array {
  const SIGNATURE = 8;
  if (octets.length < SIGNATURE + 12) return octets;

  const ANNEXES = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);
  const morceaux: Uint8Array[] = [octets.subarray(0, SIGNATURE)];
  let position = SIGNATURE;

  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);

  while (position + 8 <= octets.length) {
    const longueur = vue.getUint32(position);
    const nom = String.fromCharCode(
      octets[position + 4]!,
      octets[position + 5]!,
      octets[position + 6]!,
      octets[position + 7]!,
    );
    const fin = position + 12 + longueur;
    if (fin > octets.length) break;

    if (!ANNEXES.has(nom)) {
      morceaux.push(octets.subarray(position, fin));
    }

    position = fin;
    if (nom === "IEND") break;
  }

  const total = morceaux.reduce((somme, morceau) => somme + morceau.length, 0);
  const resultat = new Uint8Array(total);
  let curseur = 0;
  for (const morceau of morceaux) {
    resultat.set(morceau, curseur);
    curseur += morceau.length;
  }
  return resultat;
}

/** Applique le nettoyage qui convient au type reconnu. */
export function nettoyer(octets: Uint8Array, type: TypeFichier): Uint8Array {
  if (type === "image/jpeg") return nettoyerJpeg(octets);
  if (type === "image/png") return nettoyerPng(octets);
  /*
   * WebP et PDF sont conservés tels quels. Le premier peut porter un bloc EXIF,
   * le second des propriétés de document : les traiter demanderait une
   * bibliothèque, et ils ne représentent pas le chemin par lequel une photo de
   * salon arrive avec sa position. À reprendre le jour où l'écran d'envoi les
   * produira vraiment.
   */
  return octets;
}

/** Extension canonique, pour composer un nom de fichier. */
export const EXTENSIONS: Readonly<Record<TypeFichier, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Compose le chemin d'un fichier dans son coffre.
 *
 * **Rien de ce que la personne a saisi n'y figure.** Un nom d'origine porte des
 * accents, des espaces, parfois un patronyme, et il se traverse — le chemin est
 * donc engendré, et il ne dit rien de plus que le coffre, le propriétaire et un
 * identifiant.
 */
export function cheminDeFichier(
  coffre: Coffre,
  proprietaireId: string,
  identifiant: string,
  type: TypeFichier,
): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(proprietaireId)) {
    throw new Error("Identifiant de propriétaire inattendu");
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(identifiant)) {
    throw new Error("Identifiant de fichier inattendu");
  }
  return `${coffre}/${proprietaireId}/${identifiant}.${EXTENSIONS[type]}`;
}

/**
 * Durée de vie d'une URL signée.
 *
 * Soixante secondes : le temps d'ouvrir le fichier, pas celui de le partager.
 * Une URL plus longue finit dans un historique, un journal de serveur mandataire
 * ou une conversation.
 */
export const DUREE_URL_SIGNEE_SECONDES = 60;
