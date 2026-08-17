/**
 * Ce que Léo Clean fait, ce qu'elle ne fait pas.
 *
 * Le bloc le plus important de la page pour la confiance, et le plus exposé :
 * **chaque ligne est une promesse opposable**. Elles ne sont pas rédigées pour
 * séduire mais pour être vraies devant un intervenant qui les brandirait, et
 * devant un inspecteur qui chercherait à requalifier la relation en salariat.
 *
 * La colonne de droite est la plus utile des deux. « Nous ne vous employons
 * pas », « nous ne vous imposons aucune mission », « nous ne demandons pas
 * l'exclusivité » ne sont pas des arguments commerciaux : ce sont les
 * caractéristiques qui font qu'un indépendant reste indépendant. Les écrire
 * engage à les tenir dans le produit — un site qui promet la liberté pendant
 * que le fonctionnement dit l'inverse est une pièce à charge, pas une
 * protection.
 *
 * À faire valider ligne par ligne avant mise en ligne.
 */

const FAIT: readonly string[] = [
  "Trouve les clients et qualifie la demande",
  "Gère le planning et les créneaux",
  "Édite les factures",
  "Encaisse le client et vous reverse",
  "Répond au téléphone quand ça coince",
];

const NE_FAIT_PAS: readonly string[] = [
  "Vous employer",
  "Vous imposer des missions",
  "Vous demander l'exclusivité",
  "Vous facturer un abonnement",
  "Vous noter publiquement",
];

export function Perimetre() {
  return (
    <section className="border-y border-border-subtle bg-cream-50">
      <div className="mx-auto w-full max-w-4xl px-6 py-16">
        <h2 className="text-2xl font-black tracking-tight">
          Ce qu&apos;on fait, ce qu&apos;on ne fait pas
        </h2>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <div className="rounded-[var(--r-l)] border border-border bg-card p-5">
            <h3 className="font-extrabold text-brand">Ce que Léo Clean fait</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {FAIT.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-brand" aria-hidden>
                    ·
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[var(--r-l)] border border-border bg-card p-5">
            <h3 className="font-extrabold">Ce que Léo Clean ne fait pas</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {NE_FAIT_PAS.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden>·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
