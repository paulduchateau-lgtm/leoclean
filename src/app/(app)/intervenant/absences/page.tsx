import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AbsenceForm,
  RetraitAbsence,
} from "@/app/(app)/intervenant/absences/absences-form";
import { EspaceFerme } from "@/components/espace-ferme";
import { espaceIntervenant } from "@/lib/auth/espaces";
import { absencesVivantes, recouvre } from "@/lib/availability/absences";
import { SITE } from "@/lib/site";

/**
 * Les absences déclarées d'un intervenant.
 *
 * Le moteur les lisait déjà et les faisait gagner sur les ouvertures
 * exceptionnelles ; il manquait l'écran par lequel elles entrent en base. Sans
 * lui, un congé se vivait en refusant une à une des missions qu'on n'aurait
 * jamais dû recevoir.
 *
 * L'écran ne retire aucune mission déjà acceptée, et il le dit. Une absence
 * change ce qui sera proposé ; se retirer d'un engagement pris est une autre
 * décision, qui regarde aussi le client.
 */

export const metadata: Metadata = {
  title: "Mes absences",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "Europe/Paris",
});

const DATE_HEURE = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export default async function AbsencesPage() {
  /*
   * `espaceIntervenant` traduit l'absence d'appartenance en résultat
   * plutôt qu'en exception : `requireOrganization` lève, et l'exception
   * remontait jusqu'au rendu — une erreur 500 sur un état parfaitement
   * ordinaire du produit.
   */
  const espace = await espaceIntervenant();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect("/connexion?callbackUrl=/intervenant/absences");
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/travailler-avec-nous", libelle: "Nous rejoindre" }}
      />
    );
  }

  const { db, profil } = espace;

  const maintenant = new Date();

  const lignes = await db.availabilityException.findMany({
    where: { cleanerProfileId: profil.id, type: "UNAVAILABLE" },
    orderBy: { startAt: "asc" },
    select: { id: true, startAt: true, endAt: true, reason: true },
  });

  const vivantes = absencesVivantes(
    lignes.map((ligne) => ({
      id: ligne.id,
      debut: ligne.startAt,
      fin: ligne.endAt,
      motif: ligne.reason,
    })),
    maintenant,
  );

  /*
   * Les missions déjà acceptées, chargées une fois puis rapprochées en mémoire :
   * la liste tient dans quelques dizaines de lignes, et une requête par absence
   * coûterait davantage qu'elle ne rapporterait.
   */
  const missions = await db.assignment.findMany({
    where: {
      cleanerProfileId: profil.id,
      status: "ACCEPTED",
      endAt: { gt: maintenant },
    },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      booking: { select: { address: { select: { cityName: true } } } },
    },
  });

  const avecMissions = vivantes.map((absence) => ({
    ...absence,
    missions: missions
      .filter((mission) =>
        recouvre(absence, { debut: mission.startAt, fin: mission.endAt }),
      )
      .map((mission) => ({
        id: mission.id,
        quand: DATE_HEURE.format(mission.startAt),
        commune: mission.booking.address.cityName,
      })),
  }));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <p className="text-sm">
        <Link href="/intervenant" className="text-primary hover:underline">
          ← Mes missions
        </Link>
      </p>

      <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">
        Mes absences
      </h1>
      <p className="mt-3 max-w-prose text-muted-foreground">
        Sur ces périodes, vous ne recevrez aucune proposition. Aucune
        justification n&apos;est demandée, et personne d&apos;autre ne peut les
        modifier.
      </p>

      <section className="mt-8" aria-labelledby="absences-posees">
        <h2 id="absences-posees" className="font-heading text-xl font-semibold">
          Périodes déclarées
        </h2>

        {avecMissions.length === 0 ? (
          <p className="mt-3 rounded-xl border border-border bg-secondary/40 p-5 text-muted-foreground">
            Aucune absence à venir. Vous recevrez des propositions sur toutes
            vos heures déclarées.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {avecMissions.map((absence) => (
              <li
                key={absence.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-sm font-semibold">
                    Du {DATE_LONGUE.format(absence.debut)} au{" "}
                    {DATE_LONGUE.format(
                      new Date(absence.fin.getTime() - 60_000),
                    )}
                  </p>
                  <RetraitAbsence absenceId={absence.id} />
                </div>

                {absence.motif ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {absence.motif}
                  </p>
                ) : null}

                {absence.missions.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                    <p className="font-semibold">
                      {absence.missions.length === 1
                        ? "Une mission déjà acceptée tombe sur cette période."
                        : `${absence.missions.length} missions déjà acceptées tombent sur cette période.`}
                    </p>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      {absence.missions.map((mission) => (
                        <li key={mission.id}>
                          {mission.quand} — {mission.commune}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-muted-foreground">
                      Une absence ne les annule pas : le client compte sur vous.
                      Appelez-nous au {SITE.phone} et nous cherchons
                      quelqu&apos;un d&apos;autre.
                    </p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="poser-absence">
        <h2 id="poser-absence" className="font-heading text-xl font-semibold">
          Déclarer une absence
        </h2>
        <div className="mt-3">
          <AbsenceForm
            existantes={vivantes.map((absence) => ({
              debut: absence.debut.toISOString(),
              fin: absence.fin.toISOString(),
            }))}
          />
        </div>
      </section>
    </main>
  );
}
