import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser, requireOrganization } from "@/lib/auth/session";
import { marketplaceOrganizationId } from "@/lib/organizations";
import { REVERSEMENT_DECALAGE_JOURS } from "@/lib/paiement/calendrier";
import { chargerLesRevenus } from "@/lib/paiement/revenus";
import { formatEuros } from "@/lib/pricing";
import { SITE } from "@/lib/site";

/**
 * Mes revenus.
 *
 * **Trois états, jamais mélangés** : viré, en attente du virement, à venir. Une
 * mission acceptée n'est pas un revenu, et l'additionner au reste ferait
 * annoncer un montant que personne ne touchera avant de l'avoir travaillé.
 *
 * Le délai de virement est écrit sur la page. C'est le premier motif de départ
 * d'un intervenant à domicile, devant le tarif horaire : un délai annoncé et
 * tenu vaut mieux qu'un délai court et flottant.
 */

export const metadata: Metadata = {
  title: "Mes revenus",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const JOUR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

const MOIS = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function dureeLisible(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export default async function RevenusPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?callbackUrl=/intervenant/revenus");

  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(
    organizationId,
    "assignment:read:own",
  );

  const profil = await db.cleanerProfile.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!profil) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Mes revenus
        </h1>
        <p className="mt-4 rounded-xl border border-border bg-secondary/40 p-5 text-muted-foreground">
          Votre compte n&apos;est pas rattaché à un profil d&apos;intervenant.
          Appelez-nous au {SITE.phone}.
        </p>
      </main>
    );
  }

  const revenus = await chargerLesRevenus(db, profil.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <p className="text-sm">
        <Link href="/intervenant" className="text-primary hover:underline">
          ← Mes missions
        </Link>
      </p>

      <h1 className="mt-4 font-heading text-3xl font-black tracking-tight">
        Mes revenus
      </h1>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <p className="rounded-xl border-2 border-brand bg-card p-4">
          <span className="block text-sm text-muted-foreground">
            Prochain virement
          </span>
          <span className="mt-1 block font-mono text-2xl font-black">
            {formatEuros(revenus.enAttenteCents)}
          </span>
          {/*
            * Un virement dont la date est passée n'est pas « prochain » : le
            * dire ainsi présenterait un retard comme une promesse.
            */}
          <span
            className={`mt-1 block text-sm ${
              revenus.virementEnRetard
                ? "font-semibold text-warning-dark"
                : "text-muted-foreground"
            }`}
          >
            {!revenus.prochainVirement
              ? "rien en attente"
              : revenus.virementEnRetard
                ? `attendu le ${JOUR.format(new Date(revenus.prochainVirement))} — nous vous rappelons`
                : `le ${JOUR.format(new Date(revenus.prochainVirement))}`}
          </span>
        </p>
        <p className="rounded-xl border border-border bg-card p-4">
          <span className="block text-sm text-muted-foreground">
            Déjà versé
          </span>
          <span className="mt-1 block font-mono text-2xl font-black">
            {formatEuros(revenus.payeCents)}
          </span>
        </p>
        {/*
         * « À venir » est tenu à part et jamais additionné : une mission
         * acceptée n'est pas un revenu tant qu'elle n'est pas faite.
         */}
        <p className="rounded-xl border border-dashed border-input bg-secondary/30 p-4">
          <span className="block text-sm text-muted-foreground">
            Missions à venir
          </span>
          <span className="mt-1 block font-mono text-2xl font-black">
            {formatEuros(revenus.aVenirCents)}
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">
            pas encore travaillé
          </span>
        </p>
      </section>

      <p className="mt-4 text-sm text-pretty text-muted-foreground">
        Les virements partent chaque vendredi, {REVERSEMENT_DECALAGE_JOURS}{" "}
        jours après la mission. Le délai est le même pour tout le monde et il ne
        bouge pas.
      </p>

      {revenus.parMois.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-heading text-lg font-extrabold">Par mois</h2>
          <dl className="mt-3 divide-y divide-border border-y border-border">
            {revenus.parMois.map((mois) => (
              <div key={mois.mois} className="flex justify-between gap-4 py-3">
                <dt className="first-letter:uppercase">
                  {MOIS.format(new Date(`${mois.mois}-01T00:00:00Z`))}
                </dt>
                <dd className="font-mono font-semibold tabular-nums">
                  {formatEuros(mois.montantCents)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="font-heading text-lg font-extrabold">
          Le détail, mission par mission
        </h2>
        {revenus.lignes.length === 0 ? (
          <p className="mt-3 rounded-xl border border-border bg-secondary/40 p-5 text-muted-foreground">
            Rien sur les six derniers mois.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {revenus.lignes.map((ligne) => (
              <li
                key={ligne.bookingId}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
              >
                <span className="font-medium first-letter:uppercase">
                  {JOUR.format(new Date(ligne.quand))} · {ligne.commune}
                </span>
                <span className="text-sm text-muted-foreground">
                  {dureeLisible(ligne.dureeMinutes)} ·{" "}
                  {ligne.paye
                    ? "versé"
                    : ligne.reverseLe
                      ? `versé le ${JOUR.format(new Date(ligne.reverseLe))}`
                      : "à venir"}
                </span>
                <span className="font-mono font-semibold tabular-nums">
                  {formatEuros(ligne.montantCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*
       * L'attestation fiscale n'est pas promise ici : elle suppose des factures
       * émises, et la facturation n'est pas branchée. Écrire « bientôt » sur un
       * document que l'administration réclame ferait attendre quelqu'un pour
       * rien.
       */}
      <p className="mt-10 rounded-xl border border-border bg-secondary/30 p-5 text-sm text-pretty text-muted-foreground">
        Vos factures et votre récapitulatif annuel arriveront ici. En attendant,
        appelez-nous au {SITE.phone} si vous avez besoin d&apos;un justificatif.
      </p>
    </main>
  );
}
