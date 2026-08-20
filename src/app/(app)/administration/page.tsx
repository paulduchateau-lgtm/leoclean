import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Geste } from "@/app/(app)/administration/geste";
import { chargerTableauDeBord } from "@/lib/administration/tableau-de-bord";
import { asPlatformAdmin, getCurrentUser } from "@/lib/auth/session";
import { formatEuros } from "@/lib/pricing";
import { getCommuneByInsee } from "@/lib/territory";

/**
 * Back-office plateforme.
 *
 * Il ne montre pas des indicateurs mais du travail à faire : quatre listes,
 * chacune correspondant à une situation où l'absence d'intervention humaine se
 * paie. Une page d'administration qui affiche des courbes se consulte une fois
 * ; une page qui dit ce qui attend s'ouvre tous les matins.
 *
 * `asPlatformAdmin()` est le seul chemin qui franchit la frontière d'une
 * organisation, et il lève pour tout le monde sauf un administrateur
 * plateforme. La vérification est faite ici, à l'entrée, où elle se lit.
 */

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const jourHeure = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const jour = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});

function Section({
  titre,
  vide,
  urgence,
  children,
}: {
  titre: string;
  vide: string;
  urgence?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2
        className={`font-heading text-xl font-semibold ${urgence ? "text-destructive" : ""}`}
      >
        {titre}
      </h2>
      {children ?? null}
      <p className="sr-only">{vide}</p>
    </section>
  );
}

export default async function AdministrationPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/connexion?callbackUrl=/administration");
  }

  /*
   * `asPlatformAdmin()` lève pour quiconque n'est pas administrateur. Laisser
   * cette exception remonter produisait une erreur 500 : une autorisation
   * refusée n'est pas une panne, et l'écran le disait mal.
   *
   * On répond 404 plutôt que 403, comme `requireOrganizationBySlug` le fait
   * déjà : distinguer « vous n'avez pas le droit » de « cela n'existe pas »
   * confirme à un curieux l'existence de la page.
   */
  try {
    await asPlatformAdmin();
  } catch {
    notFound();
  }

  const tableau = await chargerTableauDeBord();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Ce qui attend
      </h1>
      <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <Link
          href="/administration/radar"
          className="font-semibold text-primary hover:underline"
        >
          Ouvrir le Radar →
        </Link>
        <Link
          href="/administration/candidatures"
          className="text-primary hover:underline"
        >
          Candidatures →
        </Link>
        <Link
          href="/administration/reclamations"
          className="text-primary hover:underline"
        >
          Réclamations →
        </Link>
      </p>
      <p className="mt-3 max-w-prose text-muted-foreground">
        Quatre situations que rien ne rattrape tout seul. Les trois premières se
        traitent ici : relancer rejoue le moteur d&apos;attribution, avec les
        mêmes plannings et les mêmes trajets réels.
      </p>

      <Section
        titre={`Réservations sans intervenant (${tableau.reservationsOrphelines.length})`}
        vide="Aucune réservation sans intervenant."
        urgence={tableau.reservationsOrphelines.length > 0}
      >
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Le moteur n&apos;a trouvé personne, ou le dernier intervenant a
          refusé. Un client attend une réponse.
        </p>
        {tableau.reservationsOrphelines.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Rien à reprendre.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {tableau.reservationsOrphelines.map((reservation) => (
              <li
                key={reservation.bookingId}
                className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
              >
                <p className="font-medium first-letter:uppercase">
                  {jourHeure.format(reservation.debut)} · {reservation.commune}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {reservation.organisation} ·{" "}
                  {formatEuros(reservation.montantCents)} ·{" "}
                  <a
                    href={`mailto:${reservation.clientEmail}`}
                    className="text-primary"
                  >
                    {reservation.clientEmail}
                  </a>
                </p>
                <Geste
                  geste={{
                    type: "recherche",
                    bookingId: reservation.bookingId,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        titre={`Propositions en souffrance (${tableau.propositionsPerimees.length})`}
        vide="Aucune proposition en souffrance."
      >
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Le délai de réponse est passé sans acceptation ni refus. Sans reprise,
          la mission se périme en silence.
        </p>
        {tableau.propositionsPerimees.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Rien à relancer.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {tableau.propositionsPerimees.map((proposition) => (
              <li
                key={proposition.assignmentId}
                className="rounded-xl border border-border bg-card p-4"
              >
                <p className="font-medium first-letter:uppercase">
                  {jourHeure.format(proposition.debut)} ·{" "}
                  {proposition.intervenant}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {proposition.organisation}
                  {proposition.repondreAvant
                    ? ` · réponse attendue le ${jour.format(proposition.repondreAvant)}`
                    : ""}
                </p>
                <Geste
                  geste={{
                    type: "proposition",
                    assignmentId: proposition.assignmentId,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        titre={`Demandes de rappel (${tableau.demandesEnAttente.length})`}
        vide="Aucune demande de rappel en attente."
      >
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Le formulaire promet un rappel dans la journée.
        </p>
        {tableau.demandesEnAttente.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Rien à rappeler.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {tableau.demandesEnAttente.map((demande) => (
              <li
                key={demande.leadId}
                className="rounded-xl border border-border bg-card p-4"
              >
                <p className="font-medium">
                  {demande.nom} ·{" "}
                  <a href={`tel:${demande.telephone}`} className="text-primary">
                    {demande.telephone}
                  </a>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {demande.commune
                    ? `${getCommuneByInsee(demande.commune)?.name ?? demande.commune} · `
                    : ""}
                  reçue le {jour.format(demande.recueLe)}
                </p>
                <Geste geste={{ type: "rappel", leadId: demande.leadId }} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        titre={`Intervenants à vérifier (${tableau.intervenantsAVerifier.length})`}
        vide="Aucun intervenant en attente de vérification."
      >
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          SIRET, assurance responsabilité civile et pièce d&apos;identité
          conditionnent la première mission.
        </p>
        {tableau.intervenantsAVerifier.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Rien à vérifier.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {tableau.intervenantsAVerifier.map((intervenant) => (
              <li
                key={intervenant.cleanerProfileId}
                className="rounded-xl border border-border bg-card p-4"
              >
                <p className="font-medium">{intervenant.prenom}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {intervenant.organisation} · inscrit le{" "}
                  {jour.format(intervenant.inscritLe)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}
