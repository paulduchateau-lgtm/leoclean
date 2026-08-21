import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Demande } from "@/app/(app)/mon-compte/attestations/demande";
import { EspaceFerme } from "@/components/espace-ferme";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { espaceClient } from "@/lib/auth/espaces";
import {
  anneesAttestables,
  lireLesAttestations,
} from "@/lib/facturation/attestation-annuelle";
import { canShowTaxCredit } from "@/lib/fiscal";
import { formatEuros } from "@/lib/pricing";
import { SITE } from "@/lib/site";

/**
 * Mes attestations fiscales.
 *
 * **L'avantage porte sur les sommes effectivement versées** dans l'année civile
 * (CGI, art. 199 sexdecies), non sur celles facturées : une prestation de
 * décembre payée en janvier appartient à l'année du paiement. C'est la règle
 * qu'on rate le plus souvent, et elle change le montant de tout abonné.
 *
 * **Une attestation par organisme déclaré**, comme il y a une facture par
 * organisme : chacun atteste sur son propre montant, et l'avance immédiate
 * fonctionne de toute façon par demande déposée avec le SIRET de chacun.
 *
 * La page n'existe que si la déclaration SAP est obtenue : `fiscal.ts` est le
 * seul endroit où cette frontière se décide, et sans déclaration une
 * attestation n'aurait aucune valeur.
 */

export const metadata: Metadata = {
  title: "Attestations fiscales",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const JOUR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export default async function AttestationsPage() {
  const espace = await espaceClient();

  if (!espace.ouvert) {
    if (espace.refus === "NON_CONNECTE") {
      redirect("/connexion?callbackUrl=/mon-compte/attestations");
    }
    return (
      <EspaceFerme
        refus={espace.refus}
        retour={{ href: "/mon-compte", libelle: "Mon compte" }}
      />
    );
  }

  const [attestations, annees] = await Promise.all([
    lireLesAttestations(espace.db, espace.profil.id),
    anneesAttestables(espace.db, espace.profil.id),
  ]);

  const dejaEmises = new Set(attestations.map((a) => a.annee));
  const aDemander = annees.filter((annee) => !dejaEmises.has(annee));

  return (
    <>
      <SiteHeader variant="tunnel" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <p className="text-sm">
          <Link href="/mon-compte" className="text-brand hover:underline">
            ← Mon compte
          </Link>
        </p>

        <h1 className="mt-4 font-heading text-3xl font-black tracking-tight">
          Attestations fiscales
        </h1>

        {!canShowTaxCredit() ? (
          /*
           * Sans déclaration obtenue, l'attestation n'a aucune valeur et
           * exposerait celui qui la signe autant que celui qui s'en sert. On le
           * dit plutôt que de laisser un bouton qui échouerait.
           */
          <p className="mt-6 rounded-2xl border border-warning-border bg-warning-bg p-6 text-pretty text-warning-dark">
            Notre déclaration Services à la personne est déposée et pas encore
            instruite. Tant qu&apos;elle ne l&apos;est pas, aucune attestation
            ne peut être établie : elle n&apos;ouvrirait aucun droit. Nous vous
            préviendrons dès qu&apos;elle sera obtenue.
          </p>
        ) : (
          <>
            <p className="mt-2 text-pretty text-muted-foreground">
              Elles récapitulent les sommes que vous avez{" "}
              <strong>versées</strong> au cours de l&apos;année civile — une
              intervention de décembre réglée en janvier compte pour
              l&apos;année suivante.
            </p>

            {attestations.length > 0 ? (
              <ul className="mt-6 divide-y divide-border border-y border-border">
                {attestations.map((attestation) => (
                  <li
                    key={attestation.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-4"
                  >
                    <span>
                      <span className="block font-medium">
                        {attestation.annee} · {attestation.emetteur}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        établie le {JOUR.format(new Date(attestation.emiseLe))}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-mono font-semibold tabular-nums">
                        {formatEuros(attestation.verseCents)} versés
                      </span>
                      <span className="block font-mono text-sm text-muted-foreground tabular-nums">
                        dont {formatEuros(attestation.eligibleCents)} éligibles
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            <Demande annees={aDemander} dejaEmises={attestations.length > 0} />
          </>
        )}

        <p className="mt-10 text-sm text-pretty text-muted-foreground">
          Une question sur votre déclaration ? Appelez-nous au {SITE.phone}.
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
