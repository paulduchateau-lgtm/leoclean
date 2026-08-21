"use client";

import { CheckCircle2Icon, Loader2Icon, SendIcon } from "lucide-react";
import { PhoneField } from "@/components/phone-field";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useEffect, useRef } from "react";

import {
  CANDIDATE_STATUSES,
  submitCandidature,
} from "@/app/travailler-avec-nous/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { SITE } from "@/lib/site";
import { COMMUNES_BY_POPULATION } from "@/lib/territory";

type State = ActionResult<{ received: true }> | null;

async function submit(_previous: State, formData: FormData): Promise<State> {
  return submitCandidature({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    communeInsee: formData.get("communeInsee"),
    status: formData.get("status"),
    availability: formData.get("availability"),
    referralCode: formData.get("referralCode"),
    website: formData.get("website"),
    renderedAt: formData.get("renderedAt"),
  });
}

/**
 * Candidature d'intervenant : six champs, sept avec un code de parrainage.
 *
 * Chaque champ supplémentaire coûte des candidatures, et la vérification des
 * pièces suppose de toute façon un appel : le formulaire ne sert qu'à déclencher
 * ce rappel, pas à constituer un dossier.
 *
 * **Le champ code parrain n'apparaît que s'il y a un code.** Afficher à tout le
 * monde une case dont la quasi-totalité des gens n'a pas l'usage ajoute une
 * question sans réponse au moment précis où l'on demande un engagement. Il est
 * donc lu depuis l'URL, et il n'existe pas sans elle.
 *
 * La lecture du paramètre est isolée dans `<ChampParrain />`, derrière sa
 * propre frontière `<Suspense>`. Lire l'URL depuis le composant de formulaire
 * lui-même ferait différer tout le formulaire au rendu client, alors que seul
 * ce champ dépend de l'adresse : la frontière est donc posée au plus près, et
 * ce qu'elle diffère tient en un champ que l'immense majorité des visiteurs ne
 * verra jamais.
 */
function ChampParrain() {
  const code = useSearchParams().get("parrain")?.trim();
  if (code === undefined || code === "") return null;

  return (
    <div className="space-y-2">
      <Label htmlFor="referralCode">Code parrain</Label>
      <Input
        id="referralCode"
        name="referralCode"
        defaultValue={code}
        readOnly
      />
    </div>
  );
}
export function CandidatureForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(
    submit,
    null,
  );

  /* Relevé après le montage : lire l'horloge pendant un rendu le rend impur,
     et React peut rejouer un rendu — la valeur ne serait plus stable. */
  const renderedAt = useRef<number>(0);

  useEffect(() => {
    renderedAt.current = Date.now();
  }, []);

  if (state?.ok) {
    return (
      <div className="rounded-[var(--r-l)] border border-border bg-secondary/50 p-8 text-center">
        <CheckCircle2Icon
          className="mx-auto mb-4 size-9 text-brand"
          aria-hidden
        />
        <p className="text-xl font-extrabold">C&apos;est noté, merci.</p>
        <p className="mx-auto mt-3 max-w-prose text-muted-foreground">
          Nous vous rappelons sous deux jours ouvrés au numéro que vous avez
          laissé. Si vous préférez ne pas attendre, appelez-nous au{" "}
          <a href={`tel:${SITE.phoneE164}`} className="text-brand underline">
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
      <input
        type="hidden"
        name="renderedAt"
        ref={(node) => {
          if (node) node.value = String(renderedAt.current);
        }}
      />

      {/* Champ piège : invisible pour un humain, rempli par un robot. */}
      <div aria-hidden className="absolute h-0 w-0 overflow-hidden">
        <label htmlFor="candidature-website">Site web</label>
        <input
          id="candidature-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">Votre prénom</Label>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            required
            aria-invalid={fieldError("firstName") ? true : undefined}
          />
          {fieldError("firstName") ? (
            <p role="alert" className="text-sm text-destructive">
              {fieldError("firstName")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Votre nom</Label>
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            required
            aria-invalid={fieldError("lastName") ? true : undefined}
          />
          {fieldError("lastName") ? (
            <p role="alert" className="text-sm text-destructive">
              {fieldError("lastName")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Votre téléphone</Label>
          <PhoneField
            id="phone"
            name="phone"
            placeholder="06 12 34 56 78"
            required
            serverError={fieldError("phone") ?? null}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="communeInsee">Où habitez-vous ?</Label>
          <select
            id="communeInsee"
            name="communeInsee"
            defaultValue=""
            className="min-h-11 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Votre situation</legend>
        <div className="space-y-2">
          {Object.entries(CANDIDATE_STATUSES).map(([value, label], index) => (
            <label
              key={value}
              className="flex min-h-11 items-center gap-3 rounded-[var(--r-m)] border border-border bg-card px-4"
            >
              <input
                type="radio"
                name="status"
                value={value}
                defaultChecked={index === 0}
                className="size-5 accent-teal-400"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
        {fieldError("status") ? (
          <p role="alert" className="text-sm text-destructive">
            {fieldError("status")}
          </p>
        ) : null}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="availability">
          Vos disponibilités{" "}
          <span className="font-normal text-muted-foreground">
            (facultatif)
          </span>
        </Label>
        <Textarea
          id="availability"
          name="availability"
          rows={3}
          placeholder="Par exemple : lundi, mardi et jeudi, de 9 h à 16 h."
        />
      </div>

      <Suspense fallback={null}>
        <ChampParrain />
      </Suspense>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? (
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
        ) : (
          <SendIcon className="size-4" aria-hidden />
        )}
        {pending ? "Envoi…" : "Déposer ma candidature"}
      </Button>

      {state?.ok === false ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
