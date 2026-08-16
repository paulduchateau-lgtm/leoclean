import { APreciser } from "@/components/intervenants/a-preciser";
import { INTERVENANTS, PARRAINAGE, netRateLabel } from "@/lib/facts";
import { formatHourlyRate } from "@/lib/pricing";

/**
 * Quatre chiffres, côté offre.
 *
 * Le pendant exact du bandeau de l'accueil client, et la même règle : aucune
 * valeur n'est écrite ici, aucune ne mesure une activité qui n'existe pas.
 * Nombre d'intervenants, missions réalisées, note moyenne : tant qu'il n'y en
 * a pas, ils ne sont nulle part.
 *
 * Le qualificatif du montant net est dérivé de ce qu'on est en mesure de
 * tenir, pas choisi ici : « garanti » ne s'écrit que si les trois situations
 * du bloc rémunération ont une réponse.
 */
export function ChiffresIntervenants() {
  const figures = [
    {
      value:
        INTERVENANTS.netHourlyRateCents === null ? (
          <APreciser quoi="rémunération nette horaire" />
        ) : (
          formatHourlyRate(INTERVENANTS.netHourlyRateCents)
        ),
      label: netRateLabel(),
    },
    {
      value: `${INTERVENANTS.maxDriveMinutes} min`,
      label: "de trajet au maximum",
    },
    {
      value:
        INTERVENANTS.paymentTerms === null ? (
          <APreciser quoi="délai de paiement" />
        ) : (
          INTERVENANTS.paymentTerms
        ),
      label: "délai de paiement",
    },
    {
      value: `${PARRAINAGE.rateBp / 100} %`,
      label: "sur le chiffre d'affaires de vos filleuls",
    },
  ];

  return (
    <section
      className="border-b border-border-subtle bg-card"
      aria-label="Les conditions en quatre chiffres"
    >
      <dl className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-px overflow-hidden bg-border-subtle sm:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label} className="bg-card px-5 py-6 text-center">
            <dt className="sr-only">{figure.label}</dt>
            <dd>
              <span className="block text-2xl font-black tracking-tight text-brand">
                {figure.value}
              </span>
              <span className="mt-1 block text-sm text-pretty text-muted-foreground">
                {figure.label}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
