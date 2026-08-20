/**
 * Numérotation des factures.
 *
 * Module **pur**. La règle est fiscale et elle est stricte : l'article 242
 * nonies A de l'annexe II au CGI exige un numéro fondé sur une **séquence
 * chronologique continue, sans rupture**. Un trou dans la suite se présume être
 * une facture retirée, et c'est ce que l'administration cherche en premier.
 *
 * Trois conséquences, toutes dans le code :
 *
 * 1. **Une séquence par émetteur.** Léo Clean facture sa coordination pour son
 *    propre compte ; l'intervenant facture sa prestation pour le sien. Deux
 *    entités, deux suites — les mélanger produirait une suite qui n'appartient
 *    à personne.
 * 2. **Une série dédiée pour l'autofacturation.** Les factures de
 *    l'intervenant sont établies par Léo Clean en son nom et pour son compte
 *    (article 289, I-2 du CGI). Il facture aussi ailleurs, et sa propre suite
 *    nous est inconnue : une série distincte est précisément la réponse prévue
 *    pour ce cas. Sans elle, deux suites indépendantes se recouvriraient.
 * 3. **Le compteur vit en base et s'incrémente dans la transaction qui écrit la
 *    facture**, jamais dans une `SEQUENCE` PostgreSQL — une séquence ne revient
 *    pas en arrière quand la transaction échoue, et laisse donc exactement le
 *    trou qu'on cherche à éviter.
 *
 * La remise à zéro est annuelle, l'année figurant dans le numéro : c'est
 * l'usage, et il rend la suite lisible par un humain qui cherche une facture.
 */

/** Série des factures de coordination, émises par Léo Clean pour son compte. */
export const SERIE_PLATEFORME = "LC";

/**
 * Série d'autofacturation d'un intervenant.
 *
 * Le SIREN plutôt qu'un code interne : il identifie l'entreprise qui vend, il
 * est stable, et il rend visible sur le numéro lui-même que la facture
 * appartient à une autre entité que la plateforme.
 */
export function serieIntervenant(siren: string): string {
  const propre = siren.replace(/\D/g, "");
  if (propre.length !== 9) {
    throw new Error(`SIREN attendu sur neuf chiffres, reçu « ${siren} ».`);
  }
  return `${SERIE_PLATEFORME}-${propre}`;
}

/**
 * Rang maximal d'une année.
 *
 * Cinq chiffres, soit 99 999 factures par série et par an. Le dépassement
 * **lève** plutôt que de déborder sur six chiffres : deux longueurs dans la
 * même suite casseraient le tri alphabétique sur lequel s'appuient les exports
 * comptables, et un tri faux sur une suite censée être chronologique est plus
 * grave qu'un arrêt.
 */
export const RANG_MAXIMUM = 99_999;

export interface Numero {
  serie: string;
  annee: number;
  rang: number;
}

export function composerNumero({ serie, annee, rang }: Numero): string {
  if (rang < 1 || rang > RANG_MAXIMUM) {
    throw new Error(
      `Rang hors bornes : ${rang}. La série ${serie} de ${annee} est pleine.`,
    );
  }
  return `${serie}-${annee}-${String(rang).padStart(5, "0")}`;
}

/**
 * Relit un numéro.
 *
 * L'année et le rang sont pris **par la fin** : une série contient elle-même
 * des tirets (`LC-894567123`), et découper par la gauche rendrait un résultat
 * faux sur les seules factures d'intervenants.
 */
export function analyserNumero(numero: string): Numero | null {
  const correspondance = /^(.+)-(\d{4})-(\d{5})$/.exec(numero);
  if (!correspondance) return null;

  const [, serie, annee, rang] = correspondance as unknown as [
    string,
    string,
    string,
    string,
  ];

  return { serie, annee: Number(annee), rang: Number(rang) };
}

/**
 * L'année d'émission, au sens du calendrier français.
 *
 * Une facture émise le 1ᵉʳ janvier à 00 h 30 heure de Paris appartient à
 * l'année qui commence, et non à celle qui vient de finir en UTC. La base
 * stocke en UTC ; l'exercice comptable, lui, est civil et local.
 */
export function anneeDemission(instant: Date): number {
  return Number(
    new Intl.DateTimeFormat("fr-FR", {
      year: "numeric",
      timeZone: "Europe/Paris",
    }).format(instant),
  );
}

/**
 * La suite est-elle continue ?
 *
 * Employée par les tests et par l'export comptable. On ne cherche pas à
 * réparer un trou — une facture manquante ne s'invente pas — mais à le nommer :
 * c'est la première question qu'on posera, et il vaut mieux y répondre avant.
 */
export function trousDansLaSuite(numeros: readonly string[]): number[] {
  const rangs = numeros
    .map(analyserNumero)
    .filter((numero): numero is Numero => numero !== null)
    .map((numero) => numero.rang)
    .sort((a, b) => a - b);

  const trous: number[] = [];
  for (let attendu = 1; attendu <= (rangs.at(-1) ?? 0); attendu += 1) {
    if (!rangs.includes(attendu)) trous.push(attendu);
  }
  return trous;
}
