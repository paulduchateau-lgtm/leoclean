import { z } from "zod";

import { getCommuneByInsee, isCoveredInsee } from "@/lib/territory";

/**
 * Base Adresse Nationale.
 *
 * `api-adresse.data.gouv.fr` est le référentiel officiel des adresses
 * françaises : gratuit, sans clé, sans quota commercial. On s'en sert pour deux
 * choses que le client ne doit pas avoir à faire lui-même — écrire son adresse
 * sans faute, et savoir si Léo Clean intervient chez lui.
 *
 * **Le code INSEE est le seul identifiant de couverture.** Plusieurs communes du
 * territoire partagent un code postal — 33640 en couvre quatre, 33650 six — et
 * les clients saisissent les noms de façon inconstante. Filtrer sur le code
 * postal laisserait entrer Portets et Beguey ; filtrer sur le nom laisserait
 * passer « la Brede » et refuser « La Brède ».
 */

/**
 * Point d'entrée du géocodage.
 *
 * L'ancienne adresse `api-adresse.data.gouv.fr` répond encore, mais par une
 * redirection assortie d'un avertissement de décommissionnement : elle est
 * remplacée par la Géoplateforme. On appelle donc directement la nouvelle, ce
 * qui économise une redirection et évite de dépendre d'un hôte annoncé comme
 * temporaire. Le contrat de réponse est identique.
 *
 * Le service répond avec `Access-Control-Allow-Origin: *`, ce qui permet de
 * l'interroger aussi depuis le navigateur — c'est ce dont se sert la vitrine
 * statique, qui n'a pas de serveur pour relayer.
 */
const BAN_ENDPOINT = "https://data.geopf.fr/geocodage/search/";

/**
 * Réponse de la BAN, réduite à ce dont on se sert.
 *
 * Le schéma est volontairement tolérant sur ce qu'il ignore et strict sur ce
 * qu'il lit : une API publique peut ajouter des champs, elle ne doit pas
 * pouvoir nous faire écrire des coordonnées manquantes en base.
 */
const banFeatureSchema = z.object({
  geometry: z.object({
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  properties: z.object({
    id: z.string(),
    label: z.string(),
    name: z.string(),
    postcode: z.string(),
    citycode: z.string(),
    city: z.string(),
    type: z.string(),
    score: z.number(),
  }),
});

const banResponseSchema = z.object({
  features: z.array(banFeatureSchema),
});

export interface ResolvedAddress {
  /** Identifiant BAN, conservé pour retrouver l'adresse plus tard. */
  banId: string;
  /** Libellé complet, tel que la BAN l'écrit. */
  label: string;
  /** Numéro et voie. */
  street: string;
  postalCode: string;
  cityName: string;
  inseeCode: string;
  lat: number;
  lng: number;
  /** L'adresse est-elle dans la zone d'intervention ? */
  isCovered: boolean;
  /**
   * Vraie si la BAN a résolu jusqu'au numéro. Une adresse résolue à la rue
   * suffit pour un devis, pas pour envoyer quelqu'un.
   */
  isPreciseToHouseNumber: boolean;
}

export interface AddressSearchOptions {
  limit?: number;
  /** Ne renvoyer que les adresses de la zone d'intervention. */
  coveredOnly?: boolean;
  /** Injection pour les tests : aucune requête réseau n'y est faite. */
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

/**
 * Convertit une entité BAN en adresse exploitable.
 *
 * Exportée pour être testable sans réseau : c'est ici que se joue la
 * correspondance avec le référentiel des communes, et c'est la seule partie de
 * l'intégration qui contienne une décision.
 */
export function toResolvedAddress(
  feature: z.infer<typeof banFeatureSchema>,
): ResolvedAddress {
  const { properties, geometry } = feature;
  const commune = getCommuneByInsee(properties.citycode);

  return {
    banId: properties.id,
    label: properties.label,
    street: properties.name,
    postalCode: properties.postcode,
    // Le nom du référentiel prime sur celui de la BAN quand la commune est
    // couverte : c'est lui qui est affiché partout ailleurs sur le site, et
    // deux orthographes de la même commune abîmeraient la cohérence NAP.
    cityName: commune?.name ?? properties.city,
    inseeCode: properties.citycode,
    lat: geometry.coordinates[1],
    lng: geometry.coordinates[0],
    isCovered: isCoveredInsee(properties.citycode),
    isPreciseToHouseNumber: properties.type === "housenumber",
  };
}

/**
 * Recherche d'adresses.
 *
 * Le filtrage géographique se fait après coup, sur le code INSEE. La BAN
 * n'accepte qu'un code postal par requête là où le territoire en compte six,
 * et le code INSEE est de toute façon le seul critère fiable — plusieurs
 * communes desservies partagent un code postal avec des communes voisines qui
 * ne le sont pas.
 *
 * Une erreur réseau ne lève pas : elle renvoie une liste vide. La saisie
 * assistée est un confort, pas une dépendance — un client doit pouvoir réserver
 * même si la BAN est indisponible, quitte à saisir son adresse à la main.
 */
export async function searchAddresses(
  query: string,
  options: AddressSearchOptions = {},
): Promise<ResolvedAddress[]> {
  const trimmed = query.trim();
  // En deçà de trois caractères, la BAN renvoie du bruit et l'appel est perdu.
  if (trimmed.length < 3) {
    return [];
  }

  const url = new URL(BAN_ENDPOINT);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("limit", String(options.limit ?? 8));
  // Recentrer la recherche sur Léognan remonte les adresses du territoire en
  // tête sans exclure les autres : un client hors zone doit obtenir une réponse
  // claire, pas une liste vide qui ressemble à une panne.
  url.searchParams.set("lat", "44.7236");
  url.searchParams.set("lon", "-0.6172");

  const doFetch = options.fetchImpl ?? fetch;

  try {
    const response = await doFetch(url, {
      signal: options.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      console.error(`[BAN] réponse ${response.status} pour « ${trimmed} »`);
      return [];
    }

    const parsed = banResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      console.error("[BAN] réponse inattendue", parsed.error);
      return [];
    }

    const addresses = parsed.data.features.map(toResolvedAddress);
    return options.coveredOnly
      ? addresses.filter((address) => address.isCovered)
      : addresses;
  } catch (error) {
    // Une annulation n'est pas un incident : elle survient à chaque frappe.
    if (error instanceof Error && error.name === "AbortError") {
      return [];
    }
    console.error("[BAN] échec de la recherche d'adresse", error);
    return [];
  }
}
