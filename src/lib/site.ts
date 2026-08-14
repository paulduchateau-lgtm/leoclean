import {
  COMMUNES,
  HEADQUARTERS,
  MONTESQUIEU_COMMUNES,
  TERRITORY_POPULATION,
} from "./territory";

/**
 * Identité publique de Léo Clean — source de vérité unique du NAP
 * (Name, Address, Phone).
 *
 * La cohérence stricte de ces valeurs entre le site, Google Business Profile
 * et les annuaires locaux est un facteur de classement local direct. Rien de
 * ce bloc ne doit être ressaisi en dur dans une page : JSON-LD, pied de page,
 * mentions légales, llms.txt et emails lisent tous ici.
 *
 * Les champs à `null` sont des informations que Léo Clean n'a pas encore
 * fournies. Les composants qui les consomment doivent les masquer proprement
 * plutôt qu'afficher un espace réservé : une NAP incomplète est neutre, une
 * NAP inexacte est pénalisante.
 */

const url =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://leoclean.fr";

export const SITE = {
  name: "Léo Clean",

  /**
   * Structure juridique exploitante.
   *
   * PAPER PLANE, SASU immatriculée le 8 avril 2021, dont le siège est déjà à
   * Léognan — ce qui donne à Léo Clean une antériorité locale réelle et une
   * adresse vérifiable, deux signaux que Google Business Profile valorise.
   *
   * Réserve importante : le code APE de la société est 70.22Z, « conseil pour
   * les affaires et autres conseils de gestion ». La déclaration Services à la
   * personne est soumise à une condition d'activité exclusive : un organisme
   * déclaré ne peut, en principe, exercer que des activités de services à la
   * personne. Exploiter Léo Clean depuis une société de conseil compromettrait
   * donc la déclaration — et avec elle le crédit d'impôt, principal argument
   * de conversion. À faire trancher avec la DDETS ou un conseil avant de
   * communiquer sur l'avantage fiscal.
   */
  legalName: "PAPER PLANE",
  legalForm: "SASU",
  siren: "898228705",
  siret: "89822870500015" as string | null,
  /** Code APE de la structure. 70.22Z relève du conseil, non des SAP. */
  apeCode: "70.22Z",
  /** Numéro de déclaration Services à la personne (DDETS). */
  sapDeclarationNumber: null as string | null,

  url,

  /**
   * Phrase de description canonique. Rédigée pour être citable telle quelle
   * par un modèle de langage : factuelle, autonome, ancrée géographiquement.
   */
  description:
    `Léo Clean est un service de ménage à domicile qui intervient dans ${COMMUNES.length} communes ` +
    `du sud de Bordeaux, en Gironde : Villenave-d'Ornon, Gradignan, Cestas, ainsi que ` +
    `Léognan (33850) et les ${MONTESQUIEU_COMMUNES.length - 1} autres communes de la Communauté de ` +
    `communes de Montesquieu.`,

  /**
   * Coordonnées de contact.
   *
   * Un vrai numéro joignable est un engagement produit, pas un ornement : c'est
   * ce qui sépare une plateforme nationale anonyme d'un service de proximité.
   * Il est affiché en clair sur le site, repris dans le JSON-LD et dans les
   * fichiers destinés aux modèles de langage.
   *
   * Deux écritures du même numéro : celle qu'on lit, et celle qu'on compose.
   * Le format international est requis par schema.org et par les liens `tel:`,
   * qui échouent sur mobile avec des espaces.
   */
  phone: "06 84 36 38 62",
  phoneE164: "+33684363862",
  email: "bonjour@leoclean.fr",

  /**
   * Canaux de contact, par ordre d'engagement décroissant.
   *
   * Le téléphone convertit le mieux mais demande le plus d'effort ; WhatsApp
   * lève la barrière de l'appel, ce qui compte pour une prestation qu'on fait
   * entrer chez soi et sur laquelle on veut poser trois questions avant de
   * s'engager. L'email reste le recours de ceux qui écrivent le soir.
   *
   * Le lien `wa.me` n'exige aucune application Meta : il ouvre une
   * conversation dans WhatsApp Business, gratuitement. Une app n'est
   * nécessaire que pour l'API, donc pour automatiser des réponses.
   */
  whatsappUrl: "https://wa.me/33684363862",

  /**
   * Page Facebook de l'entreprise.
   *
   * L'URL enregistrée est la destination canonique du lien de partage fourni,
   * résolue une fois pour toutes et débarrassée de ses paramètres de suivi
   * (`mibextid`, `rdid`, `share_url`) : ceux-ci sont propres à la session qui a
   * généré le partage et n'ont rien à faire dans un `sameAs`.
   *
   * La page s'intitule « Léo Clean - Ménage à domicile », et la marque s'écrit
   * bien « Léo Clean », en deux mots : le site, Facebook et Google Business
   * Profile disent donc le même nom. Cette cohérence est un signal de
   * référencement local direct, et elle ne doit pas se défaire.
   */
  facebookUrl:
    "https://www.facebook.com/people/L%C3%A9o-Clean-M%C3%A9nage-%C3%A0-domicile/61565009514966/" as
      string | null,

  /** Adresse postale du siège, telle qu'immatriculée. */
  address: {
    street: "2 ter rue Camille Desmoulins" as string | null,
    postalCode: HEADQUARTERS.postalCode,
    city: HEADQUARTERS.name,
    region: "Nouvelle-Aquitaine",
    department: "Gironde",
    country: "FR",
    lat: HEADQUARTERS.lat,
    lng: HEADQUARTERS.lng,
  },

  /** Date de création de la société, au format ISO. Page /a-propos et JSON-LD. */
  foundingDate: "2021-04-08" as string | null,
  founder: "Paul Duchateau" as string | null,

  /** Fuseau d'affichage. La base stocke exclusivement en UTC. */
  timezone: "Europe/Paris",
  locale: "fr-FR",
  currency: "EUR",

  /** Nombre d'habitants desservis, calculé depuis le référentiel des communes. */
  populationServed: TERRITORY_POPULATION,
} as const;

/** Champs de la NAP restant à fournir avant toute campagne d'acquisition. */
export const PENDING_IDENTITY_FIELDS: readonly string[] = [
  ...(SITE.legalName === null ? ["raison sociale"] : []),
  ...(SITE.siret === null ? ["SIRET"] : []),
  ...(SITE.address.street === null ? ["adresse du siège"] : []),
  ...(SITE.foundingDate === null ? ["date de création"] : []),
  ...(SITE.founder === null ? ["fondateur"] : []),
  ...(SITE.sapDeclarationNumber === null ? ["numéro de déclaration SAP"] : []),
  ...(SITE.facebookUrl === null ? ["URL exacte de la page Facebook"] : []),
];

/**
 * Profils publics rattachés à l'entreprise, pour le champ `sameAs` du JSON-LD.
 *
 * Ils confirment aux moteurs qu'un même établissement se retrouve sur
 * plusieurs surfaces : c'est l'un des signaux de cohérence les plus directs du
 * référencement local, au même titre que la NAP.
 */
export const SOCIAL_PROFILES: readonly string[] = [SITE.facebookUrl].filter(
  (url): url is string => url !== null,
);

/** Message pré-rempli d'un contact WhatsApp, depuis une commune donnée. */
export function whatsappLink(communeName?: string): string {
  const message = communeName
    ? `Bonjour, je souhaite un ménage à domicile à ${communeName}.`
    : "Bonjour, je souhaite un ménage à domicile.";
  return `${SITE.whatsappUrl}?text=${encodeURIComponent(message)}`;
}

/** URL absolue à partir d'un chemin, pour les canonicals et le JSON-LD. */
export function absoluteUrl(path: string): string {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
