"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  definirMonMotDePasse,
  fermerMesSessions,
  retirerMonMotDePasse,
} from "@/app/(app)/mon-compte/connexion/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Fournisseur } from "@/lib/auth/fournisseurs";
import type { EtatConnexion } from "@/lib/auth/identifiants";
import { LONGUEUR_MINIMALE } from "@/lib/auth/mot-de-passe";

/**
 * Les trois gestes de la sécurité d'un compte.
 *
 * Le mot de passe est présenté comme **un confort, pas comme une obligation** :
 * la phrase qui l'introduit dit ce qu'il évite, et celle qui l'accompagne
 * rappelle que le lien continue de fonctionner. Un écran qui presserait de
 * définir un mot de passe irait contre la raison qui a fait choisir le lien.
 */

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

const NOMS: Record<string, string> = {
  google: "Google",
  apple: "Apple",
  facebook: "Facebook",
};

export function Identifiants({
  etat,
  fournisseursDisponibles,
}: {
  etat: EtatConnexion;
  fournisseursDisponibles: readonly Fournisseur[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [ouvert, setOuvert] = useState(false);
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [retraitOuvert, setRetraitOuvert] = useState(false);

  function agir(
    travail: () => Promise<{ ok: boolean; error?: string }>,
    message: string,
  ) {
    startTransition(async () => {
      setErreur(null);
      setSucces(null);
      const resultat = await travail();
      if (!resultat.ok) {
        setErreur(resultat.error ?? "Action impossible.");
        return;
      }
      setActuel("");
      setNouveau("");
      setOuvert(false);
      setRetraitOuvert(false);
      setSucces(message);
      router.refresh();
    });
  }

  return (
    <div className="mt-8 space-y-10">
      {succes ? (
        <p
          role="status"
          className="rounded-xl border border-success/40 bg-success/10 p-4 font-semibold"
        >
          {succes}
        </p>
      ) : null}

      {/* --- Mot de passe --- */}
      <section>
        <h2 className="font-heading text-lg font-extrabold">Mot de passe</h2>

        {etat.aUnMotDePasse ? (
          <p className="mt-1 text-muted-foreground">
            Défini
            {etat.motDePasseDepuis
              ? ` le ${DATE.format(new Date(etat.motDePasseDepuis))}`
              : ""}
            . Vous pouvez aussi continuer à vous connecter par lien.
          </p>
        ) : (
          <p className="mt-1 text-pretty text-muted-foreground">
            Vous n&apos;en avez pas, et ce n&apos;est pas un problème : le lien
            de connexion suffit. En définir un évite simplement d&apos;aller
            chercher un email à chaque fois.
          </p>
        )}

        {erreur ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {erreur}
          </p>
        ) : null}

        {ouvert ? (
          <div className="mt-4 space-y-4 rounded-xl border border-border bg-secondary/30 p-4">
            {/*
             * L'ancien n'est demandé que s'il en existe un. Le réclamer pour
             * poser le premier serait demander quelque chose que la personne
             * n'a pas.
             */}
            {etat.aUnMotDePasse ? (
              <div className="space-y-2">
                <Label htmlFor="actuel">Mot de passe actuel</Label>
                <Input
                  id="actuel"
                  type="password"
                  autoComplete="current-password"
                  value={actuel}
                  onChange={(event) => setActuel(event.target.value)}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="nouveau">Nouveau mot de passe</Label>
              <Input
                id="nouveau"
                type="password"
                autoComplete="new-password"
                value={nouveau}
                onChange={(event) => setNouveau(event.target.value)}
              />
              {/*
               * On dit la seule règle qui existe. Annoncer « une majuscule, un
               * chiffre, un caractère spécial » produirait `Motdepasse1!`, ce
               * qui n'est pas de l'entropie.
               */}
              <p className="text-sm text-muted-foreground">
                {LONGUEUR_MINIMALE} caractères au minimum. Une phrase courte qui
                n&apos;a de sens que pour vous fait un excellent mot de passe.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={pending || nouveau.length === 0}
                onClick={() =>
                  agir(
                    () =>
                      definirMonMotDePasse({
                        nouveau,
                        actuel: actuel || undefined,
                      }),
                    etat.aUnMotDePasse
                      ? "Votre mot de passe est changé."
                      : "Votre mot de passe est défini.",
                  )
                }
              >
                {pending ? (
                  <Loader2Icon className="animate-spin" aria-hidden />
                ) : null}
                Enregistrer
              </Button>
              <Button variant="ghost" onClick={() => setOuvert(false)}>
                Annuler
              </Button>
            </div>
          </div>
        ) : retraitOuvert ? (
          <div className="mt-4 space-y-4 rounded-xl border border-border bg-secondary/30 p-4">
            <p className="text-pretty">
              Vous continuerez à vous connecter par lien, comme avant.
            </p>
            <div className="space-y-2">
              <Label htmlFor="confirmation">Votre mot de passe actuel</Label>
              <Input
                id="confirmation"
                type="password"
                autoComplete="current-password"
                value={actuel}
                onChange={(event) => setActuel(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={pending || actuel.length === 0}
                onClick={() =>
                  agir(
                    () => retirerMonMotDePasse({ actuel }),
                    "Votre mot de passe est retiré.",
                  )
                }
              >
                Retirer le mot de passe
              </Button>
              <Button variant="ghost" onClick={() => setRetraitOuvert(false)}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Button variant="outline" onClick={() => setOuvert(true)}>
              {etat.aUnMotDePasse
                ? "Changer mon mot de passe"
                : "Définir un mot de passe"}
            </Button>
            {etat.aUnMotDePasse ? (
              <button
                type="button"
                onClick={() => setRetraitOuvert(true)}
                className="text-sm text-muted-foreground underline"
              >
                Le retirer
              </button>
            ) : null}
          </div>
        )}
      </section>

      {/* --- Comptes liés --- */}
      {fournisseursDisponibles.length > 0 ? (
        <section>
          <h2 className="font-heading text-lg font-extrabold">Comptes liés</h2>
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {fournisseursDisponibles.map((fournisseur) => {
              const lie = etat.comptesLies.includes(fournisseur.id);
              return (
                <li
                  key={fournisseur.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <span>{NOMS[fournisseur.id] ?? fournisseur.nom}</span>
                  <span className="text-sm text-muted-foreground">
                    {lie ? "Lié" : "Non lié"}
                  </span>
                </li>
              );
            })}
          </ul>
          {/*
           * Le rattachement se fait en se connectant par ce fournisseur, pas
           * par un bouton d'ici : c'est le fournisseur qui doit certifier
           * l'adresse, et une liaison décidée depuis notre écran ne
           * certifierait rien.
           */}
          <p className="mt-3 text-sm text-pretty text-muted-foreground">
            Pour en lier un, déconnectez-vous puis choisissez-le sur
            l&apos;écran de connexion, avec la même adresse email.
          </p>
        </section>
      ) : null}

      {/* --- Appareils --- */}
      <section>
        <h2 className="font-heading text-lg font-extrabold">
          Appareils connectés
        </h2>
        <p className="mt-1 text-pretty text-muted-foreground">
          {etat.sessionsOuvertes === 1
            ? "Une seule connexion ouverte : celle-ci."
            : `${etat.sessionsOuvertes} connexions ouvertes, celle-ci comprise.`}{" "}
          Fermer les déconnecte toutes, y compris cet appareil.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setErreur(null);
              const resultat = await fermerMesSessions({});
              if (!resultat.ok) {
                setErreur(resultat.error);
                return;
              }
              /*
               * La session courante vient d'être supprimée : on recharge vers
               * l'accueil plutôt que de rafraîchir, ce qui afficherait une page
               * dont le cookie ne vaut plus rien.
               */
              window.location.assign("/");
            })
          }
        >
          {pending ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : null}
          Fermer toutes les connexions
        </Button>
      </section>
    </div>
  );
}
