import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Chiffrement des consignes d'accès.
 *
 * Un code de porte n'est pas une donnée comme une autre : il ouvre un domicile.
 * Il ne se stocke donc pas en clair, il ne s'écrit jamais dans un journal, et il
 * ne se lit que dans une fenêtre étroite par la personne qui doit entrer.
 *
 * AES-256-GCM plutôt que CBC : le mode authentifié refuse de déchiffrer un
 * texte modifié, là où CBC rendrait des octets et laisserait l'appelant décider
 * quoi en penser. Sur une donnée qui commande une serrure, on préfère l'échec.
 *
 * Module **pur au sens du dépôt** : la clé est passée en paramètre, jamais lue
 * de l'environnement ici. C'est ce qui permet de le tester sans configuration,
 * et ce qui empêche un appelant de chiffrer avec une clé qu'il n'a pas choisie.
 */

const ALGORITHME = "aes-256-gcm";
const TAILLE_IV = 12;
const TAILLE_TAG = 16;

/**
 * Dérive une clé de 32 octets à partir d'un secret quelconque.
 *
 * SHA-256 et non un dérivateur lent : le secret vient de l'environnement, pas
 * d'un mot de passe humain. Il est déjà long et aléatoire, et lui appliquer
 * cent mille tours ne le rendrait pas plus imprévisible — cela ralentirait
 * seulement chaque lecture de mission.
 */
export function deriverClef(secret: string): Buffer {
  if (secret.length < 32) {
    throw new Error(
      "La clé de chiffrement des consignes d'accès doit faire au moins 32 caractères.",
    );
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

/**
 * Chiffre une consigne.
 *
 * Le vecteur d'initialisation est tiré au hasard à chaque appel et rangé devant
 * le message : deux fois le même code produisent donc deux textes chiffrés
 * différents. Sans cela, comparer deux colonnes suffirait à savoir que deux
 * clients ont le même digicode — ce qui, sur un immeuble, est une information.
 */
export function chiffrer(clair: string, clef: Buffer): Buffer {
  const iv = randomBytes(TAILLE_IV);
  const chiffreur = createCipheriv(ALGORITHME, clef, iv);
  const corps = Buffer.concat([
    chiffreur.update(clair, "utf8"),
    chiffreur.final(),
  ]);
  return Buffer.concat([iv, chiffreur.getAuthTag(), corps]);
}

/**
 * Déchiffre une consigne, ou échoue.
 *
 * Aucun repli, aucune valeur par défaut : un texte altéré fait lever une
 * erreur. Rendre une chaîne vide laisserait croire qu'il n'y a pas de consigne,
 * et l'intervenant se présenterait devant une porte sans savoir comment entrer.
 */
export function dechiffrer(paquet: Buffer, clef: Buffer): string {
  /*
   * Strictement inférieur, et non « ou égal » : une consigne vide produit un
   * paquet de exactement 28 octets — un vecteur et un tag, sans corps. C'est un
   * cas légitime, celui de quelqu'un qui efface sa consigne, et le rejeter
   * ferait échouer la lecture d'une mission au lieu de rendre une chaîne vide.
   */
  if (paquet.length < TAILLE_IV + TAILLE_TAG) {
    throw new Error("Consigne d'accès illisible : paquet trop court.");
  }

  const iv = paquet.subarray(0, TAILLE_IV);
  const tag = paquet.subarray(TAILLE_IV, TAILLE_IV + TAILLE_TAG);
  const corps = paquet.subarray(TAILLE_IV + TAILLE_TAG);

  const dechiffreur = createDecipheriv(ALGORITHME, clef, iv);
  dechiffreur.setAuthTag(tag);
  return Buffer.concat([
    dechiffreur.update(corps),
    dechiffreur.final(),
  ]).toString("utf8");
}

/**
 * Fenêtre pendant laquelle un intervenant affecté voit la consigne.
 *
 * De vingt-quatre heures avant à deux heures après. Avant, il n'en a pas
 * besoin ; après, il n'en a plus le droit. C'est la fenêtre du corpus, et elle
 * n'est pas décorative : hors d'elle, un compte compromis ne donne accès à
 * aucun domicile.
 */
export const FENETRE_AVANT_HEURES = 24;
export const FENETRE_APRES_HEURES = 2;

export function dansLaFenetre(
  mission: { debut: Date; fin: Date },
  maintenant: Date,
): boolean {
  const ouverture =
    mission.debut.getTime() - FENETRE_AVANT_HEURES * 3_600_000;
  const fermeture = mission.fin.getTime() + FENETRE_APRES_HEURES * 3_600_000;
  const instant = maintenant.getTime();
  return instant >= ouverture && instant <= fermeture;
}
