import Link from "next/link";

import { FACTS } from "@/lib/facts";

/**
 * Les deux portes : indépendant, ou société de ménage.
 *
 * Deux cartes de même poids visuel, parce qu'un gérant de société qui se
 * reconnaît dans la seconde ne doit pas avoir l'impression d'être le public de
 * repli.
 *
 * **Le cadrage vis-à-vis des sociétés est la partie délicate.** Pour une
 * société de ménage locale, une plateforme nationale est un concurrent ; une
 * plateforme locale qui lui amène des clients est un fournisseur de flux. Tant
 * que cette distinction n'est pas formulée, l'offre est illisible pour elle —
 * d'où la première phrase de la carte, qui la pose avant tout argument.
 *
 * **Une contrainte à ne pas perdre de vue** : la promesse faite au client est
 * « le même intervenant à chaque passage ». Elle doit tenir aussi quand la
 * mission est servie par une société, sinon les deux faces du site se
 * contredisent. L'affectation nominative d'un même salarié sur un client donné
 * est donc une condition d'entrée, et elle est écrite comme telle.
 */
export function Portes() {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-16">
      <h2 className="text-2xl font-black tracking-tight">
        Deux façons de travailler avec nous
      </h2>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <article
          id="independants"
          className="scroll-mt-24 rounded-[var(--r-l)] border border-border bg-card p-6"
        >
          <h3 className="text-lg font-extrabold">
            Vous travaillez à votre compte
          </h3>
          <p className="mt-2 text-pretty text-muted-foreground">
            Micro-entrepreneur ou entreprise individuelle. Vous choisissez vos
            communes, vos disponibilités et vos missions. Léo Clean vous apporte
            des clients réguliers dans un rayon court et s&apos;occupe de la
            facturation.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              `Des missions groupées à ${FACTS.maxDriveMinutes} minutes de route au maximum`,
              "Des clients récurrents, pas des interventions isolées",
              "Aucune exclusivité : vous travaillez ailleurs si vous le souhaitez",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-brand" aria-hidden>
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="#candidature"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-xs transition-all duration-200 ease-brand hover:-translate-y-px hover:bg-mango-500 hover:shadow-mango"
          >
            Déposer ma candidature
          </Link>
        </article>

        <article
          id="societes"
          className="scroll-mt-24 rounded-[var(--r-l)] border border-border bg-card p-6"
        >
          <h3 className="text-lg font-extrabold">
            Vous dirigez une société de ménage
          </h3>
          <p className="mt-2 text-pretty text-muted-foreground">
            Léo Clean n&apos;est pas un concurrent : c&apos;est un canal de
            demande locale. Vous gardez vos salariés, votre assurance, votre
            organisation et vos tarifs internes. Vous récupérez des clients
            réguliers sur votre secteur pour remplir les creux de planning, sans
            démarchage et sans commercial.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              "Un compte multi-intervenants : vous répartissez les missions entre vos salariés",
              "La répartition tient compte de leurs secteurs et de leurs horaires — le taux de remplissage est votre premier levier de marge",
              "Un même salarié reste affecté à un même client d'une semaine sur l'autre : c'est la promesse faite au client, et c'est une condition d'entrée",
              "Facturation consolidée",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-brand" aria-hidden>
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="#candidature"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full border-2 border-border bg-card px-6 font-bold transition-all duration-200 ease-brand hover:-translate-y-px hover:border-teal-300 hover:bg-teal-50"
          >
            Nous contacter
          </Link>
        </article>
      </div>
    </section>
  );
}
