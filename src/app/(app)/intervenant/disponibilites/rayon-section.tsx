"use client";

import { enregistrerRayon } from "@/app/(app)/intervenant/disponibilites/actions";
import { CarteRayon } from "@/components/espace-pro/carte-rayon";
import type { Point } from "@/lib/availability/rayon";
import { COMMUNES, HEADQUARTERS } from "@/lib/territory";

/**
 * Le pont entre la page serveur et la carte.
 *
 * `territory.ts` n'est pas importé par la carte elle-même : elle reçoit un
 * référentiel réduit à quatre champs par commune, comme `CouvertureCheck` sur
 * l'accueil, pour ne pas embarquer des codes INSEE et des populations dont un
 * dessin n'a rien à faire.
 */
const CARTE = COMMUNES.map((commune) => ({
  slug: commune.slug,
  name: commune.name,
  lat: commune.lat,
  lng: commune.lng,
}));

export function RayonSection({
  rayonInitial,
  domicile,
}: {
  rayonInitial: number;
  domicile: Point | null;
}) {
  return (
    <CarteRayon
      centre={domicile ?? { lat: HEADQUARTERS.lat, lng: HEADQUARTERS.lng }}
      communes={CARTE}
      rayonInitial={rayonInitial}
      adresseConnue={domicile !== null}
      enregistrer={async (rayonKm) => {
        const resultat = await enregistrerRayon({ rayonKm });
        return resultat.ok
          ? { ok: true }
          : { ok: false, error: resultat.error };
      }}
    />
  );
}
