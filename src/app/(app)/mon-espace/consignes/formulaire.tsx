"use client";

import { useState, useTransition } from "react";

import { enregistrerMesConsignes } from "@/app/(app)/mon-espace/consignes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type Consignes,
  LONGUEUR_MAX_TEXTE,
  RUBRIQUES,
  RYTHMES,
  type Reponse,
  progression,
} from "@/lib/logement/consignes";

/**
 * L'aide à écrire ses consignes.
 *
 * **Une question, une réponse, rien à rédiger.** Le champ libre existait déjà
 * et ne donnait que « merci de bien nettoyer » : personne ne pense à préciser
 * le produit des façades de cuisine avant le jour où elles sont abîmées. Une
 * question posée est une consigne qu'on n'aurait pas écrite.
 *
 * **Aucune question n'est obligatoire, et c'est le cœur du dessin.** Un
 * questionnaire qui exige des réponses est un formulaire ; celui-ci se remplit
 * par petits bouts, d'un passage à l'autre — d'où le compteur, qui montre
 * qu'on avance sans jamais reprocher ce qui manque.
 *
 * L'interrupteur est en tête plutôt qu'en bas : couper l'aide est un geste
 * qu'on veut trouver sans chercher, et l'enterrer sous quinze questions
 * reviendrait à ne pas l'offrir.
 */
export function FormulaireConsignes({
  addressId,
  libelle,
  initiales,
}: {
  addressId: string;
  libelle: string;
  initiales: Consignes;
}) {
  const [actif, setActif] = useState(initiales.actif);
  const [reponses, setReponses] = useState<Record<string, Reponse>>(
    initiales.reponses,
  );
  const [enregistrement, demarrer] = useTransition();
  const [etat, setEtat] = useState<"repos" | "ok" | "erreur">("repos");

  const compte = progression({ actif, reponses, majAt: null });

  const repondre = (id: string, reponse: Reponse | null) => {
    setEtat("repos");
    setReponses((precedent) => {
      const suivant = { ...precedent };
      if (reponse === null) delete suivant[id];
      else suivant[id] = reponse;
      return suivant;
    });
  };

  const soumettre = () => {
    setEtat("repos");
    demarrer(async () => {
      const resultat = await enregistrerMesConsignes({
        addressId,
        actif,
        reponses,
      });
      setEtat(resultat.ok ? "ok" : "erreur");
    });
  };

  return (
    <section className="mt-8">
      <div className="rounded-[var(--r-l)] border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-extrabold">{libelle}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {compte.repondues} réponse{compte.repondues > 1 ? "s" : ""} sur{" "}
              {compte.total} · rien n&apos;est obligatoire
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              checked={actif}
              onChange={(event) => {
                setActif(event.target.checked);
                setEtat("repos");
              }}
              className="size-6 rounded-[6px] accent-teal-600"
            />
            Transmettre ces consignes
          </label>
        </div>

        {!actif && (
          <p className="mt-4 rounded-[var(--r-m)] bg-ink-50 p-3 text-sm text-muted-foreground">
            L&apos;aide est en pause : vos réponses sont conservées, mais
            l&apos;intervenant ne les voit pas. Vos consignes libres, elles,
            continuent d&apos;être transmises.
          </p>
        )}
      </div>

      {RUBRIQUES.map((rubrique) => (
        <div key={rubrique.cle} className="mt-8">
          <h2 className="font-heading text-lg font-extrabold">
            {rubrique.titre}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {rubrique.intention}
          </p>

          <div className="mt-4 space-y-5">
            {rubrique.questions.map((question) => {
              const reponse = reponses[question.id];

              return (
                <div
                  key={question.id}
                  className="rounded-[var(--r-m)] border border-border bg-card p-4"
                >
                  <Label htmlFor={question.id} className="font-semibold">
                    {question.question}
                  </Label>
                  {question.aide && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {question.aide}
                    </p>
                  )}

                  {question.type === "rythme" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {RYTHMES.map((rythme) => {
                        const choisi =
                          reponse?.type === "rythme" &&
                          reponse.valeur === rythme.cle;
                        return (
                          <button
                            key={rythme.cle}
                            type="button"
                            aria-pressed={choisi}
                            onClick={() =>
                              repondre(
                                question.id,
                                choisi
                                  ? null
                                  : { type: "rythme", valeur: rythme.cle },
                              )
                            }
                            className={`min-h-11 rounded-full border-2 px-4 text-sm font-semibold transition-colors ${
                              choisi
                                ? "border-teal-600 bg-teal-400 text-ink-900"
                                : "border-border bg-card hover:border-teal-300 hover:bg-teal-50"
                            }`}
                          >
                            {rythme.libelle}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {question.type === "oui-non" && (
                    <div className="mt-3 flex gap-2">
                      {[
                        { valeur: true, libelle: "Oui" },
                        { valeur: false, libelle: "Non" },
                      ].map((choix) => {
                        const choisi =
                          reponse?.type === "oui-non" &&
                          reponse.valeur === choix.valeur;
                        return (
                          <button
                            key={choix.libelle}
                            type="button"
                            aria-pressed={choisi}
                            onClick={() =>
                              repondre(
                                question.id,
                                choisi
                                  ? null
                                  : { type: "oui-non", valeur: choix.valeur },
                              )
                            }
                            className={`min-h-11 rounded-full border-2 px-6 text-sm font-semibold transition-colors ${
                              choisi
                                ? "border-teal-600 bg-teal-400 text-ink-900"
                                : "border-border bg-card hover:border-teal-300 hover:bg-teal-50"
                            }`}
                          >
                            {choix.libelle}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {question.type === "texte" && (
                    <>
                      <Input
                        id={question.id}
                        maxLength={LONGUEUR_MAX_TEXTE}
                        placeholder={question.exemple}
                        value={reponse?.type === "texte" ? reponse.valeur : ""}
                        onChange={(event) =>
                          repondre(
                            question.id,
                            event.target.value.trim().length === 0
                              ? null
                              : { type: "texte", valeur: event.target.value },
                          )
                        }
                        className="mt-3"
                      />
                      {question.exemple && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Exemple : {question.exemple}
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button onClick={soumettre} disabled={enregistrement} size="lg">
          {enregistrement ? "Enregistrement…" : "Enregistrer"}
        </Button>
        {etat === "ok" && (
          <p role="status" className="text-sm font-semibold text-brand">
            Enregistré. L&apos;intervenant les verra avant sa venue.
          </p>
        )}
        {etat === "erreur" && (
          <p role="alert" className="text-sm text-destructive">
            L&apos;enregistrement n&apos;a pas abouti. Réessayez.
          </p>
        )}
      </div>
    </section>
  );
}
