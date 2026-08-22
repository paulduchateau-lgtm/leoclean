"use client";

import { useState, useTransition } from "react";

import {
  deposerMaDemandeRgpd,
  mettreMonCompteEnPause,
  reprendreMesMissions,
} from "@/app/(app)/intervenant/profil/actions";
import type { DemandeVue } from "@/lib/cleaner/demande-rgpd";

/**
 * La pause, et les droits sur ses données.
 *
 * **La pause n'annule aucune mission acceptée**, et l'écran le dit avant le
 * geste plutôt qu'après. C'est la règle des absences : une pause change ce qui
 * **sera** proposé ; se dégager d'un engagement déjà pris regarde aussi le
 * client, et passe par un appel. Le nombre de missions concernées est affiché —
 * « quelques-unes » ferait hésiter sans informer.
 *
 * **La demande RGPD part chez un humain, et l'écran ne prétend pas l'inverse.**
 * Promettre un effacement immédiat serait plus grave que d'annoncer un délai :
 * la promesse serait tenue à l'écran et démentie en base, un intervenant ayant
 * émis des factures que le code de commerce impose de conserver dix ans.
 */

const JOUR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export function GestionCompte({
  enPause,
  peutSePauser,
  missionsAVenir,
  demandes,
  telephone,
}: {
  enPause: boolean;
  /** Faux quand la plateforme a suspendu : le bouton n'aurait rien à lever. */
  peutSePauser: boolean;
  missionsAVenir: number;
  demandes: DemandeVue[];
  telephone: string;
}) {
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [envoyee, setEnvoyee] = useState<string | null>(null);

  const ouverte = (type: string) =>
    demandes.some(
      (demande) =>
        demande.type === type &&
        (demande.statut === "RECUE" || demande.statut === "EN_COURS"),
    );

  return (
    <>
      <section className="mt-12 border-t border-border pt-8">
        <h2 className="font-heading text-lg font-extrabold">Mon activité</h2>

        {enPause ? (
          <>
            <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
              Votre compte est en pause : aucune mission ne vous est proposée.
              Vos disponibilités et votre dossier sont conservés tels quels.
            </p>
            <button
              type="button"
              disabled={pending || !peutSePauser}
              onClick={() =>
                startTransition(async () => {
                  setErreur(null);
                  const resultat = await reprendreMesMissions({});
                  if (!resultat.ok) setErreur(resultat.error);
                })
              }
              className="mt-4 inline-flex min-h-12 items-center rounded-full bg-primary px-8 font-bold text-primary-foreground shadow-action transition-all duration-200 ease-brand enabled:hover:-translate-y-px enabled:hover:bg-pineapple-400 disabled:opacity-45"
            >
              Reprendre les missions
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
              Mettre votre compte en pause arrête les propositions, sans rien
              effacer. Vous le reprenez quand vous voulez.
            </p>

            {missionsAVenir > 0 ? (
              <p className="mt-3 max-w-prose rounded-[var(--r-m)] border border-warning/40 bg-warning/10 p-3 text-sm text-pretty">
                Vous avez {missionsAVenir} mission
                {missionsAVenir > 1 ? "s" : ""} déjà acceptée
                {missionsAVenir > 1 ? "s" : ""}. La pause ne{" "}
                {missionsAVenir > 1 ? "les" : "l'"}annule pas : ces clients vous
                attendent. Pour vous en dégager, appelez-nous au {telephone}.
              </p>
            ) : null}

            <button
              type="button"
              disabled={pending || !peutSePauser}
              onClick={() =>
                startTransition(async () => {
                  setErreur(null);
                  const resultat = await mettreMonCompteEnPause({});
                  if (!resultat.ok) setErreur(resultat.error);
                })
              }
              className="mt-4 inline-flex min-h-12 items-center rounded-full border-2 border-border bg-card px-6 font-bold transition-colors hover:border-teal-300 hover:bg-teal-50 disabled:opacity-45"
            >
              Mettre mon compte en pause
            </button>
          </>
        )}

        {erreur ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {erreur}
          </p>
        ) : null}
      </section>

      <section className="mt-12 border-t border-border pt-8">
        <h2 className="font-heading text-lg font-extrabold">Mes données</h2>
        <p className="mt-2 max-w-prose text-pretty text-muted-foreground">
          Vous pouvez demander une copie de vos données, ou leur effacement.
          Votre demande est enregistrée et traitée par quelqu&apos;un : vos
          factures et votre SIRET figurent sur des documents que la loi nous
          impose de conserver dix ans, et nous vous dirons précisément ce qui
          peut être effacé et ce qui ne le peut pas.
        </p>

        {envoyee ? (
          <p role="status" className="mt-4 font-semibold text-brand">
            {envoyee}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3">
          {(
            [
              { type: "ACCES", libelle: "Demander une copie de mes données" },
              { type: "EFFACEMENT", libelle: "Demander l'effacement" },
            ] as const
          ).map((choix) => (
            <button
              key={choix.type}
              type="button"
              disabled={pending || ouverte(choix.type)}
              onClick={() =>
                startTransition(async () => {
                  setErreur(null);
                  const resultat = await deposerMaDemandeRgpd({
                    type: choix.type,
                    message: message.trim() || null,
                  });
                  if (!resultat.ok) {
                    setErreur(resultat.error);
                    return;
                  }
                  setEnvoyee(
                    resultat.data.deja
                      ? "Une demande est déjà en cours. Nous y répondons sous un mois."
                      : "Demande enregistrée. Nous y répondons sous un mois, comme le prévoit le règlement.",
                  );
                  setMessage("");
                })
              }
              className="inline-flex min-h-11 items-center rounded-full border-2 border-border bg-card px-5 text-sm font-bold transition-colors hover:border-teal-300 hover:bg-teal-50 disabled:opacity-45"
            >
              {ouverte(choix.type) ? "Demande en cours" : choix.libelle}
            </button>
          ))}
        </div>

        <label className="mt-4 block max-w-prose">
          <span className="text-sm font-medium">
            Une précision ? (facultatif)
          </span>
          <textarea
            rows={2}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="mt-1 w-full rounded-[var(--r-m)] border-2 border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-teal-600"
          />
        </label>

        {demandes.length > 0 ? (
          <ul className="mt-5 space-y-1 text-sm text-muted-foreground">
            {demandes.map((demande) => (
              <li key={`${demande.type}-${demande.deposeeLe}`}>
                {demande.type === "ACCES" ? "Copie" : "Effacement"} · déposée le{" "}
                {JOUR.format(new Date(demande.deposeeLe))} ·{" "}
                {demande.statut === "TRAITEE"
                  ? "traitée"
                  : demande.statut === "REFUSEE"
                    ? "refusée"
                    : "en cours"}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}
