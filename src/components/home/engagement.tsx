import { HouseIcon, RepeatIcon, ShieldCheckIcon, UserIcon } from "lucide-react";

import { Avis } from "@/components/avis";
import { SITE } from "@/lib/site";

/**
 * Ce que la proximité change concrètement — à la place des avis clients.
 *
 * Il n'y a aucun avis à afficher aujourd'hui, et en fabriquer serait une
 * pratique commerciale trompeuse au sens de l'article L121-2 du code de la
 * consommation — pour un gain sans rapport avec le risque. Un engagement
 * vérifiable est l'inverse d'un avis : il n'est pas une preuve du passé mais
 * une promesse tenue par quelqu'un dont le nom et l'adresse sont sur la page.
 *
 * Le dernier bloc nomme le fondateur et le siège : il n'apparaît que si les
 * deux sont renseignés — une carte de visite à moitié vide dirait le
 * contraire de ce qu'elle veut dire.
 */

const ENGAGEMENTS = [
  {
    icon: RepeatIcon,
    title: "Le même intervenant, chaque semaine",
    body: "Sur une formule régulière, vous retrouvez la même personne à chaque passage. Elle finit par connaître votre logement, vos habitudes et votre chien.",
  },
  {
    icon: HouseIcon,
    title: "Des gens qui habitent à côté",
    body: "Nos intervenants vivent dans les communes où ils travaillent. Un trajet court, c'est une tournée qui tient — et c'est ce qui permet de vous garder le même créneau.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Des professionnels vérifiés",
    body: "SIRET actif, attestation de responsabilité civile professionnelle, pièce d'identité et RIB contrôlés avant la première intervention.",
  },
  {
    icon: UserIcon,
    title: "Une vraie personne en face",
    body:
      SITE.founder !== null && SITE.address.street !== null
        ? `${SITE.founder}, ${SITE.address.street} à ${SITE.address.city}. Vous écrivez, quelqu'un répond. Pas de standard, pas de message resté sans réponse.`
        : "Vous écrivez, quelqu'un répond. Pas de standard, pas de message resté sans réponse.",
  },
];

export function Engagement() {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-16">
      <h2 className="text-2xl font-black tracking-tight">
        Ce que ça change chez vous
      </h2>
      <p className="mt-2 max-w-prose text-muted-foreground">
        Léo Clean vient d&apos;ouvrir : nous n&apos;avons pas d&apos;avis
        clients à vous montrer, et nous n&apos;en inventerons pas. Voici ce qui
        est vérifiable dès aujourd&apos;hui.
      </p>

      <ul className="mt-8 grid gap-5 sm:grid-cols-2">
        {ENGAGEMENTS.map((engagement) => (
          <li
            key={engagement.title}
            className="flex gap-4 rounded-[var(--r-l)] border border-border bg-card p-5"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--r-m)] bg-teal-100 text-teal-700">
              <engagement.icon className="size-5" aria-hidden />
            </span>
            <span>
              <h3 className="font-extrabold">{engagement.title}</h3>
              <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
                {engagement.body}
              </p>
            </span>
          </li>
        ))}
      </ul>

      {SITE.founder !== null && (
        <p className="mt-6 text-sm text-muted-foreground">
          — {SITE.founder}, fondateur de {SITE.name}.
        </p>
      )}

      {/* En place, et muet tant qu'aucun avis réel n'existe. */}
      <Avis />
    </section>
  );
}
