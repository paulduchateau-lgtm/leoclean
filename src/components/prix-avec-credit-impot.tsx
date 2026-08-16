import Link from "next/link";

import { afterTaxCreditCents, canShowTaxCredit } from "@/lib/fiscal";
import { formatHourlyRate } from "@/lib/pricing";

/**
 * Un tarif horaire, et son montant après réduction d'impôt quand on a le droit
 * de l'annoncer.
 *
 * Le prix mis en avant reste **toujours** le prix brut : c'est celui qu'on
 * prélève, et un montant après réduction affiché en principal ferait passer
 * pour un tarif ce qui n'est qu'une conséquence de la déclaration de revenus
 * du client. La mention fiscale vient en second rang, ou pas du tout.
 *
 * Le composant ne prend aucune décision : il interroge `canShowTaxCredit()`.
 * Tant que la déclaration SAP n'est pas obtenue, il rend exactement ce qu'il
 * rendait avant qu'on écrive la ligne fiscale — c'est ce qui permet de le
 * poser dès maintenant partout où un prix s'affiche, sans rien promettre.
 */
export function PrixAvecCreditImpot({
  hourlyRateCents,
  className = "",
}: {
  hourlyRateCents: number;
  className?: string;
}) {
  return (
    <p className={className}>
      <span className="text-2xl font-black tracking-tight">
        {formatHourlyRate(hourlyRateCents)}
      </span>

      {canShowTaxCredit() && (
        <span className="mt-1 block text-sm text-muted-foreground">
          soit {formatHourlyRate(afterTaxCreditCents(hourlyRateCents))} après
          réduction d&apos;impôt
          <Link
            href="/tarifs#credit-impot"
            className="text-brand"
            aria-label="Conditions de la réduction d'impôt"
          >
            *
          </Link>
        </span>
      )}
    </p>
  );
}
