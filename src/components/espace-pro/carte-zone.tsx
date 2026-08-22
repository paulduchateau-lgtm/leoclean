"use client";

import "leaflet/dist/leaflet.css";

import type {
  Circle as LeafletCircle,
  Map as LeafletMap,
  Polygon as LeafletPolygon,
} from "leaflet";
import { Loader2Icon, PencilIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  type CommuneCarte,
  RAYON_MAX_KM,
  RAYON_MIN_KM,
  RAYON_PAS_KM,
  couverture,
} from "@/lib/availability/rayon";
import {
  MESSAGES_ZONE,
  type PointZone,
  aireKm2,
  cadre,
  simplifier,
  verifierLaZone,
} from "@/lib/availability/zone";

/**
 * Zone d'intervention, dessinée au doigt sur une vraie carte.
 *
 * **Les tuiles viennent de la Géoplateforme de l'IGN.** Service public
 * français, ouvert et sans clé — le dépôt s'y adresse déjà pour la recherche
 * d'adresse. Le choix n'est pas seulement pratique : dessiner sa zone envoie
 * la position de son domicile au serveur de tuiles, une requête par
 * déplacement, et il vaut mieux que ce serveur soit l'IGN qu'un tiers dont on
 * ne sait rien. L'attribution est obligatoire et figure sur la carte.
 *
 * **Le tracé se ferme tout seul.** Personne ne revient exactement à son point
 * de départ au doigt ; exiger la fermeture produirait des échecs sur des
 * gestes parfaitement clairs. Il est ensuite simplifié — trois cents points
 * deviennent une soixantaine — et refusé s'il est minuscule, un tap qui glisse
 * de trois pixels produisant sinon une zone valide qui couperait toutes les
 * missions.
 *
 * **Pendant le tracé, la carte ne bouge pas.** Un doigt qui glisse ne peut pas
 * dire à la fois « déplace la carte » et « dessine » : le mode de dessin
 * désactive le déplacement, et le dit.
 *
 * **Une seule carte porte les deux réglages.** Le rayon s'y dessine comme un
 * cercle, la zone comme un tracé, et la liste des communes couvertes est
 * calculée par la même fonction dans les deux cas. Deux cartes empilées
 * auraient demandé de comprendre laquelle fait foi ; ici, le tracé remplace le
 * cercle à l'écran comme il le remplace dans le moteur.
 */
export function CartePerimetre({
  centre,
  communes,
  zoneInitiale,
  rayonInitial,
  adresseConnue,
  enregistrerLaZone,
  effacerLaZone,
  enregistrerLeRayon,
}: {
  /** Domicile de l'intervenant, ou le siège à défaut. */
  centre: PointZone;
  communes: readonly CommuneCarte[];
  zoneInitiale: PointZone[] | null;
  rayonInitial: number;
  adresseConnue: boolean;
  enregistrerLaZone: (
    zone: PointZone[],
  ) => Promise<{ ok: boolean; error?: string }>;
  effacerLaZone: () => Promise<{ ok: boolean; error?: string }>;
  enregistrerLeRayon: (
    rayonKm: number,
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<LeafletMap | null>(null);
  const trace = useRef<LeafletPolygon | null>(null);
  const enCours = useRef<PointZone[]>([]);

  const cercle = useRef<LeafletCircle | null>(null);

  const [zone, setZone] = useState<PointZone[] | null>(zoneInitiale);
  const [rayon, setRayon] = useState(rayonInitial);
  const [rayonEnregistre, setRayonEnregistre] = useState(rayonInitial);
  const [dessine, setDessine] = useState(false);
  const [apercu, setApercu] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /* Leaflet ne s'importe qu'au montage : il touche `window` à l'évaluation du
     module, et le rendu serveur planterait. */
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let vivante = true;
    const noeud = conteneur.current;
    if (!noeud) return;

    void import("leaflet").then((L) => {
      if (!vivante || carte.current) return;

      const map = L.map(noeud, {
        center: [centre.lat, centre.lng],
        zoom: 11,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer(
        "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
        {
          maxZoom: 18,
          attribution: '<a href="https://www.ign.fr/">IGN-F/Géoportail</a>',
        },
      ).addTo(map);

      /* Le domicile, marqué pour de bon : le fond de plan porte assez de
         symboles pour qu'un point non expliqué soit pris pour l'un d'eux. */
      L.circleMarker([centre.lat, centre.lng], {
        radius: 6,
        color: "#ffffff",
        weight: 2,
        fillColor: "#0d2b26",
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip("Votre domicile");

      carte.current = map;
      setPret(true);

      if (zoneInitiale && zoneInitiale.length >= 3) {
        dessinerLe(L, map, zoneInitiale);
        const boite = cadre(zoneInitiale);
        if (boite) {
          map.fitBounds(
            [
              [boite.sud, boite.ouest],
              [boite.nord, boite.est],
            ],
            { padding: [24, 24] },
          );
        }
      }
    });

    return () => {
      vivante = false;
      carte.current?.remove();
      carte.current = null;
    };
    // Le centre et la zone initiale ne changent pas de la vie du composant :
    // les relire relancerait le montage de la carte à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Le cercle suit le curseur, et disparaît dès qu'une zone existe : deux
   * périmètres dessinés en même temps demanderaient de deviner lequel
   * s'applique.
   */
  useEffect(() => {
    const map = carte.current;
    if (!map || !pret) return;

    if (zone) {
      cercle.current?.remove();
      cercle.current = null;
      return;
    }

    let vivante = true;
    void import("leaflet").then((L) => {
      if (!vivante || !carte.current) return;
      cercle.current?.remove();
      cercle.current = L.circle([centre.lat, centre.lng], {
        radius: rayon * 1000,
        color: "#069494",
        weight: 2,
        dashArray: "6 4",
        fillColor: "#069494",
        fillOpacity: 0.12,
      }).addTo(carte.current);

      /* Le cadrage suit le cercle. Sans cela, un rayon de vingt kilomètres
         déborde de la vue au zoom de départ : on ne voit qu'un arc au coin de
         l'écran, et le réglage semble ne rien faire. Sans animation, parce
         que le curseur émet un changement par pas et qu'une transition par
         pas rendrait la carte ivre. */
      carte.current.fitBounds(cercle.current.getBounds(), {
        padding: [12, 12],
        animate: false,
      });
    });

    return () => {
      vivante = false;
    };
  }, [rayon, zone, pret, centre.lat, centre.lng]);

  function dessinerLe(
    L: typeof import("leaflet"),
    map: LeafletMap,
    points: readonly PointZone[],
  ) {
    trace.current?.remove();
    trace.current = L.polygon(
      points.map((point) => [point.lat, point.lng] as [number, number]),
      {
        color: "#069494",
        weight: 3,
        fillColor: "#069494",
        fillOpacity: 0.18,
      },
    ).addTo(map);
  }

  /* --- Tracé -------------------------------------------------------------- */

  function commencer(event: React.PointerEvent<HTMLDivElement>) {
    const map = carte.current;
    if (!dessine || !map) return;
    /* La capture garde les mouvements même quand le doigt sort du cadre —
       ce qui arrive à chaque tracé qui frôle un bord. Elle échoue sur un
       pointeur synthétique, et ce n'est pas une raison d'interrompre le
       tracé : le geste fonctionne sans, il est seulement moins tolérant. */
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointeur non capturable : on dessine quand même.
    }
    enCours.current = [pointDeLEvenement(event)];
    setErreur(null);
    setApercu(null);
  }

  function continuer(event: React.PointerEvent<HTMLDivElement>) {
    if (!dessine || enCours.current.length === 0) return;
    enCours.current.push(pointDeLEvenement(event));
    if (enCours.current.length % 4 === 0) {
      setApercu(chemin(enCours.current, event.currentTarget));
    }
  }

  function terminer(event: React.PointerEvent<HTMLDivElement>) {
    const map = carte.current;
    if (!dessine || !map || enCours.current.length === 0) return;

    const brut = enCours.current;
    enCours.current = [];
    setApercu(null);
    setDessine(false);
    map.dragging.enable();

    const simple = simplifier(brut);
    const faute = verifierLaZone(simple);
    if (faute) {
      setErreur(MESSAGES_ZONE[faute]);
      return;
    }

    void import("leaflet").then((L) => dessinerLe(L, map, simple));
    setZone(simple);
  }

  function pointDeLEvenement(
    event: React.PointerEvent<HTMLDivElement>,
  ): PointZone {
    const map = carte.current!;
    const boite = event.currentTarget.getBoundingClientRect();
    const { lat, lng } = map.containerPointToLatLng([
      event.clientX - boite.left,
      event.clientY - boite.top,
    ]);
    return { lat, lng };
  }

  function chemin(points: PointZone[], noeud: HTMLDivElement): string {
    const map = carte.current!;
    const boite = noeud.getBoundingClientRect();
    return points
      .map((point, index) => {
        const p = map.latLngToContainerPoint([point.lat, point.lng]);
        void boite;
        return `${index === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      })
      .join(" ");
  }

  /* --- Rendu -------------------------------------------------------------- */

  const mesuree = couverture(
    communes,
    zone ? { zone } : { centre, rayonKm: rayon },
  );
  const couvertes = mesuree
    .filter((entree) => entree.couverte)
    .sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  const exclues = mesuree
    .filter((entree) => !entree.couverte)
    .sort((a, b) => (a.km ?? 0) - (b.km ?? 0));

  return (
    <div>
      <div className="relative overflow-hidden rounded-[var(--r-l)] border border-border">
        <div ref={conteneur} className="h-[420px] w-full" />

        {/* La couche de dessin ne capte les gestes qu'en mode tracé : sinon
            elle empêcherait de déplacer la carte, qui est en dessous. */}
        <div
          className={`absolute inset-0 z-[500] ${
            dessine ? "cursor-crosshair touch-none" : "pointer-events-none"
          }`}
          onPointerDown={commencer}
          onPointerMove={continuer}
          onPointerUp={terminer}
          onPointerCancel={terminer}
        >
          {apercu ? (
            <svg className="h-full w-full" aria-hidden>
              <path
                d={apercu}
                fill="rgba(6,148,148,0.18)"
                stroke="#069494"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </div>

        {dessine ? (
          <p
            role="status"
            className="absolute inset-x-0 top-0 z-[600] bg-ink-900/90 px-4 py-2 text-center text-sm font-semibold text-white"
          >
            Faites le tour de votre zone sans lever le doigt.
          </p>
        ) : null}
      </div>

      {!pret ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Chargement de la carte…
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={zone ? "outline" : "default"}
          onClick={() => {
            setErreur(null);
            setDessine(true);
            carte.current?.dragging.disable();
          }}
          disabled={dessine || !pret}
        >
          <PencilIcon aria-hidden />
          {zone ? "Redessiner ma zone" : "Dessiner ma zone"}
        </Button>

        {zone ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setPending(true);
              void effacerLaZone()
                .then((resultat) => {
                  if (!resultat.ok) {
                    setErreur(resultat.error ?? "Suppression refusée.");
                    return;
                  }
                  trace.current?.remove();
                  trace.current = null;
                  setZone(null);
                })
                .finally(() => setPending(false));
            }}
          >
            <Trash2Icon aria-hidden />
            Revenir au rayon
          </Button>
        ) : null}
      </div>

      {erreur ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {erreur}
        </p>
      ) : null}

      {zone ? (
        <>
          <p role="status" className="mt-4 text-pretty">
            Zone dessinée, {Math.round(aireKm2(zone))} km². Aucune mission ne
            vous est proposée en dehors — même un jour où votre planning est
            vide.
          </p>
          <Button
            size="lg"
            className="mt-4 w-full"
            disabled={pending}
            onClick={() => {
              setPending(true);
              setErreur(null);
              void enregistrerLaZone(zone)
                .then((resultat) => {
                  if (!resultat.ok) {
                    setErreur(resultat.error ?? "Enregistrement refusé.");
                  }
                })
                .finally(() => setPending(false));
            }}
          >
            {pending ? (
              <Loader2Icon className="animate-spin" aria-hidden />
            ) : null}
            Enregistrer ma zone
          </Button>
        </>
      ) : (
        <>
          <label className="mt-6 block">
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-medium">Rayon autour de chez vous</span>
              <span className="font-mono text-lg font-bold">{rayon} km</span>
            </span>
            <input
              type="range"
              className="range-slider mt-3"
              min={RAYON_MIN_KM}
              max={RAYON_MAX_KM}
              step={RAYON_PAS_KM}
              value={rayon}
              onChange={(event) => {
                setErreur(null);
                setRayon(Number(event.target.value));
              }}
              aria-label="Rayon d'action, en kilomètres"
            />
            <span
              className="mt-2 flex justify-between font-mono text-xs text-muted-foreground"
              aria-hidden
            >
              <span>{RAYON_MIN_KM} km</span>
              <span>{RAYON_MAX_KM} km</span>
            </span>
          </label>

          {!adresseConnue ? (
            <p className="mt-3 text-sm text-pretty text-muted-foreground">
              Votre adresse n&apos;est pas encore renseignée : la carte est
              centrée sur Léognan, et votre rayon ne filtrera rien tant
              qu&apos;elle manque. Une zone dessinée, elle, s&apos;applique tout
              de suite.
            </p>
          ) : null}

          <Button
            size="lg"
            className="mt-4 w-full"
            disabled={pending || rayon === rayonEnregistre}
            onClick={() => {
              setPending(true);
              setErreur(null);
              void enregistrerLeRayon(rayon)
                .then((resultat) => {
                  if (!resultat.ok) {
                    setErreur(resultat.error ?? "Enregistrement refusé.");
                    return;
                  }
                  setRayonEnregistre(rayon);
                })
                .finally(() => setPending(false));
            }}
          >
            {pending ? (
              <Loader2Icon className="animate-spin" aria-hidden />
            ) : null}
            {rayon === rayonEnregistre
              ? "Rayon enregistré"
              : `Enregistrer ${rayon} km`}
          </Button>
        </>
      )}

      {/*
       * **La liste répond, la carte montre.** « Est-ce que je couvre
       * Cadaujac ? » se répond en lisant un nom, pas en visant un point sur un
       * fond de plan. Elle est calculée par la même fonction que le moteur,
       * dans les deux régimes : un écran qui promettrait une commune que le
       * moteur refuse ferait douter du réglage entier.
       */}
      <ul className="mt-5 flex flex-wrap gap-1.5">
        {couvertes.map(({ commune, km }) => (
          <li
            key={commune.slug}
            className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-ink-900"
          >
            {commune.name}
            {km === null ? null : (
              <span className="ml-1 font-mono font-normal text-teal-800">
                {Math.round(km)} km
              </span>
            )}
          </li>
        ))}
        {exclues.map(({ commune }) => (
          <li
            key={commune.slug}
            className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground line-through"
          >
            {commune.name}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted-foreground">
        {couvertes.length === 0
          ? `Aucune de nos ${communes.length} communes n'est couverte : vous ne recevrez aucune proposition.`
          : `${couvertes.length} de nos ${communes.length} communes sont couvertes.`}
      </p>
    </div>
  );
}
