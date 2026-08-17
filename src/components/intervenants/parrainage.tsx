import { PARRAINAGE } from "@/lib/facts";
import { formatEuros } from "@/lib/pricing";

/**
 * Cooptation entre intervenants.
 *
 * Aucune valeur n'est décidée ici : taux, seuil, durée et plafond viennent de
 * `referral/rules.ts`, qui est le module qui **verse réellement** les
 * commissions. Une page d'offre annonçant douze mois quand la machine en
 * compte six serait découverte au treizième — c'est-à-dire au pire moment,
 * par la personne la plus fidèle.
 *
 * Trois points de rédaction, tous imposés :
 *
 * - **« Vous percevez », jamais « vous pouvez demander ».** Un droit qu'il
 *   faut réclamer est un droit qui érode la confiance, et celui qui découvre
 *   après coup qu'il aurait pu toucher quelque chose devient un détracteur.
 * - **Le plafond est annoncé.** Il existe dans le calcul ; taire la seule
 *   limite du dispositif reproduirait exactement l'opacité reprochée aux
 *   plateformes nationales.
 * - **Le traitement fiscal est dit.** La commission est versée en espèces,
 *   donc c'est un revenu : il s'ajoute au chiffre d'affaires du parrain et
 *   compte dans ses plafonds de micro-entreprise. Le laisser découvrir serait
 *   contraire au registre du reste de la page.
 *
 * Un seul niveau, et ce n'est pas un choix produit : personne ne perçoit rien
 * sur les filleuls de ses filleuls. Voir `MAX_REFERRAL_DEPTH`.
 */
export function Parrainage() {
  const rate = PARRAINAGE.rateBp / 100;

  return (
    <section className="border-y border-border-subtle bg-lemon-100">
      <div className="mx-auto w-full max-w-4xl px-6 py-16">
        <h2 className="text-2xl font-black tracking-tight">
          Vous en faites venir un, vous touchez {rate} %
        </h2>

        <ol className="mt-8 max-w-prose space-y-3">
          <li className="flex gap-3">
            <span className="font-black text-brand" aria-hidden>
              1
            </span>
            Vous parrainez quelqu&apos;un, il candidate avec votre code.
          </li>
          <li className="flex gap-3">
            <span className="font-black text-brand" aria-hidden>
              2
            </span>
            À sa {PARRAINAGE.qualifyingBookings}
            <sup>e</sup> intervention réalisée, le compteur s&apos;ouvre.
          </li>
          <li className="flex gap-3">
            <span className="font-black text-brand" aria-hidden>
              3
            </span>
            Vous percevez {rate} % de son chiffre d&apos;affaires pendant{" "}
            {PARRAINAGE.months} mois, dans la limite de{" "}
            {formatEuros(PARRAINAGE.monthlyCapCents)} par mois, tous filleuls
            confondus.
          </li>
          <li className="flex gap-3">
            <span className="font-black text-brand" aria-hidden>
              4
            </span>
            C&apos;est versé automatiquement avec votre règlement. Vous
            n&apos;avez rien à demander.
          </li>
        </ol>

        <div className="mt-8 max-w-prose rounded-[var(--r-m)] border border-border bg-card p-4">
          <p className="text-sm text-pretty">
            <strong>Un exemple.</strong> Votre filleule réalise{" "}
            {formatEuros(120_000)} de chiffre d&apos;affaires sur un mois : vous
            percevez {formatEuros((120_000 * PARRAINAGE.rateBp) / 10_000)} ce
            mois-là. Le compteur des {PARRAINAGE.months} mois démarre à sa{" "}
            {PARRAINAGE.qualifyingBookings}
            <sup>e</sup> intervention, pas à son inscription.
          </p>
        </div>

        <ul className="mt-8 max-w-prose space-y-2 text-sm text-muted-foreground">
          <li>
            Le seuil de {PARRAINAGE.qualifyingBookings} interventions porte sur
            votre filleul, pas sur vous.
          </li>
          <li>
            Ces {PARRAINAGE.qualifyingBookings} premières interventions ouvrent
            le droit, elles ne sont pas commissionnées : la commission court à
            partir de la {PARRAINAGE.qualifyingBookings}
            <sup>e</sup>, sans rattrapage sur les précédentes.
          </li>
          <li>
            Le pourcentage porte sur ce qui lui est versé — la somme que vous
            retrouvez sur votre espace, pas un chiffre que vous devriez croire
            sur parole.
          </li>
          <li>Aucun plafond de nombre de filleuls.</li>
          <li>
            La commission est un revenu : elle s&apos;ajoute à votre chiffre
            d&apos;affaires et compte dans vos plafonds de micro-entreprise. Léo
            Clean établit la facture pour vous.
          </li>
          <li>
            Un seul niveau : vous ne touchez rien sur les personnes que vos
            filleuls parrainent à leur tour.
          </li>
        </ul>
      </div>
    </section>
  );
}
