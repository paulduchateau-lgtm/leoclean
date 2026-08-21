"use client";

import { CheckIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import {
  deposerMaPhoto,
  enregistrerMaPresentation,
  signerMesChartes,
} from "@/app/rejoindre/actions";
import { Button } from "@/components/ui/button";
import {
  CHARTES,
  VERSION_CHARTES,
  type CharteId,
} from "@/lib/candidature/chartes";

/**
 * Le profil et la signature : les trois valeurs qui débloquent l'activation.
 *
 * `peutEtreActivee` exige une présentation, une photo et l'acceptation des
 * documents. Aucune des trois n'était collectée nulle part — **personne ne
 * pouvait donc être activé**, quel que soit le reste du dossier.
 *
 * Les documents se cochent **un par un**. Une case unique pour trois
 * engagements distincts rendrait le consentement attaquable, et l'un des trois
 * est le mandat de facturation : c'est lui qui autorise Léo Clean à établir des
 * factures au nom de l'intervenant, et les factures déjà émises l'invoquent.
 */

export function ProfilEtChartes({
  presentation,
  photoDeposee,
  chartesSignees,
  depotOuvert,
  telephone,
}: {
  presentation: string | null;
  photoDeposee: boolean;
  chartesSignees: boolean;
  depotOuvert: boolean;
  telephone: string;
}) {
  const [pending, startTransition] = useTransition();
  const [texte, setTexte] = useState(presentation ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [acceptes, setAcceptes] = useState<CharteId[]>([]);
  const entree = useRef<HTMLInputElement | null>(null);

  const toutAccepte = CHARTES.every((charte) => acceptes.includes(charte.id));

  return (
    <>
      {erreur ? (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {erreur}
        </p>
      ) : null}
      {succes ? (
        <p role="status" className="mt-6 text-sm font-semibold text-brand">
          {succes}
        </p>
      ) : null}

      {/* --- Présentation --- */}
      <section className="mt-10">
        <h2 className="font-heading text-lg font-extrabold">
          Quelques mots sur vous
        </h2>
        {/*
         * On dit qui va le lire. Un champ libre sans destinataire annoncé se
         * remplit d'une ligne ; celui-ci est affiché au client avant sa
         * première intervention, et c'est la seule chose qui incarne « la même
         * personne chaque semaine ».
         */}
        <p className="mt-1 text-pretty text-muted-foreground">
          Ce texte est lu par les clients avant votre première intervention.
          Depuis combien de temps vous faites ce métier, ce que vous aimez y
          faire — pas un CV.
        </p>

        <textarea
          value={texte}
          onChange={(event) => {
            setTexte(event.target.value);
            setSucces(null);
          }}
          rows={5}
          maxLength={2000}
          className="mt-4 w-full rounded-xl border border-input bg-background p-3 text-base"
        />

        <Button
          className="mt-3"
          variant="outline"
          disabled={pending || texte.trim().length === 0}
          onClick={() =>
            startTransition(async () => {
              setErreur(null);
              const resultat = await enregistrerMaPresentation({
                presentation: texte,
              });
              if (!resultat.ok) {
                setErreur(resultat.error);
                return;
              }
              setSucces("Votre présentation est enregistrée.");
            })
          }
        >
          {pending ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : null}
          Enregistrer
        </Button>
      </section>

      {/* --- Photo --- */}
      <section className="mt-10">
        <h2 className="font-heading text-lg font-extrabold">Votre photo</h2>
        <p className="mt-1 text-pretty text-muted-foreground">
          Un portrait simple, de face. C&apos;est ce que voit le client à qui
          l&apos;on annonce votre venue — pas une photo d&apos;identité.
        </p>

        {photoDeposee ? (
          <p className="mt-3 flex items-center gap-2 font-medium">
            <CheckIcon className="size-5 text-brand" aria-hidden />
            Photo enregistrée
          </p>
        ) : null}

        {depotOuvert ? (
          <>
            <input
              ref={entree}
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(event) => {
                const fichier = event.target.files?.[0];
                if (!fichier) return;
                const donnees = new FormData();
                donnees.set("fichier", fichier);
                startTransition(async () => {
                  setErreur(null);
                  const resultat = await deposerMaPhoto(donnees);
                  if (!resultat.ok) setErreur(resultat.error);
                  else setSucces("Votre photo est enregistrée.");
                });
              }}
            />
            <Button
              variant="outline"
              className="mt-3"
              disabled={pending}
              onClick={() => entree.current?.click()}
            >
              <UploadIcon className="size-4" aria-hidden />
              {photoDeposee ? "Changer ma photo" : "Choisir ma photo"}
            </Button>
          </>
        ) : (
          <p className="mt-3 rounded-xl border border-warning-border bg-warning-bg p-4 text-sm text-warning-dark">
            Le dépôt en ligne n&apos;est pas encore ouvert. Appelez-nous au{" "}
            {telephone}.
          </p>
        )}
      </section>

      {/* --- Signature --- */}
      <section className="mt-10">
        <h2 className="font-heading text-lg font-extrabold">
          Les documents à accepter
        </h2>

        {chartesSignees ? (
          <p className="mt-3 flex items-center gap-2 font-medium">
            <CheckIcon className="size-5 text-brand" aria-hidden />
            Documents acceptés
          </p>
        ) : (
          <>
            <p className="mt-1 text-pretty text-muted-foreground">
              Trois documents, trois engagements différents. Lisez-les : le
              troisième nous autorise à établir vos factures.
            </p>

            <ul className="mt-4 space-y-3">
              {CHARTES.map((charte) => {
                const coche = acceptes.includes(charte.id);
                return (
                  <li
                    key={charte.id}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <label className="flex cursor-pointer gap-3">
                      <input
                        type="checkbox"
                        checked={coche}
                        onChange={() =>
                          setAcceptes((actuels) =>
                            coche
                              ? actuels.filter((id) => id !== charte.id)
                              : [...actuels, charte.id],
                          )
                        }
                        className="mt-1 size-6 shrink-0 rounded-md"
                      />
                      <span>
                        <span className="block font-semibold">
                          {charte.titre}
                        </span>
                        <span className="mt-1 block text-pretty">
                          {charte.engagement}
                        </span>
                        {/*
                         * La raison est affichée sous l'engagement, pas
                         * cachée derrière un lien : quelqu'un qui comprend
                         * pourquoi un document existe le lit ; quelqu'un à
                         * qui on demande d'accepter des « conditions » coche
                         * sans lire, et son consentement ne vaut rien.
                         */}
                        <span className="mt-1 block text-sm text-pretty text-muted-foreground">
                          {charte.raison}
                        </span>
                        {charte.href ? (
                          <a
                            href={charte.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block text-sm text-brand underline"
                          >
                            Lire le texte complet
                          </a>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <Button
              className="mt-4"
              disabled={pending || !toutAccepte}
              onClick={() =>
                startTransition(async () => {
                  setErreur(null);
                  const resultat = await signerMesChartes({
                    acceptes,
                    version: VERSION_CHARTES,
                  });
                  if (!resultat.ok) {
                    setErreur(resultat.error);
                    return;
                  }
                  setSucces("C'est enregistré. Merci.");
                })
              }
            >
              {pending ? (
                <Loader2Icon className="animate-spin" aria-hidden />
              ) : null}
              J&apos;accepte ces trois documents
            </Button>
          </>
        )}
      </section>
    </>
  );
}
