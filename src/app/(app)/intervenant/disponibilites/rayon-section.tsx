"use client";

import {
  effacerZone,
  enregistrerRayon,
  enregistrerZone,
} from "@/app/(app)/intervenant/disponibilites/actions";
import { CartePerimetre } from "@/components/espace-pro/carte-zone";
import type { Point } from "@/lib/availability/rayon";
import type { PointZone } from "@/lib/availability/zone";
import { COMMUNES, HEADQUARTERS } from "@/lib/territory";

/**
 * Le pont entre la page serveur et la carte.
 *
 * `territory.ts` n'est pas importé par la carte : elle reçoit un référentiel
 * réduit à quatre champs par commune, comme `CouvertureCheck` sur l'accueil,
 * pour ne pas embarquer des codes INSEE et des populations dont un dessin n'a
 * rien à faire.
 *
 * Les trois server actions traversent la frontière serveur/client, ce qu'une
 * fonction ordinaire ne sait pas faire : c'est ce qui permet à la carte
 * d'ignorer la base entière.
 */
const CARTE = COMMUNES.map((commune) => ({
  slug: commune.slug,
  name: commune.name,
  lat: commune.lat,
  lng: commune.lng,
}));

export function RayonSection({
  rayonInitial,
  zoneInitiale,
  domicile,
}: {
  rayonInitial: number;
  zoneInitiale: PointZone[] | null;
  domicile: Point | null;
}) {
  return (
    <CartePerimetre
      centre={domicile ?? { lat: HEADQUARTERS.lat, lng: HEADQUARTERS.lng }}
      communes={CARTE}
      rayonInitial={rayonInitial}
      zoneInitiale={zoneInitiale}
      adresseConnue={domicile !== null}
      enregistrerLaZone={async (zone) => {
        const resultat = await enregistrerZone({ zone });
        return resultat.ok
          ? { ok: true }
          : { ok: false, error: resultat.error };
      }}
      effacerLaZone={async () => {
        const resultat = await effacerZone({});
        return resultat.ok
          ? { ok: true }
          : { ok: false, error: resultat.error };
      }}
      enregistrerLeRayon={async (rayonKm) => {
        const resultat = await enregistrerRayon({ rayonKm });
        return resultat.ok
          ? { ok: true }
          : { ok: false, error: resultat.error };
      }}
    />
  );
}
