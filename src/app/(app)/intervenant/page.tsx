import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MissionProposeeCarte } from "@/app/(app)/intervenant/mission-proposee";
import { chargerMissions } from "@/lib/assignments/repository";
import { getCurrentUser, requireOrganization } from "@/lib/auth/session";
import { marketplaceOrganizationId } from "@/lib/organizations";
import { formatEuros } from "@/lib/pricing";
import { SITE } from "@/lib/site";

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
  const user = await getCurrentUser();
  if (!user) {
    redirect("/connexion?callbackUrl=/intervenant");
  }

  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(
    organizationId,
    "assignment:read:own",
  );

  const profil = await db.cleanerProfile.findFirst({
    where: { userId: user.id },
    select: { id: true, displayName: true },
  });

  if (!profil) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Espace intervenant
        </h1>
        <p className="mt-4 rounded-xl border border-border bg-secondary/40 p-5 text-muted-foreground">
          Votre compte n&apos;est pas encore rattaché à un profil
          d&apos;intervenant. Si vous pensez qu&apos;il s&apos;agit d&apos;une
          erreur, appelez-nous au {SITE.phone}.
        </p>
      </main>
    );
  }

  const { propositions, aVenir } = await chargerMissions(db, profil.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Bonjour {profil.displayName}
      </h1>
      <p className="mt-3 text-sm">
        <Link
          href="/intervenant/disponibilites"
          className="text-primary hover:underline"
        >
          Mes disponibilités →
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
                className="rounded-2xl border border-border bg-card p-5"
              >
                <p className="font-heading text-lg font-semibold first-letter:uppercase">
                  {jourHeure.format(new Date(mission.debut))}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {dureeLisible(mission.dureeMinutes)} ·{" "}
                  {formatEuros(mission.remunerationCents)} pour vous
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
