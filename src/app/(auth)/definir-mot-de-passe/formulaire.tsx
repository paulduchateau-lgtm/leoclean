"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { definirMonPremierMotDePasse } from "@/app/(auth)/definir-mot-de-passe/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LONGUEUR_MINIMALE } from "@/lib/auth/mot-de-passe";

/**
 * Le premier mot de passe, proposé juste après un lien magique.
 *
 * **« Plus tard » est un vrai bouton, pas un lien discret en bas de page.** Le
 * dépôt a choisi que le mot de passe s'ajoute et ne remplace rien : un écran
 * dont on ne sort qu'en obéissant contredirait cette règle, et transformerait
 * une commodité en péage.
 *
 * Aucune règle de composition n'est affichée au-delà de la longueur : le NIST
 * les décourage explicitement parce qu'elles produisent `Motdepasse1!` et non
 * de l'entropie. Ce que l'écran dit, c'est qu'une phrase courte fait un très
 * bon mot de passe.
 */
export function FormulaireMotDePasse({ suite }: { suite: string }) {
  const router = useRouter();
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const continuer = () => router.replace(suite);

  return (
    <div className="space-y-6">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setErreur(null);
          startTransition(async () => {
            const resultat = await definirMonPremierMotDePasse({ motDePasse });
            if (resultat.ok) continuer();
            else setErreur(resultat.error);
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="motDePasse">Votre mot de passe</Label>
          <Input
            id="motDePasse"
            type="password"
            autoComplete="new-password"
            minLength={LONGUEUR_MINIMALE}
            required
            value={motDePasse}
            onChange={(event) => setMotDePasse(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Au moins {LONGUEUR_MINIMALE} caractères. Une phrase courte fait un
            très bon mot de passe — ni majuscule ni chiffre exigés.
          </p>
        </div>

        {erreur ? (
          <p role="alert" className="text-sm text-destructive">
            {erreur}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer et continuer"}
        </Button>
      </form>

      <button
        type="button"
        onClick={continuer}
        className="min-h-12 w-full rounded-full border-2 border-border bg-card px-5 font-bold transition-colors hover:border-teal-300 hover:bg-teal-50"
      >
        Plus tard
      </button>
    </div>
  );
}
