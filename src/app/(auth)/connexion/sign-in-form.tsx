"use client";

import { CheckCircle2Icon, Loader2Icon, MailIcon } from "lucide-react";
import { useActionState } from "react";

import { requestMagicLink } from "@/app/(auth)/actions";
import type { ActionResult } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = ActionResult<{ sent: true; throttled: boolean }> | null;

async function submit(_previous: State, formData: FormData): Promise<State> {
  return requestMagicLink({
    email: formData.get("email"),
    callbackUrl: formData.get("callbackUrl"),
  });
}

export function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    submit,
    null,
  );

  if (state?.ok) {
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

  return (
    <form action={formAction} className="space-y-4" noValidate>
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
          aria-describedby={state?.ok === false ? "email-error" : undefined}
          aria-invalid={state?.ok === false || undefined}
        />
        {state?.ok === false ? (
          <p id="email-error" role="alert" className="text-sm text-destructive">
            {state.fieldErrors?.email?.[0] ?? state.error}
          </p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2Icon className="animate-spin" aria-hidden />
            Envoi en cours…
          </>
        ) : (
          <>
            <MailIcon aria-hidden />
            Recevoir mon lien de connexion
          </>
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Pas de mot de passe à retenir : nous vous envoyons un lien à usage
        unique.
      </p>
    </form>
  );
}
