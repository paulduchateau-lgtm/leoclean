import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { chargerLeRadar } from "@/lib/administration/radar";
import { SLA_HEURES } from "@/lib/administration/file-actions";
import { asPlatformAdmin, getCurrentUser } from "@/lib/auth/session";
import { formatEuros } from "@/lib/pricing";

/**
 * Le Radar : ce qui va casser aujourd'hui.
 *
 * La question à laquelle cet écran répond en dix secondes, chaque matin, est
 * *qu'est-ce qui exige une décision maintenant*. Toute métrique qui ne débouche
 * pas sur une action en est retirée — une page qui affiche des courbes se
 * consulte une fois, une page qui dit ce qui attend s'ouvre tous les jours.
 *
 * **Chaque ligne porte son motif en langage clair.** « 3 annulations en
 * 60 jours » se traite ; « score 72 » ne se traite pas. C'est la règle qui rend
 * l'écran utilisable au lieu d'impressionnant, et un test la tient sur le
 * module qui compose la file.
 */

export const metadata: Metadata = {
  title: "Radar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const HEURE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const COULEURS: Record<string, string> = {
  P0: "border-destructive/60 bg-destructive/10 text-destructive",
  P1: "border-warning/60 bg-warning/10",
  P2: "border-border bg-secondary/40",
  P3: "border-border bg-secondary/20",
};

function retardLisible(echeance: Date, maintenant: Date): string | null {
  const minutes = Math.round(
    (maintenant.getTime() - echeance.getTime()) / 60_000,
  );
  if (minutes <= 0) return null;
  if (minutes < 60) return `en retard de ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 48) return `en retard de ${heures} h`;
  return `en retard de ${Math.round(heures / 24)} j`;
}

export default async function RadarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?callbackUrl=/administration/radar");

  try {
    await asPlatformAdmin();
  } catch {
    notFound();
  }

  const maintenant = new Date();
  const radar = await chargerLeRadar(maintenant);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-heading text-2xl font-black tracking-tight">
          Radar
        </h1>
        <p className="text-sm">
          <Link href="/administration" className="text-primary hover:underline">
            Les quatre listes →
          </Link>
        </p>
      </div>

      {/*
       * La barre de vitalité, en une ligne dense. Elle remplace un tableau de
       * quarante lignes : ce qu'on cherche le matin, c'est de savoir si la
       * journée tient, pas de la lire mission par mission.
       */}
      <div
        data-donnee
        className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card px-4 py-3 text-sm"
      >
        <span className="font-semibold">Aujourd&apos;hui</span>
        <span>{radar.journee.total} missions</span>
        <span>{radar.journee.terminees} terminées</span>
        <span>{radar.journee.enCours} en cours</span>
        <span>{radar.journee.aVenir} à venir</span>
        <span
          className={
            radar.journee.sansIntervenant > 0
              ? "font-semibold text-destructive"
              : ""
          }
        >
          {radar.journee.sansIntervenant} sans intervenant
        </span>
        <span className="ml-auto font-semibold">
          {formatEuros(radar.journee.caCents)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        {(["P0", "P1", "P2", "P3"] as const).map((priorite) => (
          <span
            key={priorite}
            data-donnee
            className={`rounded-md border px-3 py-1 ${COULEURS[priorite]}`}
          >
            {/*
             * Le séparateur est explicite : sans lui, « P0 · 1 » suivi de
             * « 1 h » se lit « P0 · 11 h », et un opérateur qui compte ses
             * urgences du matin lit un nombre faux.
             */}
            {priorite} · {radar.compte[priorite]}
            <span className="ml-2 opacity-70">
              {"— "}
              {SLA_HEURES[priorite]} h
            </span>
          </span>
        ))}
        {radar.retards.length > 0 ? (
          <span
            data-donnee
            className="rounded-md border border-destructive/60 bg-destructive/10 px-3 py-1 font-semibold text-destructive"
          >
            {radar.retards.length} hors délai
          </span>
        ) : null}
      </div>

      <h2 className="mt-8 font-heading text-lg font-bold">
        {radar.file.length === 0
          ? "Rien n'attend"
          : `${radar.file.length} décision${radar.file.length > 1 ? "s" : ""} à prendre`}
      </h2>

      {radar.file.length === 0 ? (
        <p className="mt-2 rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          Aucun élément ne demande d&apos;intervention humaine. C&apos;est
          l&apos;objectif : cette file se vide, elle ne s&apos;administre pas.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
          {radar.file.map((element) => {
            const retard = retardLisible(element.echeance, maintenant);
            return (
              <li
                key={`${element.type}-${element.entiteId}`}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 p-3"
              >
                <span
                  data-donnee
                  className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${COULEURS[element.priorite]}`}
                >
                  {element.priorite}
                </span>
                <span className="font-semibold">{element.titre}</span>
                <span className="text-sm text-muted-foreground">
                  {element.motif}
                </span>
                <span
                  data-donnee
                  className={`ml-auto text-xs ${retard ? "font-semibold text-destructive" : "text-muted-foreground"}`}
                >
                  {retard ?? `avant ${HEURE.format(element.echeance)}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/*
       * L'écran désigne le travail ; il ne le fait pas encore. C'est dit
       * plutôt que sous-entendu : un opérateur qui cherche un bouton absent
       * perd plus de temps qu'un opérateur prévenu.
       */}
      <p className="mt-6 max-w-prose text-sm text-muted-foreground">
        Cet écran est en lecture seule. Réaffecter une mission, relancer une
        proposition ou arbitrer un ajustement se fait encore à la main — les
        actions viendront s&apos;attacher à ces lignes.
      </p>
    </main>
  );
}
