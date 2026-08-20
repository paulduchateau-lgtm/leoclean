import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { chargerLaJournee } from "@/lib/assignments/journee";
import { getCurrentUser, requireOrganization } from "@/lib/auth/session";
import { marketplaceOrganizationId } from "@/lib/organizations";
import { formatEuros } from "@/lib/pricing";
import { SITE } from "@/lib/site";

/**
 * Aujourd'hui.
 *
 * L'écran le plus employé du produit. Il répond à trois questions d'un coup
 * d'œil : *où je vais maintenant*, *combien je gagne aujourd'hui*, *qu'est-ce
 * qui a changé*.
 *
 * **L'ordre affiché est suggéré, jamais imposé.** C'est écrit noir sur blanc,
 * et ce n'est pas une préférence de ton : un logiciel qui ordonne la journée
 * d'un indépendant est un indice de subordination s'il le subit, et n'en est
 * pas un s'il le pilote. Aucune alerte ne se déclenche si la personne change
 * l'ordre, et aucun score n'en souffre.
 */

export const metadata: Metadata = {
  title: "Aujourd'hui",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const HEURE = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const JOUR = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

function dureeLisible(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export default async function AujourdhuiPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?callbackUrl=/intervenant/aujourdhui");

  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(organizationId, "assignment:read:own");

  const profil = await db.cleanerProfile.findFirst({
    where: { userId: user.id },
    select: { id: true, displayName: true },
  });

  if (!profil) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Aujourd&apos;hui
        </h1>
        <p className="mt-4 rounded-xl border border-border bg-secondary/40 p-5 text-muted-foreground">
          Votre compte n&apos;est pas rattaché à un profil d&apos;intervenant.
          Appelez-nous au {SITE.phone}.
        </p>
      </main>
    );
  }

  const maintenant = new Date();
  const journee = await chargerLaJournee(db, profil.id, maintenant);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <p className="text-sm">
        <Link href="/intervenant" className="text-primary hover:underline">
          ← Toutes mes missions
        </Link>
      </p>

      <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight first-letter:uppercase">
        {JOUR.format(maintenant)}
      </h1>

      {journee.etapes.length === 0 ? (
        /*
         * Toujours une sortie active, jamais un écran mort : quelqu'un qui
         * ouvre l'application un jour vide doit repartir avec quelque chose à
         * faire, sinon il ne la rouvre pas.
         */
        <div className="mt-6 rounded-2xl border border-border bg-secondary/40 p-6">
          <p className="font-semibold">Rien aujourd&apos;hui.</p>
          <p className="mt-2 text-muted-foreground">
            C&apos;est en élargissant vos heures déclarées que vous recevrez
            davantage de propositions.
          </p>
          <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <Link
              href="/intervenant/disponibilites"
              className="text-primary hover:underline"
            >
              Mes disponibilités →
            </Link>
            <Link
              href="/intervenant"
              className="text-primary hover:underline"
            >
              Voir les propositions →
            </Link>
          </p>
        </div>
      ) : (
        <>
          {journee.maintenant ? (
            <section className="mt-6 rounded-2xl border-2 border-brand bg-card p-5">
              <p className="font-mono text-sm text-muted-foreground">
                {journee.maintenant.arrivee ? "En cours" : "Prochaine"}
              </p>
              <p className="mt-1 font-heading text-2xl font-extrabold">
                {HEURE.format(new Date(journee.maintenant.debut))} ·{" "}
                {journee.maintenant.clientPrenom ?? journee.maintenant.commune}
              </p>
              <p className="mt-1 text-muted-foreground">
                {journee.maintenant.adresse}
              </p>
              <p className="mt-1 font-mono text-sm text-muted-foreground">
                {dureeLisible(journee.maintenant.dureeMinutes)} ·{" "}
                {formatEuros(journee.maintenant.remunerationCents)} ·{" "}
                {journee.maintenant.trajetAvantMinutes} min de route
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/intervenant/mission/${journee.maintenant.bookingId}`}
                  className="inline-flex min-h-12 items-center rounded-full bg-primary px-5 font-semibold text-primary-foreground"
                >
                  {journee.maintenant.arrivee
                    ? "Terminer la mission"
                    : "Je suis arrivée"}
                </Link>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(journee.maintenant.adresse ?? "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center rounded-full border border-input px-5"
                >
                  Itinéraire
                </a>
              </div>
            </section>
          ) : (
            <p className="mt-6 rounded-2xl border border-success/40 bg-success/10 p-5 font-semibold">
              Journée terminée. Tout est pointé.
            </p>
          )}

          <section className="mt-8">
            <h2 className="font-heading text-lg font-semibold">
              La suite de la tournée
            </h2>
            {/*
              * La mention n'est pas décorative : un ordre imposé serait un
              * indice de subordination. Elle est écrite là où l'ordre s'affiche.
              */}
            <p className="mt-1 text-sm text-muted-foreground">
              Ordre suggéré — vous restez libre de votre organisation.
            </p>

            <ol className="mt-4 space-y-3">
              {journee.etapes.map((etape) => (
                <li
                  key={etape.bookingId}
                  className={`rounded-xl border p-4 ${
                    etape.depart
                      ? "border-border bg-secondary/30 opacity-70"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-mono font-semibold">
                      {HEURE.format(new Date(etape.debut))} –{" "}
                      {HEURE.format(new Date(etape.fin))}
                    </p>
                    <p className="font-mono text-sm text-muted-foreground">
                      {formatEuros(etape.remunerationCents)}
                    </p>
                  </div>
                  <p className="mt-1">
                    {etape.clientPrenom ? `${etape.clientPrenom} · ` : ""}
                    {etape.commune}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {etape.trajetAvantMinutes} min de route
                    {etape.depart
                      ? ` · terminée à ${HEURE.format(new Date(etape.depart))}`
                      : etape.arrivee
                        ? ` · arrivée à ${HEURE.format(new Date(etape.arrivee))}`
                        : ""}
                  </p>
                  {!etape.depart ? (
                    <p className="mt-2 text-sm">
                      <Link
                        href={`/intervenant/mission/${etape.bookingId}`}
                        className="text-primary hover:underline"
                      >
                        Ouvrir la mission →
                      </Link>
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>

            {journee.trous.length > 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-input bg-secondary/30 p-4">
                <p className="font-semibold">
                  {journee.trous.length === 1
                    ? "Un trou dans votre journée"
                    : `${journee.trous.length} trous dans votre journée`}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {journee.trous.map((trou) => (
                    <li key={trou.apres}>
                      {dureeLisible(trou.minutes)} entre{" "}
                      {HEURE.format(new Date(trou.apres))} et{" "}
                      {HEURE.format(new Date(trou.avant))}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm">
                  <Link
                    href="/intervenant"
                    className="text-primary hover:underline"
                  >
                    Voir les missions disponibles →
                  </Link>
                </p>
              </div>
            ) : null}
          </section>

          <p
            data-donnee
            className="mt-8 rounded-xl border border-border bg-card p-4 text-center font-mono"
          >
            {journee.etapes.length} mission
            {journee.etapes.length > 1 ? "s" : ""} ·{" "}
            {dureeLisible(journee.totalMinutes)} ·{" "}
            {formatEuros(journee.totalCents)}
          </p>
        </>
      )}
    </main>
  );
}
