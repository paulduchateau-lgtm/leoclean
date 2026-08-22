import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  FormulaireCodeParrain,
  FormulaireIdentifiants,
} from "@/app/(app)/intervenant/dossier/formulaires";
import { SiteFooter } from "@/components/site-footer";
import { Pieces } from "@/app/(app)/intervenant/dossier/pieces";
import { BandeauStatut } from "@/components/espace-pro/bandeau-statut";
import { PortraitField } from "@/components/portrait-field";
import { SiteHeader } from "@/components/site-header";
import { auth } from "@/lib/auth/config";
import { requireOrganization } from "@/lib/auth/session";
import { lireDossier, lireParrainage } from "@/lib/cleaner/space";
import { PARRAINAGE } from "@/lib/facts";
import {
  enregistrerMonPortraitIntervenant,
  retirerMonPortraitIntervenant,
} from "@/app/(app)/intervenant/dossier/actions";
import { depotDisponible } from "@/lib/cleaner/pieces";
import { portraitDisponible } from "@/lib/compte/portrait";
import { marketplaceOrganizationId } from "@/lib/organizations";
import { formatEuros } from "@/lib/pricing";

/**
 * Dossier d'un intervenant : ce qui manque, et ce qu'il rapporte.
 *
 * **La liste de ce qui manque est dérivée, jamais posée à la main.** Un
 * drapeau « vérifié » qu'on lèverait séparément de l'état des pièces finirait
 * par mentir ; ici l'écran ne fait que rendre `activationState`, qui lit les
 * pièces elles-mêmes.
 *
 * C'est aussi exactement la liste promise aux clients sous « professionnels
 * vérifiés » et affichée aux candidats sur `/travailler-avec-nous`. Les trois
 * surfaces disent la même chose, et n'importe qui peut le vérifier.
 */

export const metadata: Metadata = {
  title: "Mon dossier",
  robots: { index: false, follow: false },
};

export default async function DossierPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/connexion?callbackUrl=/intervenant/dossier");
  }

  const organizationId = await marketplaceOrganizationId();
  const { db } = await requireOrganization(
    organizationId,
    "assignment:respond:own",
  );
  const user = { id: session.user.id };

  const [dossier, parrainage] = await Promise.all([
    lireDossier(db, user, new Date()),
    lireParrainage(db, user),
  ]);

  return (
    <>
      <SiteHeader variant="tunnel" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="font-heading text-3xl font-black tracking-tight">
          Mon dossier professionnel
        </h1>
        <p className="mt-2 text-muted-foreground">{dossier.displayName}</p>

        {/* L'état en tête, comme sur chaque écran de l'espace : c'est la seule
            question qu'on se pose en arrivant. */}
        <div className="mt-6">
          <BandeauStatut etat={dossier.etat} />
        </div>

        <Pieces
          pieces={dossier.pieces}
          peutSoumettre={dossier.peutSoumettre}
          soumisLe={dossier.dossierSoumisLe}
          disponible={depotDisponible()}
        />

        {/*
          Le portrait en tête du dossier : c'est la seule information de cet
          écran que quelqu'un d'autre voit. Le reste — SIRET, assurance, pièces
          — sert à vous faire activer ; celle-ci sert à vous faire reconnaître.
        */}
        <div className="mt-8">
          <PortraitField
            nom={dossier.displayName}
            photoUrl={dossier.photoUrl}
            disponible={portraitDisponible()}
            legende="Elle apparaît sur la confirmation de vos clients et dans vos conversations. Faire entrer quelqu'un chez soi est plus facile quand on l'a vu. Elle n'est pas obligatoire."
            enregistrer={enregistrerMonPortraitIntervenant}
            retirer={retirerMonPortraitIntervenant}
          />
        </div>

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-lg font-extrabold">Vos identifiants</h2>
          <div className="mt-4">
            <FormulaireIdentifiants
              siret={dossier.siret}
              sapDeclarationNumber={dossier.sapDeclarationNumber}
              insuranceExpiresAt={dossier.insuranceExpiresAt}
            />
          </div>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-lg font-extrabold">Votre parrainage</h2>
          <p className="mt-2 text-pretty text-muted-foreground">
            Partagez votre code : vous percevez {PARRAINAGE.rateBp / 100} % du
            chiffre d&apos;affaires de votre filleul pendant {PARRAINAGE.months}{" "}
            mois, à partir de sa {PARRAINAGE.qualifyingBookings}
            <sup>e</sup> mission, dans la limite de{" "}
            {formatEuros(PARRAINAGE.monthlyCapCents)} par mois. Versé
            automatiquement : vous n&apos;avez rien à demander.
          </p>

          <p className="mt-4 inline-flex rounded-[var(--r-m)] border-2 border-teal-400 bg-teal-50 px-5 py-3 font-black tracking-widest text-teal-800 tabular-nums">
            {parrainage.code}
          </p>

          <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-[var(--r-m)] bg-border-subtle text-center">
            {[
              { label: "filleuls", value: String(parrainage.filleuls) },
              {
                label: "compteurs ouverts",
                value: String(parrainage.filleulsQualifies),
              },
              {
                label: "commissions acquises",
                value: formatEuros(parrainage.cumulCents),
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col-reverse bg-card px-3 py-4"
              >
                <dt className="mt-1 text-xs text-pretty text-muted-foreground">
                  {stat.label}
                </dt>
                <dd className="text-xl font-black tracking-tight text-brand">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-6">
            <FormulaireCodeParrain />
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
