import "server-only";

import { prisma } from "@/lib/db";

import {
  type GeoPoint,
  type TravelEstimate,
  type TravelMatrix,
  type TravelTimeProvider,
  estimateTravelMinutes,
  geometricTravelTimeProvider,
  travelKey,
  travelMatrixFrom,
} from "./travel";

/**
 * Cache des temps de trajet.
 *
 * Un calcul d'itinéraire coûte un appel réseau et, chez la plupart des
 * fournisseurs, de l'argent. Une recherche de créneaux en demande des dizaines,
 * et ce sont presque toujours les mêmes : les intervenants habitent le
 * territoire, les clients y reviennent chaque semaine. Le cache n'est donc pas
 * une optimisation tardive, c'est la condition pour que le moteur reste
 * utilisable.
 *
 * `TravelTimeCache` est volontairement **hors du cloisonnement multi-tenant** :
 * le temps de route entre deux points ne dépend d'aucune organisation, et le
 * dupliquer par société diviserait le taux de succès sans rien protéger. Aucune
 * donnée personnelle n'y figure — deux coordonnées arrondies à la centaine de
 * mètres et une durée.
 */

/**
 * Durée de validité d'une entrée.
 *
 * Trente jours. Le réseau routier de la Communauté de communes de Montesquieu
 * ne change pas d'un mois sur l'autre ; ce qui change, ce sont les conditions
 * de circulation, que ce cache ne prétend pas modéliser. Une durée plus courte
 * multiplierait les appels sans améliorer la justesse.
 */
export const TRAVEL_CACHE_TTL_DAYS = 30;

function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + TRAVEL_CACHE_TTL_DAYS * 86_400_000);
}

/**
 * Enveloppe un fournisseur d'un cache en base.
 *
 * En cas d'échec du fournisseur, on retombe sur l'estimation géométrique plutôt
 * que de propager l'erreur : un service d'itinéraire en panne doit dégrader la
 * précision, pas fermer la réservation. L'échec est renvoyé dans le champ
 * `provider`, ce qui permet de le repérer en aval sans inspecter des journaux.
 */
export function cachedTravelTimeProvider(
  upstream: TravelTimeProvider = geometricTravelTimeProvider,
  now: () => Date = () => new Date(),
): TravelTimeProvider {
  return {
    name: `cache(${upstream.name})`,

    async estimate(
      origin: GeoPoint,
      destination: GeoPoint,
    ): Promise<TravelEstimate> {
      const originKey = travelKey(origin);
      const destKey = travelKey(destination);
      const at = now();

      const hit = await prisma.travelTimeCache.findUnique({
        where: {
          provider_originKey_destKey: {
            provider: upstream.name,
            originKey,
            destKey,
          },
        },
      });

      if (hit && (hit.expiresAt === null || hit.expiresAt > at)) {
        return {
          durationMinutes: Math.ceil(hit.durationSeconds / 60),
          distanceMeters: hit.distanceMeters,
          provider: upstream.name,
        };
      }

      let estimate: TravelEstimate;
      try {
        estimate = await upstream.estimate(origin, destination);
      } catch (error) {
        // On journalise plutôt que d'avaler : une panne durable du
        // fournisseur doit se voir, même si elle ne bloque pas le service.
        console.error(
          `[trajet] échec du fournisseur ${upstream.name} pour ${originKey} → ${destKey}`,
          error,
        );
        return {
          durationMinutes: estimateTravelMinutes(origin, destination),
          distanceMeters: 0,
          provider: "geometrique (repli)",
        };
      }

      await prisma.travelTimeCache.upsert({
        where: {
          provider_originKey_destKey: {
            provider: upstream.name,
            originKey,
            destKey,
          },
        },
        create: {
          provider: upstream.name,
          originKey,
          destKey,
          originLat: origin.lat,
          originLng: origin.lng,
          destLat: destination.lat,
          destLng: destination.lng,
          durationSeconds: estimate.durationMinutes * 60,
          distanceMeters: estimate.distanceMeters,
          computedAt: at,
          expiresAt: expiryFrom(at),
        },
        update: {
          durationSeconds: estimate.durationMinutes * 60,
          distanceMeters: estimate.distanceMeters,
          computedAt: at,
          expiresAt: expiryFrom(at),
        },
      });

      return estimate;
    },
  };
}

/**
 * Résout tous les trajets utiles à une recherche de créneaux, en une fois.
 *
 * Le moteur de créneaux est synchrone : il ne peut pas attendre un appel réseau
 * au milieu d'une boucle. On pré-résout donc la matrice des couples
 * effectivement atteignables — domiciles et étapes déjà planifiées d'un côté,
 * adresse demandée de l'autre — plutôt que le produit cartésien complet, qui
 * croîtrait au carré pour rien.
 */
export async function resolveTravelMatrix(
  points: readonly GeoPoint[],
  destination: GeoPoint,
  provider: TravelTimeProvider = geometricTravelTimeProvider,
): Promise<TravelMatrix> {
  const unique = new Map<string, GeoPoint>();
  for (const point of points) {
    unique.set(travelKey(point), point);
  }
  unique.delete(travelKey(destination));

  const pairs = [...unique.values()].flatMap((point) => [
    { origin: point, destination },
    { origin: destination, destination: point },
  ]);

  // Les trajets entre points existants servent au coût d'insertion : sans eux,
  // intercaler une mission paraîtrait toujours gratuit.
  const between = [...unique.values()].flatMap((origin) =>
    [...unique.values()]
      .filter((other) => travelKey(other) !== travelKey(origin))
      .map((other) => ({ origin, destination: other })),
  );

  const resolved = await Promise.all(
    [...pairs, ...between].map(async (pair) => ({
      origin: pair.origin,
      destination: pair.destination,
      durationMinutes: (await provider.estimate(pair.origin, pair.destination))
        .durationMinutes,
    })),
  );

  return travelMatrixFrom(resolved);
}
