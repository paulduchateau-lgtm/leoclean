import { COMMUNES, HEADQUARTERS, TERRITORY_POPULATION } from "./territory";

/**
 * Identité publique de LéoClean — source de vérité unique du NAP
 * (Name, Address, Phone).
 *
 * La cohérence stricte de ces valeurs entre le site, Google Business Profile
 * et les annuaires locaux est un facteur de classement local direct. Rien de
 * ce bloc ne doit être ressaisi en dur dans une page : JSON-LD, pied de page,
 * mentions légales, llms.txt et emails lisent tous ici.
 *
 * Les champs à `null` sont des informations que LéoClean n'a pas encore
 * fournies. Les composants qui les consomment doivent les masquer proprement
 * plutôt qu'afficher un espace réservé : une NAP incomplète est neutre, une
 * NAP inexacte est pénalisante.
 */

const url =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://leoclean.fr";

export const SITE = {
  name: "LéoClean",

  /** Raison sociale. À compléter dès l'immatriculation. */
  legalName: null as string | null,
  siret: null as string | null,
  /** Numéro de déclaration Services à la personne (DDETS). */
  sapDeclarationNumber: null as string | null,

  url,

  /**
   * Phrase de description canonique. Rédigée pour être citable telle quelle
   * par un modèle de langage : factuelle, autonome, ancrée géographiquement.
   */
  description:
    `LéoClean est un service de ménage à domicile qui intervient à Léognan (33850), ` +
    `à La Brède et dans les ${COMMUNES.length - 2} autres communes de la Communauté de ` +
    `communes de Montesquieu, en Gironde, au sud de Bordeaux.`,

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

  /** Adresse postale du siège. La rue reste à renseigner. */
  address: {
    street: null as string | null,
    postalCode: HEADQUARTERS.postalCode,
    city: HEADQUARTERS.name,
    region: "Nouvelle-Aquitaine",
    department: "Gironde",
    country: "FR",
    lat: HEADQUARTERS.lat,
    lng: HEADQUARTERS.lng,
  },

  /** Date de création de l'entreprise, au format ISO. Page /a-propos et JSON-LD. */
  foundingDate: null as string | null,
  founder: null as string | null,

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
];

/** URL absolue à partir d'un chemin, pour les canonicals et le JSON-LD. */
export function absoluteUrl(path: string): string {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
