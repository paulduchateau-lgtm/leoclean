import { APreciser } from "@/components/intervenants/a-preciser";
import { INTERVENANTS, canSayGuaranteed, netRatePhrase } from "@/lib/facts";
import { formatEuros, formatHourlyRate } from "@/lib/pricing";
import { PUBLIC_RATES } from "@/lib/pricing/public-grid";

/**
 * Rémunération : ce que paie le client, ce que touche l'intervenant.
 *
 * L'opacité de la commission est le premier reproche fait aux plateformes
 * nationales, et le détailler est le différenciant le moins cher à produire du
 * site. Le prix client est lu dans la grille publique — celle-là même qui
 * s'affiche sur `/tarifs` — et non recopié : les deux faces du site doivent
 * annoncer le même nombre, sinon la transparence revendiquée ici se retourne
 * au premier recoupement.
 *
 * **Le mot « garanti » n'est pas écrit par ce composant.** Il est dérivé de
 * `canSayGuaranteed()`, qui n'est vrai que si les trois situations ci-dessous
 * ont une réponse. Un « net garanti » posé au-dessus d'un tableau vide est une
 * promesse sans objet, et c'est la seule ligne de la page qu'un intervenant
 * ayant déjà travaillé pour une plateforme lira en premier.
 */

const EXAMPLE_HOURS = 3;

export function Remuneration() {
  const clientRate = PUBLIC_RATES[0]!.hourlyRateCents;
  const clientTotal = clientRate * EXAMPLE_HOURS;
  const net = INTERVENANTS.netHourlyRateCents;

  const situations = [
    {
      situation: "Le client paie en retard",
      reponse: INTERVENANTS.guarantee.latePayment,
      quoi: "garantie en cas de retard de paiement",
    },
    {
      situation: "Le client ne paie pas",
      reponse: INTERVENANTS.guarantee.unpaidClient,
      quoi: "garantie en cas d'impayé",
    },
    {
      situation: "Le client annule tardivement",
      reponse: INTERVENANTS.guarantee.lateCancellation,
      quoi: "part de l'intervenant sur une annulation tardive",
    },
  ];

  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-16">
      <h2 className="text-2xl font-black tracking-tight">
        Ce que vous touchez, et ce que nous gardons
      </h2>
      <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
        Le tarif client est public, il est sur{" "}
        <a href="/tarifs" className="text-brand underline">
          la page tarifs
        </a>
        . Voici comment il se partage sur une intervention de {EXAMPLE_HOURS}{" "}
        heures en formule régulière.
      </p>

      <dl className="mt-8 divide-y divide-border-subtle border-y border-border-subtle">
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt>Ce que paie le client</dt>
          <dd className="font-extrabold whitespace-nowrap">
            {formatEuros(clientTotal)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt>Ce que vous touchez, {netRatePhrase()}</dt>
          <dd className="font-extrabold whitespace-nowrap text-brand">
            {net === null ? (
              <APreciser quoi="rémunération nette horaire" />
            ) : (
              formatEuros(net * EXAMPLE_HOURS)
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt>Ce que garde Léo Clean pour la coordination</dt>
          <dd className="font-extrabold whitespace-nowrap">
            {net === null ? (
              <APreciser quoi="marge de coordination" />
            ) : (
              formatEuros(clientTotal - net * EXAMPLE_HOURS)
            )}
          </dd>
        </div>
      </dl>

      <p className="mt-4 max-w-prose text-sm text-pretty text-muted-foreground">
        La part de coordination paie la recherche des clients, la qualification
        de la demande, le planning, la facturation, l&apos;encaissement et le
        téléphone. Elle ne paie pas de commercial : il n&apos;y en a pas.
      </p>

      <h3 className="mt-12 text-lg font-extrabold">
        {canSayGuaranteed()
          ? "Ce que « garanti » veut dire"
          : "Ce qui se passe quand le client ne suit pas"}
      </h3>
      <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
        Trois situations, trois réponses. Elles engagent Léo Clean, et
        c&apos;est pour cela qu&apos;elles sont écrites ici plutôt que dans des
        conditions générales que personne n&apos;ouvre.
      </p>

      <dl className="mt-6 space-y-4">
        {situations.map((entry) => (
          <div
            key={entry.situation}
            className="rounded-[var(--r-m)] border border-border bg-card p-4"
          >
            <dt className="font-semibold">{entry.situation}</dt>
            <dd className="mt-1 text-pretty text-muted-foreground">
              {entry.reponse === null ? (
                <APreciser quoi={entry.quoi} />
              ) : (
                entry.reponse
              )}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-6 max-w-prose text-sm text-pretty text-muted-foreground">
        Pour mémoire, le tarif client est de {formatHourlyRate(clientRate)} en
        formule régulière et de{" "}
        {formatHourlyRate(PUBLIC_RATES[1]!.hourlyRateCents)} en intervention
        ponctuelle. Aucun frais d&apos;inscription, aucun abonnement.
      </p>
    </section>
  );
}
