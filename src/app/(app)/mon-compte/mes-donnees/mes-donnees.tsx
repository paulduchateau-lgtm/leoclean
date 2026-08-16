"use client";

import { DownloadIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react";
import { useState, useTransition } from "react";

import {
  MOT_DE_CONFIRMATION,
  exporterMesDonnees,
  supprimerMesDonnees,
} from "@/app/(app)/mon-compte/mes-donnees/actions";
import { Button } from "@/components/ui/button";
import type { ResultatEffacement } from "@/lib/rgpd/effacement";

/**
 * Les deux droits, côte à côte, avec leurs conséquences dites avant le geste.
 *
 * L'effacement demande de recopier un mot. Ce n'est pas une friction gratuite :
 * c'est la seule chose qui sépare un clic distrait d'une décision, et elle est
 * irréversible.
 */
export function MesDonnees() {
  const [pendingExport, startExport] = useTransition();
  const [pendingSuppression, startSuppression] = useTransition();
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [efface, setEfface] = useState<ResultatEffacement | null>(null);

  function exporter() {
    setErreur(null);
    startExport(async () => {
      const resultat = await exporterMesDonnees({});
      if (!resultat.ok) {
        setErreur(resultat.error);
        return;
      }

      /*
       * Le fichier est fabriqué dans le navigateur à partir de la réponse :
       * pas d'URL temporaire à protéger, pas de fichier qui traîne sur un
       * serveur. Il n'existe que le temps du téléchargement.
       */
      const contenu = JSON.stringify(resultat.data, null, 2);
      const url = URL.createObjectURL(
        new Blob([contenu], { type: "application/json" }),
      );
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = "mes-donnees-leoclean.json";
      lien.click();
      URL.revokeObjectURL(url);
    });
  }

  function supprimer() {
    setErreur(null);
    startSuppression(async () => {
      const resultat = await supprimerMesDonnees({ confirmation });
      if (!resultat.ok) {
        setErreur(resultat.error);
        return;
      }
      setEfface(resultat.data);
    });
  }

  if (efface) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-heading text-xl font-semibold">
          Vos données ont été effacées.
        </h2>
        <p className="mt-3 text-muted-foreground">
          Vous êtes déconnecté de tous vos appareils. Voici ce qui a été fait :
        </p>
        <ul className="mt-4 space-y-1.5 text-sm">
          <li>{efface.adressesEffacees} adresse(s) effacée(s)</li>
          <li>{efface.demandesEffacees} demande(s) de rappel supprimée(s)</li>
          <li>{efface.messagesEffaces} message(s) supprimé(s)</li>
          <li>{efface.avisAnonymises} avis rendu(s) anonyme(s)</li>
          <li>{efface.sessionsRevoquees} session(s) révoquée(s)</li>
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          {efface.facturesConservees} facture(s) et{" "}
          {efface.reservationsConservees} réservation(s) sont conservées sans
          votre identité : la loi impose de garder dix ans les documents
          comptables.
        </p>
        {/* Rechargement complet volontaire, et non `Link` : la session vient
            d'être détruite, et le cache du routeur constitué pendant qu'elle
            était valide n'a plus lieu d'être. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-medium text-primary-foreground"
        >
          Revenir à l&apos;accueil
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-heading text-xl font-semibold">
          Obtenir une copie de mes données
        </h2>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Vous récupérez un fichier contenant tout ce que nous détenons sur vous
          : compte, coordonnées, adresses, réservations, avis et demandes de
          rappel.
        </p>
        {erreur ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {erreur}
          </p>
        ) : null}
        <Button
          className="mt-4"
          size="lg"
          disabled={pendingExport}
          onClick={exporter}
        >
          {pendingExport ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <DownloadIcon aria-hidden />
          )}
          Télécharger mes données
        </Button>
      </section>

      <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="flex items-center gap-2 font-heading text-xl font-semibold">
          <TriangleAlertIcon className="size-5 text-destructive" aria-hidden />
          Supprimer mes données
        </h2>

        <p className="mt-3 max-w-prose">
          Nous effaçons vos adresses, vos consignes d&apos;accès, votre
          téléphone, vos notes, vos avis et vos demandes de rappel. Vous êtes
          déconnecté immédiatement, partout.
        </p>
        <p className="mt-3 max-w-prose text-muted-foreground">
          Nous conservons vos factures et le montant de vos réservations
          passées, sans votre nom ni votre adresse : la loi impose de garder dix
          ans les documents comptables. Nous ne pouvons pas vous promettre le
          contraire.
        </p>
        <p className="mt-3 max-w-prose text-muted-foreground">
          C&apos;est définitif : nous n&apos;avons aucun moyen de revenir en
          arrière.
        </p>

        <label
          htmlFor="confirmation"
          className="mt-6 block text-sm font-medium"
        >
          Recopiez « {MOT_DE_CONFIRMATION} » pour confirmer
        </label>
        <input
          id="confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          className="mt-2 min-h-11 w-full max-w-xs rounded-xl border border-input bg-background px-3 text-base"
        />

        <Button
          variant="outline"
          size="lg"
          className="mt-4 border-destructive/40 text-destructive"
          disabled={
            pendingSuppression ||
            confirmation.trim().toUpperCase() !== MOT_DE_CONFIRMATION
          }
          onClick={supprimer}
        >
          {pendingSuppression ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : null}
          Supprimer définitivement mes données
        </Button>
      </section>
    </div>
  );
}
