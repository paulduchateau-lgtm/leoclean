"use client";

import { CheckCircle2Icon, Loader2Icon, SendIcon } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import { submitLead } from "@/app/etre-rappele/actions";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SITE } from "@/lib/site";
import { COMMUNES_BY_POPULATION } from "@/lib/territory";

type State = ActionResult<{ received: true }> | null;

async function submit(_previous: State, formData: FormData): Promise<State> {
  return submitLead({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    communeInsee: formData.get("communeInsee"),
    message: formData.get("message"),
    sourcePath: formData.get("sourcePath"),
    website: formData.get("website"),
    renderedAt: formData.get("renderedAt"),
  });
}

export function LeadForm({
  defaultCommuneInsee,
  sourcePath,
}: {
  defaultCommuneInsee?: string;
  sourcePath?: string;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    submit,
    null,
  );

  /**
   * Horodatage d'affichage, relevé après le montage plutôt que pendant le
   * rendu : lire l'horloge pendant un rendu le rend impur, et React peut
   * rejouer un rendu, ce qui produirait une valeur instable.
   */
  const renderedAt = useRef<number>(0);
  useEffect(() => {
    renderedAt.current = Date.now();
  }, []);

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-border bg-secondary/50 p-8 text-center">
        <CheckCircle2Icon
          className="mx-auto mb-4 size-9 text-primary"
          aria-hidden
        />
        <p className="font-heading text-xl font-semibold">
          C&apos;est noté, merci.
        </p>
        <p className="mx-auto mt-3 max-w-prose text-muted-foreground">
          Nous vous rappelons dans la journée, ou le lendemain matin si vous
          avez écrit le soir. Si c&apos;est urgent, appelez directement le{" "}
          <a
            href={`tel:${SITE.phoneE164}`}
            className="font-medium text-primary"
          >
            {SITE.phone}
          </a>
          .
        </p>
      </div>
    );
  }

  const fieldError = (field: string) =>
    state?.ok === false ? state.fieldErrors?.[field]?.[0] : undefined;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="sourcePath" value={sourcePath ?? ""} />
      {/* Renseigné à la soumission depuis la référence, jamais au rendu. */}
      <input
        type="hidden"
        name="renderedAt"
        ref={(node) => {
          if (node) {
            node.value = String(renderedAt.current);
          }
        }}
      />

      {/* Champ piège : invisible pour un humain, rempli par un robot. */}
      <div aria-hidden className="absolute h-0 w-0 overflow-hidden">
        <label htmlFor="website">Site web</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Votre nom</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            aria-invalid={fieldError("name") ? true : undefined}
            aria-describedby={fieldError("name") ? "name-error" : undefined}
          />
          {fieldError("name") ? (
            <p
              id="name-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {fieldError("name")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Votre téléphone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="06 12 34 56 78"
            required
            aria-invalid={fieldError("phone") ? true : undefined}
            aria-describedby={fieldError("phone") ? "phone-error" : undefined}
          />
          {fieldError("phone") ? (
            <p
              id="phone-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {fieldError("phone")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="communeInsee">Votre commune</Label>
          <select
            id="communeInsee"
            name="communeInsee"
            defaultValue={defaultCommuneInsee ?? ""}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
          >
            <option value="">Choisir…</option>
            {COMMUNES_BY_POPULATION.map((commune) => (
              <option key={commune.insee} value={commune.insee}>
                {commune.name} ({commune.postalCode})
              </option>
            ))}
          </select>
          {fieldError("communeInsee") ? (
            <p role="alert" className="text-sm text-destructive">
              {fieldError("communeInsee")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">
            Votre email{" "}
            <span className="font-normal text-muted-foreground">
              (facultatif)
            </span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={fieldError("email") ? true : undefined}
          />
          {fieldError("email") ? (
            <p role="alert" className="text-sm text-destructive">
              {fieldError("email")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">
          Votre besoin{" "}
          <span className="font-normal text-muted-foreground">
            (facultatif)
          </span>
        </Label>
        <Textarea
          id="message"
          name="message"
          rows={3}
          placeholder="Une maison de 110 m², plutôt le mardi matin, avec du repassage."
        />
      </div>

      {state?.ok === false && state.code !== "VALIDATION" ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2Icon className="animate-spin" aria-hidden />
            Envoi…
          </>
        ) : (
          <>
            <SendIcon aria-hidden />
            Être rappelé
          </>
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Nous vous rappelons dans la journée. Vos coordonnées ne servent
        qu&apos;à vous répondre et ne sont transmises à personne.
      </p>
    </form>
  );
}
