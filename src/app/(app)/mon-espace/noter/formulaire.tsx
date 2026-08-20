"use client";

import { Loader2Icon, StarIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { noterIntervention } from "@/app/(app)/mon-espace/noter/actions";
import { Button } from "@/components/ui/button";
import {
  LIBELLES_INSATISFACTION,
  LIBELLES_TAGS,
  SEUIL_TICKET_QUALITE,
  TAGS_AVIS,
  type CategorieInsatisfaction,
  type TagAvis,
} from "@/lib/mission/notation";

/**
 * Noter une intervention.
 *
 * **Deux taps.** Les étoiles, puis des tags — et rien d'obligatoire au-delà.
 * Le commentaire reste facultatif : un champ libre obligatoire fait chuter le
 * taux de réponse sans rien apprendre de plus qu'une étoile.
 *
 * Les tags ne changent pas selon la note : ce sont les mêmes cinq mots, qui se
 * lisent en bien ou en mal selon les étoiles. Deux jeux de tags feraient dire
 * au formulaire ce que le client n'a pas dit.
 */

const CATEGORIES = Object.keys(
  LIBELLES_INSATISFACTION,
) as CategorieInsatisfaction[];

const JOUR = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

export function FormulaireAvis({
  intervention,
}: {
  intervention: {
    bookingId: string;
    quand: string;
    commune: string;
    intervenantPrenom: string | null;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [etoiles, setEtoiles] = useState(0);
  const [survolee, setSurvolee] = useState(0);
  const [tags, setTags] = useState<TagAvis[]>([]);
  const [commentaire, setCommentaire] = useState("");
  const [categorie, setCategorie] = useState<CategorieInsatisfaction | null>(
    null,
  );
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState<{ ticketOuvert: boolean } | null>(null);

  const basse = etoiles > 0 && etoiles <= SEUIL_TICKET_QUALITE;

  if (envoye) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-border bg-secondary/40 p-6"
      >
        <p className="font-semibold">Merci, c&apos;est enregistré.</p>
        <p className="mt-2 text-muted-foreground">
          {envoye.ticketOuvert
            ? /*
               * On annonce le rappel plutôt que de le faire en silence : un
               * client qui ne s'attend pas à l'appel ne décroche pas.
               */
              "Quelqu'un vous rappelle sous 48 heures. Vous n'avez rien d'autre à faire."
            : "Votre retour est transmis à votre intervenant."}
        </p>
      </div>
    );
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-6">
      <p className="font-heading text-lg font-extrabold first-letter:uppercase">
        {JOUR.format(new Date(intervention.quand))}
      </p>
      <p className="mt-1 text-muted-foreground">
        {intervention.commune}
        {intervention.intervenantPrenom
          ? ` · avec ${intervention.intervenantPrenom}`
          : ""}
      </p>

      {/* --- Premier tap --- */}
      <fieldset className="mt-5">
        <legend className="text-sm font-medium">
          Comment s&apos;est passée cette intervention ?
        </legend>
        <div
          className="mt-2 flex gap-1"
          onMouseLeave={() => setSurvolee(0)}
          role="radiogroup"
          aria-label="Note de une à cinq étoiles"
        >
          {[1, 2, 3, 4, 5].map((valeur) => (
            <button
              key={valeur}
              type="button"
              role="radio"
              aria-checked={etoiles === valeur}
              aria-label={`${valeur} étoile${valeur > 1 ? "s" : ""}`}
              onMouseEnter={() => setSurvolee(valeur)}
              onFocus={() => setSurvolee(valeur)}
              onBlur={() => setSurvolee(0)}
              onClick={() => setEtoiles(valeur)}
              className="grid size-12 place-items-center rounded-full"
            >
              <StarIcon
                aria-hidden
                className={`size-8 ${
                  valeur <= (survolee || etoiles)
                    ? "fill-mango-400 text-mango-400"
                    : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
      </fieldset>

      {etoiles > 0 ? (
        <>
          {/* --- Second tap --- */}
          <fieldset className="mt-5">
            <legend className="text-sm font-medium">
              {basse
                ? "Qu'est-ce qui n'allait pas ?"
                : "Qu'avez-vous apprécié ?"}
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {TAGS_AVIS.map((tag) => {
                const choisi = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={choisi}
                    onClick={() =>
                      setTags((actuels) =>
                        choisi
                          ? actuels.filter((autre) => autre !== tag)
                          : [...actuels, tag],
                      )
                    }
                    className={`min-h-11 rounded-full border px-4 text-sm ${
                      choisi
                        ? "border-brand bg-brand text-ink-950"
                        : "border-input bg-background"
                    }`}
                  >
                    {LIBELLES_TAGS[tag]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {basse ? (
            <fieldset className="mt-5">
              <legend className="text-sm font-medium">
                Pour qu&apos;on rappelle la bonne personne
              </legend>
              <div className="mt-2 flex flex-col gap-2">
                {CATEGORIES.map((valeur) => (
                  <button
                    key={valeur}
                    type="button"
                    aria-pressed={categorie === valeur}
                    onClick={() => setCategorie(valeur)}
                    className={`min-h-12 rounded-xl border px-4 text-left text-base ${
                      categorie === valeur
                        ? "border-brand bg-brand text-ink-950"
                        : "border-input bg-background"
                    }`}
                  >
                    {LIBELLES_INSATISFACTION[valeur]}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          <label className="mt-5 flex flex-col gap-1 text-sm">
            <span className="font-medium">
              Un mot de plus{" "}
              <span className="font-normal text-muted-foreground">
                (facultatif)
              </span>
            </span>
            <textarea
              value={commentaire}
              onChange={(event) => setCommentaire(event.target.value)}
              rows={3}
              maxLength={2000}
              className="rounded-xl border border-input bg-background p-3 text-base"
            />
          </label>

          {/*
           * La règle de publication est dite avant l'envoi, pas découverte
           * après : un client qui écrit deux paragraphes doit savoir s'ils
           * seront lus par nous seuls ou par tout le monde.
           */}
          {etoiles > SEUIL_TICKET_QUALITE && commentaire.trim() ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Votre commentaire pourra être publié sur le site, avec votre
              prénom seul.
            </p>
          ) : null}

          {erreur ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {erreur}
            </p>
          ) : null}

          <Button
            size="lg"
            className="mt-5"
            disabled={pending || (basse && !categorie)}
            onClick={() =>
              startTransition(async () => {
                setErreur(null);
                const resultat = await noterIntervention({
                  bookingId: intervention.bookingId,
                  etoiles,
                  tags,
                  commentaire: commentaire.trim() || null,
                  categorie: basse ? categorie : null,
                });
                if (!resultat.ok) {
                  setErreur(resultat.error);
                  return;
                }
                setEnvoye({ ticketOuvert: resultat.data.ticketOuvert });
              })
            }
          >
            {pending ? (
              <Loader2Icon className="animate-spin" aria-hidden />
            ) : null}
            Envoyer
          </Button>
        </>
      ) : null}
    </article>
  );
}
