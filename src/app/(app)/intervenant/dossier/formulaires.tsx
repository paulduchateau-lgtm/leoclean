"use client";

import { CheckIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";

import {
  enregistrerMesIdentifiants,
  saisirCodeParrain,
} from "@/app/(app)/intervenant/dossier/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Saisie des identifiants professionnels, et du code de parrain.
 *
 * Les contrôles sérieux sont côté serveur — clé du SIRET, cohérence du numéro
 * SAP avec ce SIRET — parce qu'un contrôle côté navigateur ne protège de rien.
 * Ce que le formulaire fait, c'est afficher le refus en clair : « ce SIRET ne
 * passe pas sa clé » est actionnable, « erreur de validation » ne l'est pas.
 */
export function FormulaireIdentifiants({
  siret,
  sapDeclarationNumber,
  insuranceExpiresAt,
}: {
  siret: string | null;
  sapDeclarationNumber: string | null;
  insuranceExpiresAt: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    setSaved(false);

    const result = await enregistrerMesIdentifiants({
      siret: formData.get("siret"),
      sapDeclarationNumber: formData.get("sapDeclarationNumber"),
      insuranceExpiresAt: formData.get("insuranceExpiresAt"),
    });
    setPending(false);

    if (result.ok) setSaved(true);
    else setError(result.error);
  }

  return (
    <form action={submit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="siret">Votre SIRET</Label>
        <Input
          id="siret"
          name="siret"
          inputMode="numeric"
          defaultValue={siret ?? ""}
          placeholder="898 228 705 00015"
          required
        />
        <p className="text-sm text-muted-foreground">
          Quatorze chiffres. Nous vérifions la clé de contrôle tout de suite :
          une faute de frappe se voit sans attendre.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sapDeclarationNumber">
          Numéro de déclaration SAP{" "}
          <span className="font-normal text-muted-foreground">
            (si vous l&apos;avez)
          </span>
        </Label>
        <Input
          id="sapDeclarationNumber"
          name="sapDeclarationNumber"
          defaultValue={sapDeclarationNumber ?? ""}
          placeholder="SAP898228705"
        />
        <p className="text-sm text-muted-foreground">
          Sans lui, votre part n&apos;ouvre pas de crédit d&apos;impôt à vos
          clients. Vous pouvez travailler sans, mais c&apos;est un argument en
          moins. Il doit porter le SIREN de votre SIRET.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="insuranceExpiresAt">
          Fin de validité de votre attestation RC Pro
        </Label>
        <Input
          id="insuranceExpiresAt"
          name="insuranceExpiresAt"
          type="date"
          defaultValue={insuranceExpiresAt?.slice(0, 10) ?? ""}
        />
      </div>

      <Button type="submit" disabled={pending} className="min-h-12">
        {pending ? (
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
        ) : null}
        Enregistrer
      </Button>

      {saved ? (
        <p role="status" className="flex items-center gap-2 text-sm text-brand">
          <CheckIcon className="size-4" aria-hidden />
          C&apos;est enregistré.
        </p>
      ) : null}
      {error !== null ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Saisie du code de parrain.
 *
 * Une seule fois dans une vie : on est parrainé une fois, définitivement. Le
 * formulaire disparaît donc dès qu'un parrain est rattaché, plutôt que de
 * laisser croire qu'on peut en changer.
 */
export function FormulaireCodeParrain() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);

    const result = await saisirCodeParrain({ code: formData.get("code") });
    setPending(false);

    if (result.ok) setDone(true);
    else setError(result.error);
  }

  if (done) {
    return (
      <p role="status" className="text-sm text-brand">
        Votre parrain est rattaché. Il touchera sa commission à partir de votre
        cinquième mission.
      </p>
    );
  }

  return (
    <form action={submit} className="flex flex-wrap items-end gap-3" noValidate>
      <div className="space-y-2">
        <Label htmlFor="code">Code de votre parrain</Label>
        <Input id="code" name="code" className="w-44 uppercase" />
      </div>
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="min-h-12"
      >
        {pending ? (
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
        ) : null}
        Rattacher
      </Button>

      {error !== null ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
