import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MissionProposeeCarte } from "@/app/(app)/intervenant/mission-proposee";
import { EspaceFerme } from "@/components/espace-ferme";
import { chargerMissions } from "@/lib/assignments/repository";
import { espaceIntervenant } from "@/lib/auth/espaces";
import { VOCABULAIRE_GEL } from "@/lib/paiement/recouvrement";
import { formatEuros } from "@/lib/pricing";

/**
 * Espace intervenant : les missions.
 *
 * Deux listes, dans l'ordre de l'urgence. Les propositions d'abord — elles ont
 * un délai de réponse qui court, et c'est la seule chose que l'intervenant doit
 * faire aujourd'hui. Les missions acceptées ensuite, avec ce qu'il faut pour
 * s'y rendre.
 */

export const metadata: Metadata = {
  title: "Mes missions",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const jourHeure = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

function dureeLisible(minutes: number): string {
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  if (heures === 0) return `${reste} min`;
  return reste === 0 ? `${heures} h` : `${heures} h ${reste}`;
}

export default async function MissionsPage() {
  /*
   * `espaceIntervenant` remplace le couple `requireOrganization` + lecture du
   * profil. La différence n'est pas cosmétique : `requireOrganization` **lève**
   * quand l'appartenance manque, et l'exception remontait jusqu'au rendu — un
   * client qui ouvrait cette adresse recevait une erreur 500, c'est-à-dire un
   * site en panne, là où la réponse juste tient en une phrase.
   */
  const espace = await espaceIntervenant();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect("/connexion?callbackUrl=/intervenant");
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/travailler-avec-nous", libelle: "Nous rejoindre" }}
      />
    );
  }

  const { db, profil } = espace;
  const { propositions, aVenir } = await chargerMissions(db, profil.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Bonjour {profil.displayName}
      </h1>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <Link
          href="/intervenant/aujourdhui"
          className="font-semibold text-brand hover:underline"
        >
          Aujourd&apos;hui →
        </Link>
        <Link
          href="/intervenant/disponibilites"
          className="text-brand hover:underline"
        >
          Mes disponibilités →
        </Link>
        <Link
          href="/intervenant/absences"
          className="text-brand hover:underline"
        >
          Mes absences →
        </Link>
        <Link
          href="/intervenant/messages"
          className="text-brand hover:underline"
        >
          Mes messages →
        </Link>
        <Link
          href="/intervenant/revenus"
          className="text-brand hover:underline"
        >
          Mes revenus →
        </Link>
        <Link
          href="/intervenant/factures"
          className="text-brand hover:underline"
        >
          Mes factures →
        </Link>
        <Link
          href="/intervenant/cooptation"
          className="text-brand hover:underline"
        >
          Coopter →
        </Link>
      </p>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-semibold">
          {propositions.length === 0
            ? "Aucune mission à valider"
            : propositions.length === 1
              ? "Une mission vous attend"
              : `${propositions.length} missions vous attendent`}
        </h2>

        {propositions.length === 0 ? (
          <p className="mt-3 rounded-xl border border-border bg-secondary/40 p-5 text-sm text-muted-foreground">
            Rien à valider pour le moment. Vos disponibilités déclarées font le
            reste : c&apos;est en les élargissant que vous recevrez davantage de
            propositions.
          </p>
        ) : (
          <div className="mt-5 space-y-5">
            {propositions.map((mission) => (
              <MissionProposeeCarte
                key={mission.assignmentId}
                mission={mission}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-14">
        <h2 className="font-heading text-xl font-semibold">
          Mes prochains ménages
        </h2>

        {aVenir.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Aucune mission acceptée à venir.
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {aVenir.map((mission) => (
              <li
                key={mission.assignmentId}
                className={`rounded-2xl border bg-card p-5 ${
                  mission.gelee ? "border-warning" : "border-border"
                }`}
              >
                <p className="font-heading text-lg font-semibold first-letter:uppercase">
                  {jourHeure.format(new Date(mission.debut))}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {dureeLisible(mission.dureeMinutes)} ·{" "}
                  {formatEuros(mission.remunerationCents)} pour vous
                </p>

                {/*
                  Le gel se lit avant l'adresse et avant le lien vers l'écran
                  de travail : à 8 h du matin, quelqu'un qui cherche où aller ne
                  doit pas découvrir en bas de carte qu'il ne faut pas y aller.
                  Le libellé vient du module pur — le back-office compte les
                  mêmes gels avec la même règle.
                */}
                {mission.gelee && (
                  <div className="mt-4 rounded-xl border border-warning bg-warning/10 p-4">
                    <p className="font-semibold">{VOCABULAIRE_GEL.titre}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {VOCABULAIRE_GEL.explication}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {VOCABULAIRE_GEL.geste}
                    </p>
                  </div>
                )}

                {/*
                 * L'écran de travail est le geste du jour même : il porte le
                 * pointage, la checklist et le code d'accès. Il est en tête de
                 * carte parce qu'à 8 h du matin, c'est la seule chose qu'on
                 * cherche.
                 */}
                <p className="mt-3">
                  <Link
                    href={`/intervenant/mission/${mission.bookingId}`}
                    className="font-semibold text-brand hover:underline"
                  >
                    Ouvrir la mission →
                  </Link>
                </p>

                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Adresse</dt>
                    <dd className="mt-0.5 font-medium">
                      {mission.adresseComplete}
                    </dd>
                  </div>
                  {mission.clientPrenom ? (
                    <div>
                      <dt className="text-muted-foreground">Chez</dt>
                      <dd className="mt-0.5 font-medium">
                        {mission.clientPrenom}
                      </dd>
                    </div>
                  ) : null}
                  {mission.consignes.length > 0 ? (
                    <div>
                      <dt className="font-medium">Consignes du logement</dt>
                      <dd className="mt-1 space-y-0.5 text-muted-foreground">
                        {mission.consignes.map((consigne) => (
                          <p key={`${consigne.rubrique}-${consigne.sujet}`}>
                            {consigne.sujet} : {consigne.reponse}
                          </p>
                        ))}
                      </dd>
                    </div>
                  ) : null}

                  {mission.accessNotes ? (
                    <div>
                      <dt className="text-muted-foreground">Pour entrer</dt>
                      <dd className="mt-0.5 text-pretty">
                        {mission.accessNotes}
                      </dd>
                    </div>
                  ) : null}
                  {mission.clientNotes ? (
                    <div>
                      <dt className="text-muted-foreground">
                        Priorités du client
                      </dt>
                      <dd className="mt-0.5 text-pretty">
                        {mission.clientNotes}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
