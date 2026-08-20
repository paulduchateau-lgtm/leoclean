"use client";

import { CheckCircle2Icon, Loader2Icon, MailIcon } from "lucide-react";
import { useActionState, useState } from "react";

import {
  requestMagicLink,
  seConnecterAvec,
  seConnecterAvecMotDePasse,
} from "@/app/(auth)/actions";
import type { ActionResult } from "@/lib/actions";
import type { Fournisseur } from "@/lib/auth/fournisseurs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Connexion.
 *
 * **Un seul écran, trois chemins, aucun sélecteur de mode.** Un onglet
 * « mot de passe / lien » obligerait à choisir avant de savoir ce qu'on a : la
 * personne qui ne se souvient pas si elle en a défini un choisirait au hasard.
 * Ici les deux champs sont posés, et le lien reste atteignable sans rien
 * effacer de ce qui est déjà tapé.
 *
 * L'adresse est partagée par les deux chemins — c'est le même champ, saisi une
 * fois.
 */

type EtatLien = ActionResult<{ sent: true; throttled: boolean }> | null;
type EtatMotDePasse = { erreur: string } | null;

async function demanderLeLien(
  _precedent: EtatLien,
  donnees: FormData,
): Promise<EtatLien> {
  return requestMagicLink({
    email: donnees.get("email"),
    callbackUrl: donnees.get("callbackUrl"),
  });
}

export function SignInForm({
  callbackUrl,
  fournisseurs,
}: {
  callbackUrl: string;
  fournisseurs: readonly Fournisseur[];
}) {
  const [email, setEmail] = useState("");

  const [etatLien, envoyerLeLien, lienEnCours] = useActionState<
    EtatLien,
    FormData
  >(demanderLeLien, null);

  const [etatMotDePasse, seConnecter, connexionEnCours] = useActionState<
    EtatMotDePasse,
    FormData
  >(seConnecterAvecMotDePasse, null);

  if (etatLien?.ok) {
    return (
      <div className="rounded-lg border border-border bg-secondary/50 p-6 text-center">
        <CheckCircle2Icon
          className="mx-auto mb-3 size-8 text-brand"
          aria-hidden
        />
        <p className="font-medium">Regardez votre boîte mail</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Si un compte existe pour cette adresse, un lien de connexion vient
          d&apos;être envoyé. Il est valable 15 minutes.
        </p>
      </div>
    );
  }

  const occupe = lienEnCours || connexionEnCours;

  return (
    <div className="space-y-6">
      {fournisseurs.length > 0 ? (
        <>
          <div className="flex flex-col gap-3">
            {fournisseurs.map((fournisseur) => (
              <form
                key={fournisseur.id}
                action={async () => {
                  await seConnecterAvec(fournisseur.id, callbackUrl);
                }}
              >
                <button
                  type="submit"
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-border bg-card px-5 font-bold transition-colors hover:border-teal-300 hover:bg-teal-50"
                >
                  Continuer avec {fournisseur.nom}
                </button>
              </form>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" aria-hidden />
            <span className="text-sm text-muted-foreground">ou</span>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>
        </>
      ) : null}

      <form action={seConnecter} className="space-y-4" noValidate>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        <div className="space-y-2">
          <Label htmlFor="email">Votre adresse email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="vous@exemple.fr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={etatLien?.ok === false || undefined}
          />
          {etatLien?.ok === false ? (
            <p role="alert" className="text-sm text-destructive">
              {etatLien.fieldErrors?.email?.[0] ?? etatLien.error}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Votre mot de passe</Label>
          <Input
            id="password"
            name="password"
            type="password"
            /*
             * `current-password` fait proposer au gestionnaire de mots de passe
             * celui qui est enregistré pour ce site, et non d'en créer un.
             */
            autoComplete="current-password"
            placeholder="••••••••••"
          />
          {etatMotDePasse ? (
            <p role="alert" className="text-sm text-destructive">
              {etatMotDePasse.erreur}
            </p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" disabled={occupe}>
          {connexionEnCours ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : null}
          Se connecter
        </Button>
      </form>

      {/*
       * Le second formulaire partage l'adresse par un champ caché plutôt que
       * par un bouton du premier : deux boutons dans un même formulaire
       * rendraient le champ mot de passe obligatoire pour demander un lien, ce
       * qui est exactement l'inverse de ce qu'on veut.
       */}
      <form action={envoyerLeLien} className="space-y-3">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <input type="hidden" name="email" value={email} />

        <Button
          type="submit"
          variant="outline"
          className="w-full"
          disabled={occupe}
        >
          {lienEnCours ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <MailIcon aria-hidden />
          )}
          Recevoir un lien de connexion
        </Button>

        <p className="text-center text-sm text-pretty text-muted-foreground">
          Vous n&apos;avez pas de mot de passe, ou vous l&apos;avez oublié ? Le
          lien vous connecte sans en avoir besoin, et vous pourrez en définir un
          ensuite.
        </p>
      </form>
    </div>
  );
}
