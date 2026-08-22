"use client";

import { CheckCircle2Icon, Loader2Icon, MailIcon } from "lucide-react";
import { useActionState, useState } from "react";

import {
  requestMagicLink,
  seConnecterAvecMotDePasse,
} from "@/app/(auth)/actions";
import { BoutonsSociaux } from "@/components/boutons-sociaux";
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
  /*
   * **Deux temps : l'adresse, puis la façon d'entrer.** Trois options posées
   * côte à côte demandaient de choisir avant de savoir ce qu'on a — la
   * personne qui ne se souvient pas si elle a défini un mot de passe
   * choisissait au hasard. L'adresse d'abord, c'est la seule chose que tout le
   * monde connaît.
   */
  const [etape, setEtape] = useState<"adresse" | "identification">("adresse");

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
  const adresseValide = /.+@.+\..+/.test(email.trim());

  if (etape === "adresse") {
    return (
      <div className="space-y-6">
        {/*
          Les fournisseurs d'abord : ils entrent **et** créent un compte s'il
          n'y en a pas, sans rien demander de plus. C'est le chemin le plus
          court, et il n'a pas de second écran.
        */}
        <BoutonsSociaux fournisseurs={fournisseurs} callbackUrl={callbackUrl} />

        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (adresseValide) setEtape("identification");
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Votre adresse email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              placeholder="vous@exemple.fr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!adresseValide}
          >
            Continuer
          </Button>
        </form>

        {/*
          **On ne dit pas si l'adresse est connue**, et c'est délibéré : le
          dépôt refuse d'énumérer les comptes — savoir que quelqu'un est client
          d'un service de ménage à domicile en dit déjà trop sur lui. Le second
          écran est donc le même dans les deux cas, et c'est le lien qui crée le
          compte quand il n'y en a pas. La personne ne se heurte jamais à un mur.
        */}
        <p className="text-center text-sm text-pretty text-muted-foreground">
          Pas encore de compte ? Continuez : nous le créons au premier lien.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold break-all">{email}</p>
        <button
          type="button"
          onClick={() => setEtape("adresse")}
          className="text-sm font-medium text-brand underline underline-offset-4"
        >
          Changer d&apos;adresse
        </button>
      </div>

      <form action={seConnecter} className="space-y-4" noValidate>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <input type="hidden" name="email" value={email} />

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
            autoFocus
            placeholder="••••••••••"
            aria-describedby={etatMotDePasse ? "password-error" : undefined}
            aria-invalid={etatMotDePasse !== null || undefined}
          />
          {etatMotDePasse ? (
            <p
              id="password-error"
              role="alert"
              className="text-sm text-destructive"
            >
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
        Le second formulaire porte l'adresse par un champ caché plutôt que par
        un bouton du premier : deux boutons dans un même formulaire rendraient
        le mot de passe obligatoire pour demander un lien, ce qui est
        exactement l'inverse de ce qu'on veut.
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
          Recevoir un lien par email
        </Button>

        <p className="text-center text-sm text-pretty text-muted-foreground">
          Sans mot de passe, oublié, ou pas encore de compte : le lien vous
          connecte dans tous les cas, et crée votre compte s&apos;il
          n&apos;existe pas.
        </p>
      </form>
    </div>
  );
}
